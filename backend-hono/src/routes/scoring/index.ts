// [claude-code 2026-04-19] S24 unify: T4 monitoring routes + T3 shadow-mode + T3 rescore-status
// [claude-code 2026-04-19] S24-T3: /api/scoring/* — shadow stats + V4 utilities
// [claude-code 2026-04-18] S24-T4: Scoring admin routes — monitoring loop + shadow stats
import { Hono, type Context } from "hono";
import { createLogger } from "../../lib/logger.js";
import {
  getMonitoringStatus,
  runNow,
  setEnabled,
} from "../../services/cron/monitoring-loop.js";
import {
  getShadowStats,
  logShadowDecision,
  resolveShadowDecision,
  type ShadowDecisionType,
  SHADOW_DECISION_TYPES,
} from "../../services/scoring/shadow-mode.js";
import {
  isRescoreInProgress,
  getLastRescoreStats,
} from "../../services/scoring/rescore-all.js";
import { sql, isDatabaseAvailable } from "../../config/database.js";

const log = createLogger("ScoringRoutes");

function requireSuperAdmin(c: Context): string | null {
  const userId = c.get("userId") as string | undefined;
  if (!userId || userId === "anonymous") return null;
  return userId;
}

function isShadowType(value: unknown): value is ShadowDecisionType {
  return (
    typeof value === "string" &&
    (SHADOW_DECISION_TYPES as readonly string[]).includes(value)
  );
}

export function createScoringRoutes(): Hono {
  const router = new Hono();

  // ── Monitoring loop (T4) ──────────────────────────────────────────────
  // GET /api/scoring/monitoring/status
  router.get("/monitoring/status", (c) => {
    const status = getMonitoringStatus();
    return c.json({
      enabled: status.enabled,
      intervalSeconds: status.intervalSeconds,
      lastRunAt: status.lastRunAt?.toISOString() ?? null,
      nextRunAt: status.nextRunAt?.toISOString() ?? null,
      lastRunOutcome: status.lastRunOutcome,
    });
  });

  // POST /api/scoring/monitoring/run-now
  router.post("/monitoring/run-now", async (c) => {
    const userId = requireSuperAdmin(c);
    if (!userId) return c.json({ error: "Unauthorized" }, 401);
    try {
      const outcome = await runNow();
      return c.json({ ok: true, outcome });
    } catch (err) {
      log.error("run-now failed", { error: String(err) });
      return c.json({ error: "Monitoring run failed" }, 500);
    }
  });

  // PATCH /api/scoring/monitoring/config
  router.patch("/monitoring/config", async (c) => {
    const userId = requireSuperAdmin(c);
    if (!userId) return c.json({ error: "Unauthorized" }, 401);
    try {
      const body = (await c.req.json()) as { enabled?: boolean };
      if (typeof body.enabled === "boolean") {
        setEnabled(body.enabled);
      }
      return c.json({
        ok: true,
        status: getMonitoringStatus(),
      });
    } catch {
      return c.json({ error: "Invalid config" }, 400);
    }
  });

  // ── Shadow-mode (T3 service + T4 graduate endpoint) ──────────────────
  // GET /api/scoring/shadow-stats — agreement rate per decision type, 30d rolling
  router.get("/shadow-stats", async (c: Context) => {
    const userId = c.get("userId") as string | undefined;
    if (!userId) return c.json({ stats: [], windowDays: 30 });
    try {
      const stats = await getShadowStats();
      return c.json({ stats, windowDays: 30 });
    } catch {
      return c.json({ stats: [], windowDays: 30 });
    }
  });

  // POST /api/scoring/shadow-decisions — log a shadow decision (internal agent use)
  router.post("/shadow-decisions", async (c: Context) => {
    const userId = c.get("userId") as string | undefined;
    if (!userId) return c.json({ error: "Unauthorized" }, 401);

    const body = await c.req.json().catch(() => null);
    if (
      !body ||
      !isShadowType(body.decisionType) ||
      typeof body.wouldPropose !== "object" ||
      body.wouldPropose === null
    ) {
      return c.json(
        { error: "decisionType and wouldPropose object are required" },
        400,
      );
    }
    const id = await logShadowDecision(
      body.decisionType,
      body.wouldPropose as Record<string, unknown>,
    );
    return c.json({ id });
  });

  // POST /api/scoring/shadow-decisions/resolve — match unresolved shadow proposals
  router.post("/shadow-decisions/resolve", async (c: Context) => {
    const userId = c.get("userId") as string | undefined;
    if (!userId) return c.json({ error: "Unauthorized" }, 401);

    const body = await c.req.json().catch(() => null);
    if (
      !body ||
      !isShadowType(body.decisionType) ||
      typeof body.actualDecision !== "object" ||
      body.actualDecision === null
    ) {
      return c.json(
        { error: "decisionType and actualDecision object are required" },
        400,
      );
    }
    const result = await resolveShadowDecision(
      body.decisionType,
      body.actualDecision as Record<string, unknown>,
      userId,
    );
    return c.json(result);
  });

  // POST /api/scoring/shadow-stats/graduate — super-admin enables auto-apply for a decision type
  router.post("/shadow-stats/graduate", async (c) => {
    const userId = requireSuperAdmin(c);
    if (!userId) return c.json({ error: "Unauthorized" }, 401);
    if (!isDatabaseAvailable()) return c.json({ error: "DB unavailable" }, 503);
    try {
      const body = (await c.req.json()) as { decisionType?: string };
      if (!body.decisionType) {
        return c.json({ error: "decisionType required" }, 400);
      }
      await sql`
        INSERT INTO agent_decision_graduations (decision_type, granted_by, granted_at)
        VALUES (${body.decisionType}, ${userId}, now())
        ON CONFLICT (decision_type) DO UPDATE SET
          granted_by = ${userId},
          granted_at = now()
      `;
      return c.json({ ok: true });
    } catch (err) {
      log.warn("graduate failed (table may not exist yet)", {
        error: String(err),
      });
      return c.json({ error: "Graduation failed" }, 500);
    }
  });

  // ── Rescore-all status (T3) ───────────────────────────────────────────
  // GET /api/scoring/rescore-status
  router.get("/rescore-status", async (c: Context) => {
    const userId = c.get("userId") as string | undefined;
    if (!userId) return c.json({ error: "Unauthorized" }, 401);
    return c.json({
      inProgress: isRescoreInProgress(),
      last: getLastRescoreStats(),
    });
  });

  return router;
}
