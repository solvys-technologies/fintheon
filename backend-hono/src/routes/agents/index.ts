/**
 * Agent Routes
 * Route registration for /api/agents endpoints
 * Phase 6 - Day 25
 */

import { Hono } from "hono";
import {
  handleAnalyze,
  handleQuickAnalysis,
  handleGetReports,
  handleGetDebates,
  handleGetProposals,
  handleGetStatus,
  handleGetPerformance,
  handleGetPredictions,
} from "./handlers.js";

export function createAgentRoutes(): Hono {
  const router = new Hono();

  // POST /api/agents/analyze - Run full pipeline
  router.post("/analyze", handleAnalyze);

  // POST /api/agents/quick-analysis - Run analysts only
  router.post("/quick-analysis", handleQuickAnalysis);

  // GET /api/agents/reports - Get agent reports
  router.get("/reports", handleGetReports);

  // GET /api/agents/debates - Get debates
  router.get("/debates", handleGetDebates);

  // GET /api/agents/proposals - Get proposals
  router.get("/proposals", handleGetProposals);

  // GET /api/agents/status - Get pipeline status
  router.get("/status", handleGetStatus);

  // GET /api/agents/performance - Combined agent performance stats
  router.get("/performance", handleGetPerformance);

  // GET /api/agents/predictions - Tracked polymarket predictions
  router.get("/predictions", handleGetPredictions);

  return router;
}
