/**
 * Trading Routes
 * Route registration for /api/trading endpoints
 */

import { Hono } from "hono";
import {
  handleGetPositions,
  handleToggleAlgo,
  handleGetAlgoStatus,
  handleTestTrade,
  handleGetBridgePositions,
  handleGetBridgeAccount,
  handleCancelOrder,
  handleGetReconcilerStatus,
  handleGetTradeRuns,
} from "./handlers.js";

export function createTradingRoutes(): Hono {
  const router = new Hono();

  // GET /api/trading/positions - List user positions
  router.get("/positions", handleGetPositions);

  // GET /api/trading/algo-status - Get algo trading status
  router.get("/algo-status", handleGetAlgoStatus);

  // POST /api/trading/toggle-algo - Toggle algo trading
  router.post("/toggle-algo", handleToggleAlgo);

  // POST /api/trading/test-trade - Fire 1-contract market order via ProjectX
  router.post("/test-trade", handleTestTrade);

  // GET /api/trading/bridge-positions - Real positions from ProjectX bridge
  router.get("/bridge-positions", handleGetBridgePositions);

  // GET /api/trading/bridge-account - Real account from ProjectX bridge
  router.get("/bridge-account", handleGetBridgeAccount);

  // POST /api/trading/cancel-order - Cancel an open order
  router.post("/cancel-order", handleCancelOrder);

  // GET /api/trading/reconciler-status - Current reconciler state
  router.get("/reconciler-status", handleGetReconcilerStatus);

  // GET /api/trading/trade-runs - Recent trade runs with enriched metadata
  router.get("/trade-runs", handleGetTradeRuns);

  return router;
}
