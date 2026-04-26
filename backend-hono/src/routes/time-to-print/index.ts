// [claude-code 2026-04-25] S40-P6: /api/time-to-print/* — public reads
// (lookahead is UI content). The TTP SSE event flows on /api/riskflow/stream.

import { Hono } from "hono";
import type { Context } from "hono";
import { getNextEligibleEvents } from "../../services/time-to-print/eligibility.js";

export function createTimeToPrintRoutes(): Hono {
  const router = new Hono();

  router.get("/next", async (c: Context) => {
    const window = parseInt(c.req.query("windowMinutes") ?? "5", 10);
    const country = (c.req.query("country") ?? "US").toUpperCase();
    const events = await getNextEligibleEvents({
      windowMinutes: Number.isFinite(window) ? window : 5,
      country,
    });
    return c.json({
      events,
      asOf: new Date().toISOString(),
      windowMinutes: window,
      country,
    });
  });

  return router;
}
