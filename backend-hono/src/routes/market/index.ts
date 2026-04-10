// [claude-code 2026-03-09] Added IV scoring replay route
/**
 * Market Routes
 * Route registration for /api/market endpoints
 */

import { Hono } from "hono";
import {
  handleGetVix,
  handleGetQuote,
  handleIVScoringReplay,
} from "./handlers.js";

export function createMarketRoutes(): Hono {
  const router = new Hono();

  // GET /api/market/vix - Get current VIX value
  router.get("/vix", handleGetVix);

  // GET /api/market/quotes/:symbol - Get quote for symbol (future)
  router.get("/quotes/:symbol", handleGetQuote);

  // POST /api/market/iv-scoring/replay - Replay IV scoring with config overrides
  router.post("/iv-scoring/replay", handleIVScoringReplay);

  return router;
}
