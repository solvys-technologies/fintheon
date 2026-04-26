// [claude-code 2026-04-25] S40-P8: /api/earnings/* router.

import { Hono } from "hono";
import {
  handleRefreshEarnings,
  handleUpcomingEarnings,
} from "./handlers.js";

export function createEarningsRoutes(): Hono {
  const router = new Hono();
  router.get("/upcoming", handleUpcomingEarnings);
  router.post("/refresh", handleRefreshEarnings);
  return router;
}
