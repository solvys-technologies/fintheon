// [claude-code 2026-04-25] S35-cleanup: manual trigger for econ-backfill-orchestrator.
// POST /api/admin/econ/backfill-tick — drains SLICES_PER_TICK pending slices.
// POST /api/admin/econ/backfill-drain { maxTicks?: number } — runs ticks in a
// loop until pending slices are exhausted or the cap is hit. Gated on
// x-routine-secret matching ROUTINE_SECRET so the same secret fronts every
// admin econ debug surface.

import { Hono } from "hono";
import { runBackfillTickOnce } from "../../services/cron/econ-backfill-orchestrator.js";
import { createLogger } from "../../lib/logger.js";

const log = createLogger("EconBackfillAdmin");

const MAX_TICKS_HARD_CAP = 25;

export function createEconBackfillRoutes() {
  const router = new Hono();

  router.use("*", async (c, next) => {
    const secret = process.env.ROUTINE_SECRET;
    if (!secret) {
      return c.json({ error: "ROUTINE_SECRET not configured" }, 503);
    }
    if (c.req.header("x-routine-secret") !== secret) {
      return c.json({ error: "unauthorized" }, 401);
    }
    await next();
  });

  router.post("/backfill-tick", async (c) => {
    const result = await runBackfillTickOnce();
    return c.json({ ok: true, ...result });
  });

  router.post("/backfill-drain", async (c) => {
    let body: { maxTicks?: unknown } = {};
    try {
      body = await c.req.json();
    } catch {
      // empty body OK
    }
    const requested =
      typeof body.maxTicks === "number" && Number.isFinite(body.maxTicks)
        ? Math.floor(body.maxTicks)
        : 8;
    const cap = Math.max(1, Math.min(requested, MAX_TICKS_HARD_CAP));

    let ticks = 0;
    let totalProcessed = 0;
    let totalFailed = 0;
    while (ticks < cap) {
      const tick = await runBackfillTickOnce();
      ticks++;
      totalProcessed += tick.processed;
      totalFailed += tick.failed;
      if (tick.processed === 0 && tick.failed === 0) break;
    }

    log.info("Backfill drain complete", {
      ticks,
      totalProcessed,
      totalFailed,
    });
    return c.json({ ok: true, ticks, totalProcessed, totalFailed });
  });

  return router;
}
