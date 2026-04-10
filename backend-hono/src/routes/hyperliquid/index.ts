// [claude-code 2026-03-13] Hyperliquid route registration
/**
 * Hyperliquid Routes
 * Route registration for /api/hyperliquid endpoints
 */

import { Hono } from "hono";
import {
  handleGetStatus,
  handleGetPositions,
  handleGetAccountInfo,
} from "./handlers.js";

export function createHyperliquidRoutes(): Hono {
  const router = new Hono();
  router.get("/status", handleGetStatus);
  router.get("/positions", handleGetPositions);
  router.get("/account", handleGetAccountInfo);
  return router;
}
