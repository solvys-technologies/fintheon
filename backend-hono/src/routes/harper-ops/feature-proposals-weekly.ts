// [claude-code 2026-04-23] S31-T9 predictive knowledge graph + feature proposals
// Routine-secret-gated weekly trigger. Schedule: Sundays 6pm ET (see docs/routines/feature-proposals-weekly.md).
// Auth: header "X-Cron-Secret: $CRON_SECRET_TOKEN". Returns aggregate run stats.

import { Hono } from "hono";
import type { Context } from "hono";
import { runWeeklyProposer } from "../../services/knowledge-graph/proposer.js";

function authorize(c: Context): boolean {
  const expected = process.env.CRON_SECRET_TOKEN;
  if (!expected) {
    console.warn("[feature-proposals-weekly] CRON_SECRET_TOKEN not configured");
    return false;
  }
  const provided = c.req.header("X-Cron-Secret") || c.req.query("token");
  return provided === expected;
}

export function createFeatureProposalsWeeklyRoute(): Hono {
  const app = new Hono();

  app.post("/", async (c: Context) => {
    if (!authorize(c)) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    const result = await runWeeklyProposer();
    return c.json(result);
  });

  return app;
}
