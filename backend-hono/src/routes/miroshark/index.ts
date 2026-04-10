// [claude-code 2026-03-28] S8-T5: Added deliberation, inject-take, officials routes
// [claude-code 2026-03-24] Persistence refactor: added GET /latest route
// [claude-code 2026-03-23] MiroShark simulation routes

import { Hono } from "hono";
import {
  handleSimulate,
  handleStatus,
  handleReport,
  handleInject,
  handleGetContext,
  handleGetHistory,
  handleGetLatest,
  handleRollingWindow,
  handleAutoRunCheck,
  handleRunningState,
  handleGetDeliberation,
  handleInjectTake,
  handleGetOfficials,
  handleGetAnalysts,
} from "./handlers.js";

export function createMirosharkRoutes(): Hono {
  const app = new Hono();

  app.post("/simulate", handleSimulate);
  app.get("/status/:id", handleStatus);
  app.get("/report/:id", handleReport);
  app.post("/inject/:id", handleInject);
  app.get("/context", handleGetContext);
  app.get("/latest", handleGetLatest);
  app.get("/history", handleGetHistory);
  app.get("/rolling-window", handleRollingWindow);
  app.get("/auto-run-check", handleAutoRunCheck);
  app.get("/running-state", handleRunningState);

  // Deliberation pipeline
  app.get("/deliberation/:id", handleGetDeliberation);
  app.post("/deliberation/:id/inject", handleInjectTake);
  app.get("/officials", handleGetOfficials);
  app.get("/analysts", handleGetAnalysts);

  return app;
}
