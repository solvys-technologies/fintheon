// [claude-code 2026-03-26] S2-T2: Market regime CRUD routes
import { Hono } from "hono";
import {
  handleGetCurrent,
  handleGetHistory,
  handleSetRegime,
  handleDetect,
  handleConfidence,
} from "./handlers.js";

export function createMarketRegimeRoutes(): Hono {
  const app = new Hono();

  app.get("/current", handleGetCurrent);
  app.get("/history", handleGetHistory);
  app.post("/set", handleSetRegime);
  app.post("/detect", handleDetect);
  app.post("/confidence", handleConfidence);

  return app;
}
