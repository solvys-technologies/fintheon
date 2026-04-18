// [claude-code 2026-04-18] S24-T4: Scoring admin routes — monitoring loop + shadow stats
import { Hono, type Context } from "hono";
import { createLogger } from "../../lib/logger.js";
import {
  getMonitoringStatus,
  runNow,
  setEnabled,
} from "../../services/cron/monitoring-loop.js";
import { sql, isDatabaseAvailable } from "../../config/database.js";

const log = createLogger("ScoringRoutes");

function requireSuperAdmin(c: Context): string | null {
  const userId = c.get("userId") as string | undefined;
  if (!userId || userId === "anonymous") return null;
  return userId;
}

export function createScoringRoutes(): Hono {
  const router = new Hono();

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
    } catch (err) {
      return c.json({ error: "Invalid config" }, 400);
    }
  });

  // GET /api/scoring/shadow-stats — T3 builds the table; fall back to empty
  router.get("/shadow-stats", async (c) => {
    if (!isDatabaseAvailable()) return c.json({ stats: [] });
    try {
      const rows = await sql`
        SELECT
          decision_type,
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE agreed = true)::int AS agreed,
          CASE
            WHEN COUNT(*) = 0 THEN 0
            ELSE COUNT(*) FILTER (WHERE agreed = true)::float / COUNT(*)
          END AS agreement_rate
        FROM agent_shadow_decisions
        WHERE created_at > now() - interval '30 days'
          AND resolved_at IS NOT NULL
        GROUP BY decision_type
      `;
      const stats = rows.map((r: any) => ({
        decisionType: String(r.decision_type),
        total: Number(r.total),
        agreed: Number(r.agreed),
        agreementRate: Number(r.agreement_rate),
        canAutoApply: Number(r.agreement_rate) >= 0.85 && Number(r.total) >= 30,
      }));
      return c.json({ stats });
    } catch {
      // Table may not exist yet (T3 migration pending) — return empty gracefully
      return c.json({ stats: [] });
    }
  });

  // POST /api/scoring/shadow-stats/graduate
  router.post("/shadow-stats/graduate", async (c) => {
    const userId = requireSuperAdmin(c);
    if (!userId) return c.json({ error: "Unauthorized" }, 401);
    if (!isDatabaseAvailable()) return c.json({ error: "DB unavailable" }, 503);
    try {
      const body = (await c.req.json()) as { decisionType?: string };
      if (!body.decisionType) {
        return c.json({ error: "decisionType required" }, 400);
      }
      // T3 implements agent_decision_graduations; fail soft if missing
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

  return router;
}
