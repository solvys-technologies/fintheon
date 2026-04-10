/**
 * AutoPilot Routes
 * Route registration for /api/autopilot endpoints
 * Phase 7 - v.5.11.1
 */

import { Hono } from "hono";
import {
  handleGenerateProposal,
  handleGetPendingProposals,
  handleGetProposal,
  handleAcknowledgeProposal,
  handleExecuteProposal,
  handleGetProposalHistory,
  handleExpireProposals,
} from "./handlers.js";
import {
  handleSignalIngest,
  handleGetSignals,
  handleAutopilotStatus,
} from "./signal-ingest.js";

export function createAutopilotRoutes(): Hono {
  const router = new Hono();

  // POST /api/autopilot/generate - Generate new proposal via agent pipeline
  router.post("/generate", handleGenerateProposal);

  // GET /api/autopilot/proposals - Get pending proposals
  router.get("/proposals", handleGetPendingProposals);

  // GET /api/autopilot/proposals/:id - Get specific proposal
  router.get("/proposals/:id", handleGetProposal);

  // POST /api/autopilot/acknowledge - Approve/reject proposal
  router.post("/acknowledge", handleAcknowledgeProposal);

  // POST /api/autopilot/execute - Execute approved proposal
  router.post("/execute", handleExecuteProposal);

  // GET /api/autopilot/history - Get proposal history
  router.get("/history", handleGetProposalHistory);

  // POST /api/autopilot/expire - Expire old proposals (cron endpoint)
  router.post("/expire", handleExpireProposals);

  // POST /api/autopilot/signal-ingest - Receive signal from QuantConnect/TradingView/manual
  router.post("/signal-ingest", handleSignalIngest);

  // GET /api/autopilot/signals - Recent signal log
  router.get("/signals", handleGetSignals);

  // GET /api/autopilot/status - Autopilot scheduler status
  router.get("/status", handleAutopilotStatus);

  return router;
}
