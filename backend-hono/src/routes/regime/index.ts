// [claude-code 2026-04-19] S24-T1: mount /proposals subrouter for V4 regime proposal queue.
// [claude-code 2026-03-26] S2-T2: Market regime CRUD routes
// [claude-code 2026-05-16] DEPRECATED — replaced by themes route (S68-T1). Preserved for migration reference.
import { Hono } from "hono";
import {
  handleGetCurrent,
  handleGetHistory,
  handleSetRegime,
  handleDetect,
  handleConfidence,
} from "./handlers.js";
import { createRegimeProposalRoutes } from "./proposals.js";

export function createMarketRegimeRoutes(): Hono {
  const app = new Hono();

  app.get("/current", handleGetCurrent);
  app.get("/history", handleGetHistory);
  app.post("/set", handleSetRegime);
  app.post("/detect", handleDetect);
  app.post("/confidence", handleConfidence);

  // V4 proposals: /api/regime/proposals
  app.route("/proposals", createRegimeProposalRoutes());

  return app;
}
