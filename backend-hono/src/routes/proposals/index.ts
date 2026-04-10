// [claude-code 2026-03-20] T5b: Proposal charting routes
import { Hono } from "hono";
import { handleChartProposal } from "./handlers.js";

export function createProposalRoutes(): Hono {
  const app = new Hono();

  // POST /chart — check blackout, spawn Playwright charting script
  app.post("/chart", handleChartProposal);

  return app;
}
