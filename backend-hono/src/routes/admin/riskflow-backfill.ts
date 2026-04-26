// [claude-code 2026-04-26] S35-cleanup: admin route to backfill RiskFlow
// high/critical headlines for windows where the news-worker stalled. Gated on
// x-routine-secret matching ROUTINE_SECRET.
//
// POST /api/admin/riskflow/backfill-headlines
//   body: { from: "2026-04-04", to: "2026-04-05", queries?: string[] }
//   Returns { ok, days, exaHits, rawWritten, scoringCycles, scoredWritten }.

import { Hono } from "hono";
import { backfillRiskFlowHeadlines } from "../../services/riskflow/backfill-headlines.js";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function createRiskFlowBackfillRoutes() {
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

  router.post("/backfill-headlines", async (c) => {
    let body: { from?: unknown; to?: unknown; queries?: unknown } = {};
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "invalid_json" }, 400);
    }

    const from = typeof body.from === "string" ? body.from : "";
    const to = typeof body.to === "string" ? body.to : "";
    if (!ISO_DATE.test(from) || !ISO_DATE.test(to)) {
      return c.json({ error: "from/to must be YYYY-MM-DD" }, 400);
    }
    if (from > to) {
      return c.json({ error: "from must be <= to" }, 400);
    }

    const queries = Array.isArray(body.queries)
      ? (body.queries as unknown[])
          .filter((q): q is string => typeof q === "string" && q.length > 0)
          .slice(0, 25)
      : undefined;

    const result = await backfillRiskFlowHeadlines({ from, to, queries });
    return c.json({ ok: true, ...result });
  });

  return router;
}
