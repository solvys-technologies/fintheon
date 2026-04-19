// [claude-code 2026-04-19] Routines Console — route registration

import { Hono } from "hono";
import {
  handleGetRoutine,
  handleListRoutines,
  handlePause,
  handlePendingApprovals,
  handleRerun,
  handleResolveApproval,
  handleSetMode,
} from "./handlers.js";

export function createRoutinesRoutes(): Hono {
  const app = new Hono();

  app.get("/", handleListRoutines);
  app.get("/approvals/pending", handlePendingApprovals);
  app.post("/approvals/:id/:action", handleResolveApproval);
  app.get("/:id", handleGetRoutine);
  app.put("/:id/mode", handleSetMode);
  app.post("/:id/pause", handlePause);
  app.post("/:id/rerun", handleRerun);

  return app;
}
