// [claude-code 2026-04-28] S48-T1: Admin pipeline stats route.
//   GET /api/admin/pipeline-stats?hours=24 → per-pipeline headline count,
//   errors, last success, uptime %. Gate: super-admin (applied in routes/index.ts).

import { Hono } from "hono";
import { computePipelineStats } from "../../services/riskflow/pipeline-stats.js";

const app = new Hono();

// GET /api/admin/pipeline-stats?hours=24
app.get("/", async (c) => {
  const hoursParam = c.req.query("hours") ?? "24";
  const hours = parseInt(hoursParam, 10);
  if (isNaN(hours) || hours < 1 || hours > 720) {
    return c.json({ error: "hours must be 1–720" }, 400);
  }

  const stats = await computePipelineStats(hours);
  return c.json({ stats, hours, computed_at: new Date().toISOString() });
});

export function createPipelineStatsRoutes(): Hono {
  return app;
}
