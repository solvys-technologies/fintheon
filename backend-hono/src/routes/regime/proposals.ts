// [claude-code 2026-04-19] S24-T1: regime proposals CRUD — agents propose, TP approves/denies, approval applies the regime + sets lock.
import { Hono } from "hono";
import type { Context } from "hono";
import { sql, isDatabaseAvailable } from "../../config/database.js";
import { createLogger } from "../../lib/logger.js";
import { MARKET_REGIMES, type MarketRegime } from "../../types/regime.js";
import { setRegime } from "../../services/regime/regime-service.js";
import { proposeRegimeChange } from "../../services/regime/propose.js";

const log = createLogger("RegimeProposals");

const LOCK_HOURS = 24;

export function createRegimeProposalRoutes(): Hono {
  const app = new Hono();

  // GET /api/regime/proposals?status=pending&limit=50
  app.get("/", async (c) => {
    if (!isDatabaseAvailable()) return c.json({ proposals: [], count: 0 });
    const status = c.req.query("status");
    const limit = Math.min(parseInt(c.req.query("limit") ?? "50", 10), 200);

    const rows = status
      ? await sql`
          SELECT id, proposed_regime, current_regime, reason, evidence,
                 proposed_by, status, approved_by, decided_at, applied_at, created_at
          FROM regime_proposals
          WHERE status = ${status}
          ORDER BY created_at DESC
          LIMIT ${limit}
        `
      : await sql`
          SELECT id, proposed_regime, current_regime, reason, evidence,
                 proposed_by, status, approved_by, decided_at, applied_at, created_at
          FROM regime_proposals
          ORDER BY created_at DESC
          LIMIT ${limit}
        `;

    return c.json({ proposals: rows, count: rows.length });
  });

  // POST /api/regime/proposals — agent creates
  // Body: { proposedRegime, reason, evidence?, proposedBy?, severity? }
  app.post("/", async (c) => {
    const body = await c.req.json().catch(() => null);
    if (!body?.proposedRegime || !body?.reason) {
      return c.json(
        { error: "Missing required fields: proposedRegime, reason" },
        400,
      );
    }
    if (!MARKET_REGIMES.includes(body.proposedRegime as MarketRegime)) {
      return c.json(
        {
          error: `Invalid regime. Must be one of: ${MARKET_REGIMES.join(", ")}`,
        },
        400,
      );
    }

    const proposedBy =
      typeof body.proposedBy === "string" && body.proposedBy.length > 0
        ? body.proposedBy
        : (((c.get as (k: string) => unknown)("email") as string | undefined) ??
          "api");
    const severity = body.severity as
      | "low"
      | "medium"
      | "high"
      | "critical"
      | undefined;

    const result = await proposeRegimeChange({
      proposedBy,
      proposedRegime: body.proposedRegime,
      reason: body.reason,
      evidence: body.evidence ?? {},
      severity,
    });

    if (!result.id) {
      return c.json({ error: "Failed to create proposal", result }, 503);
    }
    return c.json(result, 201);
  });

  // POST /api/regime/proposals/:id/approve — super admin approves → apply regime + 24h lock
  app.post("/:id/approve", approveHandler);

  // POST /api/regime/proposals/:id/deny — super admin denies
  app.post("/:id/deny", async (c) => {
    if (!isDatabaseAvailable()) return c.json({ error: "DB unavailable" }, 503);
    const id = c.req.param("id");
    const userId =
      ((c.get as (k: string) => unknown)("userId") as string | undefined) ??
      null;

    const rows = await sql`
      UPDATE regime_proposals
      SET status = 'denied',
          approved_by = ${userId}::uuid,
          decided_at = now()
      WHERE id = ${id} AND status = 'pending'
      RETURNING id, status, decided_at
    `;
    if (rows.length === 0) {
      return c.json({ error: "Proposal not found or already decided" }, 404);
    }
    log.info("Regime proposal denied", { id, userId });
    return c.json(rows[0]);
  });

  return app;
}

async function approveHandler(c: Context) {
  if (!isDatabaseAvailable()) return c.json({ error: "DB unavailable" }, 503);
  const id = c.req.param("id");
  const userId =
    ((c.get as (k: string) => unknown)("userId") as string | undefined) ?? null;

  const existing = await sql`
    SELECT id, proposed_regime, status, proposed_by
    FROM regime_proposals WHERE id = ${id} LIMIT 1
  `;
  if (existing.length === 0) {
    return c.json({ error: "Proposal not found" }, 404);
  }
  const row = existing[0];
  if (row.status !== "pending") {
    return c.json({ error: `Proposal already ${row.status}` }, 409);
  }

  if (!MARKET_REGIMES.includes(row.proposed_regime as MarketRegime)) {
    return c.json(
      { error: `Invalid regime on proposal: ${row.proposed_regime}` },
      400,
    );
  }

  // Apply the regime (writes a new market_regimes row + deactivates prior).
  await setRegime(
    row.proposed_regime as MarketRegime,
    "manual",
    1.0,
    `from-proposal:${id}`,
  );

  // Set the 24h lock on the just-activated regime row. detected_by is updated
  // to `manual-from-proposal` so history keeps the proposal → approval trail.
  const lockUntilIso = new Date(
    Date.now() + LOCK_HOURS * 60 * 60 * 1000,
  ).toISOString();
  await sql`
    UPDATE market_regimes
    SET detected_by = 'manual-from-proposal',
        locked_by = ${userId},
        locked_until = ${lockUntilIso}
    WHERE active = TRUE
  `;

  const updated = await sql`
    UPDATE regime_proposals
    SET status = 'approved',
        approved_by = ${userId}::uuid,
        decided_at = now(),
        applied_at = now()
    WHERE id = ${id}
    RETURNING id, status, decided_at, applied_at
  `;

  log.info("Regime proposal approved + applied", {
    id,
    userId,
    proposedRegime: row.proposed_regime,
    lockUntil: lockUntilIso,
  });

  return c.json({
    ...updated[0],
    lockedUntil: lockUntilIso,
    appliedRegime: row.proposed_regime,
  });
}
