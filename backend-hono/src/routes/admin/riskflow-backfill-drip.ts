// [claude-code 2026-05-04] Admin controls for FinancialJuice slow-drip
// backfill (start/stop/status) used by Refinement UI.

import { Hono } from "hono";
import {
  getFinancialJuiceBackfillDripStatus,
  refreshFinancialJuiceRssConnection,
  runFinancialJuiceBackfillDripNow,
  startFinancialJuiceBackfillDrip,
  stopFinancialJuiceBackfillDrip,
} from "../../services/riskflow/financialjuice-backfill-drip.js";

export function createRiskFlowBackfillDripRoutes() {
  const router = new Hono();

  router.get("/backfill-drip/status", (c) => {
    return c.json({ ok: true, status: getFinancialJuiceBackfillDripStatus() });
  });

  router.post("/backfill-drip/start", (c) => {
    return c.json({ ok: true, status: startFinancialJuiceBackfillDrip() });
  });

  router.post("/backfill-drip/stop", (c) => {
    return c.json({ ok: true, status: stopFinancialJuiceBackfillDrip() });
  });

  router.post("/backfill-drip/run-now", async (c) => {
    const status = await runFinancialJuiceBackfillDripNow();
    return c.json({ ok: true, status });
  });

  router.post("/backfill-drip/refresh-rss", async (c) => {
    const result = await refreshFinancialJuiceRssConnection();
    const body = {
      ok: result.refreshed,
      result,
      status: getFinancialJuiceBackfillDripStatus(),
    };
    if (result.skipped) return c.json(body, 409);
    if (result.rateLimited) return c.json(body, 429);
    if (result.error) return c.json(body, 502);
    return c.json(body);
  });

  return router;
}
