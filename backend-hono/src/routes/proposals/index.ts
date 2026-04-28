// [claude-code 2026-03-20] T5b: Proposal charting routes
// [claude-code 2026-04-28] S47-T2: Added resolution + performance subroutes.
import { Hono } from "hono";
import { handleChartProposal } from "./handlers.js";
import { createProposalResolutionRoutes } from "./resolution.js";

export function createProposalRoutes(): Hono {
  const app = new Hono();

  // POST /chart — check blackout, spawn Playwright charting script
  app.post("/chart", handleChartProposal);

  // POST /resolve — record proposal/trade outcome for agent performance
  // GET  /performance — aggregated agent performance stats
  app.route("/", createProposalResolutionRoutes());

  return app;
}
