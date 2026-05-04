// [claude-code 2026-05-04] Admin controls for FinancialJuice slow-drip
// backfill (start/stop/status) used by Refinement UI.

import { Hono } from "hono";
import {
  getFinancialJuiceBackfillDripStatus,
  runFinancialJuiceBackfillDripNow,
  startFinancialJuiceBackfillDrip,
  stopFinancialJuiceBackfillDrip,
} from "../../services/riskflow/financialjuice-backfill-drip.js";

export function createRiskFlowBackfillDripRoutes() {
  const router = new Hono();

  router.get("/status", (c) => {
    return c.json({ ok: true, status: getFinancialJuiceBackfillDripStatus() });
  });

  router.post("/start", (c) => {
    return c.json({ ok: true, status: startFinancialJuiceBackfillDrip() });
  });

  router.post("/stop", (c) => {
    return c.json({ ok: true, status: stopFinancialJuiceBackfillDrip() });
  });

  router.post("/run-now", async (c) => {
    const status = await runFinancialJuiceBackfillDripNow();
    return c.json({ ok: true, status });
  });

  return router;
}
