/**
 * Route Aggregation
 * Central registration of all API routes
 */

import type { Hono } from "hono";
import { authMiddleware, requireAuth } from "../middleware/auth.js";
import { createAccountRoutes } from "./account/index.js";
import { createMarketRoutes } from "./market/index.js";
import { createNotificationRoutes } from "./notifications/index.js";
import { createTradingRoutes } from "./trading/index.js";
import { createRiskFlowRoutes } from "./riskflow/index.js";
import { createPsychAssistRoutes } from "./psych-assist.js";
import { createAiRoutes } from "./ai/index.js";
import { createAgentRoutes } from "./agents/index.js";
import { createBoardroomRoutes } from "./boardroom/index.js";
import { createRithmicRoutes } from "./rithmic/index.js";
import { createHyperliquidRoutes } from "./hyperliquid/index.js";
import { createDataRoutes } from "./data/index.js";
import { createNarrativeRoutes } from "./narrative/index.js";
import { createMirosharkRoutes } from "./miroshark/index.js";
import { createERRoutes } from "./er/index.js";
import { createVoiceRoutes } from "./voice/index.js";
import { livekit } from "./livekit/index.js";
import { createRegimeRoutes } from "./regimes/index.js";
import { createMarketRegimeRoutes } from "./regime/index.js";

import { createVersionRoutes } from "./version/index.js";
import { createMarketDataRoutes } from "./market-data/index.js";
import { createSettingsRoutes } from "./settings/index.js";
import { createJournalRoutes } from "./journal/index.js";
import { createBlindspotsRoutes } from "./blindspots.js";
import { systemic as systemicRoutes } from "./systemic/index.js";
import { createContextBankRoutes } from "./context-bank/index.js";
import { createAutopilotRoutes } from "./autopilot/index.js";
import { createProposalRoutes } from "./proposals/index.js";
import cloudRoutes from "./cloud/index.js";
import { createDiagnosticsRoutes } from "./diagnostics/index.js";
import { createTerminalRoutes } from "./terminal/index.js";
import { createSetupRoutes } from "./setup/index.js";
import { createTradeIdeasRoutes } from "./trade-ideas/index.js";
import { createProfileRoutes } from "./profile/index.js";
import { createAuthCallbackRoute } from "./auth-callback.js";
import { createAuthRoutes } from "./auth/index.js";
import { createCommentatorRoutes } from "./commentator/index.js";
import { createSourceAccountRoutes } from "./source-accounts/index.js";
import { createCalibrationRoutes } from "./calibration/index.js";
import { createHarperRoutes } from "./harper/index.js";
import { createHarperOpsRoutes } from "./harper-ops/index.js";
import { createOpsRoutes } from "./ops/index.js";
import { createPeersRoutes } from "./peers/index.js";
import predictionsRoutes from "./predictions.js";
import { createDocumentRoutes } from "./documents/index.js";
import { createResearchRoutes } from "./research/index.js";
import { createBulletinRoutes } from "./bulletin/index.js";
import { createStickyBulletinRoutes } from "./sticky-bulletin/index.js";
import { createSkillsRoutes } from "./skills/index.js";
import { createMemoryRoutes } from "./memory/index.js";
import { createEditorRoutes } from "./editor/index.js";
import { createMcpRoutes } from "./mcp/index.js";
import { createDagRoutes } from "./dag/index.js";
import { createDreamRoutes } from "./agent-bus/dreams.js";
import { createPolymarketRoutes } from "./polymarket/index.js";
import { createRelayRoutes } from "./relay.js";
import { createWebPushRoutes } from "./web-push.js";
import { createOracleRoutes } from "./oracle.js";
import { createMeRoutes } from "./me/index.js";

export function registerRoutes(app: Hono): void {
  // Public routes (no auth required)
  // Diagnostics — service status, missing env vars, suggested fixes
  app.route("/api/diagnostics", createDiagnosticsRoutes());
  // Terminal — local-dev shell execution (localhost guard inside handler)
  app.route("/api/terminal", createTerminalRoutes());
  // Setup — CLI onboarding welcome endpoint (localhost guard inside handler)
  app.route("/api/setup", createSetupRoutes());
  // Version check (public, used by auto-update prompt)
  app.route("/api/version", createVersionRoutes());
  // Phase 2: Market routes - VIX is public
  app.route("/api/market", createMarketRoutes());
  app.route("/api/boardroom", createBoardroomRoutes());
  // Data routes — Supabase-backed (replaces Notion polling routes)
  app.route("/api/data", createDataRoutes());

  // Regime tracker — public, returns active trading regimes (session-based time windows)
  app.route("/api/regimes", createRegimeRoutes());
  // Market regime engine — public, macro regime classification (CRUD + detect)
  app.route("/api/regime", createMarketRegimeRoutes());
  // Market data — Yahoo Finance quotes/VIX + Unusual Whales GEX/walls/flow (public)
  app.route("/api/market-data", createMarketDataRoutes());
  // Narrative scoring — LLM-scored catalyst candidates
  app.route("/api/narrative", createNarrativeRoutes());
  // Blindspots — public, agent-controllable via ER monitoring
  app.route("/api/blindspots", createBlindspotsRoutes());
  // Systemic risk — public, read-only (causal chains, historical rhyming, FRED data)
  app.route("/api/systemic", systemicRoutes);
  // Context Bank — public, agents consume directly (unified snapshot + desk reports)
  app.route("/api/context-bank", createContextBankRoutes());
  // MiroShark multi-agent simulation — feature-flagged via MIROSHARK_ENABLED
  app.route("/api/miroshark", createMirosharkRoutes());
  // DAG scheduler — status, SSE stream, cancel (S8-T2)
  app.route("/api/dag", createDagRoutes());
  // Agent Dream Room — autonomous agent reflection channel
  app.route("/api/agent-bus/dreams", createDreamRoutes());
  // Proposal charting — Playwright automation for TopStepX (public, local only)
  app.route("/api/proposals", createProposalRoutes());
  // Trade ideas — merged proposals + Supabase trade ideas (public)
  app.route("/api/trade-ideas", createTradeIdeasRoutes());
  // Commentator registry — speaker tagging, tier management (public, admin CRUD)
  app.route("/api/commentator", createCommentatorRoutes());
  // Source accounts — curated X account management for timeline polling (public, admin CRUD)
  app.route("/api/source-accounts", createSourceAccountRoutes());
  // Calibration — scoring weight management, annotations, observations, bulk ingest (public, admin)
  app.route("/api/calibration", createCalibrationRoutes());
  // Predictions — forward-looking instrument outlook from scored items + econ events
  app.route("/api/predictions", predictionsRoutes);
  // Polymarket — read-only public market data, whale alerts, search (S15-T2)
  app.route("/api/polymarket", createPolymarketRoutes());
  // Oracle — scheduled research findings, manual trigger (S20-T3)
  // Auth required: manual trigger hits external Polymarket/Kalshi APIs + inserts
  // into oracle_research_findings, so unauthenticated access enables cost
  // amplification + data pollution.
  app.use("/api/oracle", authMiddleware, requireAuth);
  app.use("/api/oracle/*", authMiddleware, requireAuth);
  app.route("/api/oracle", createOracleRoutes());
  // Relay — mobile↔local backend WebSocket bridge (auth required for chat/health, WS upgrade handled separately)
  app.use("/api/relay", authMiddleware);
  app.use("/api/relay/*", authMiddleware);
  app.route("/api/relay", createRelayRoutes());
  // Harper — Claude CLI chat via SDK bridge (public, local-only)
  app.route("/api/harper", createHarperRoutes());
  // Harper Ops — autonomous loop monitoring + control (public, local-only)
  app.route("/api/harper-ops", createHarperOpsRoutes());

  app.route("/api/ops", createOpsRoutes());
  // MCP registry — live read/write of ~/.claude/mcp.json (public, local-only)
  app.route("/api/mcp", createMcpRoutes());

  // Supabase OAuth callback relay — serves HTML that deep-links back to Electron
  app.route("/api/auth/supabase", createAuthCallbackRoute());
  // Claude peers auth utility routes (login/me/admin role)
  app.route("/api/auth", createAuthRoutes());

  // Cloud API — Supabase-backed scored items, ER sessions, settings, consilium
  app.route("/api/cloud", cloudRoutes);

  // Autopilot — signal-ingest/status/signals are public (QC/TV webhooks), proposal mgmt needs auth
  app.use("/api/autopilot/proposals", authMiddleware, requireAuth);
  app.use("/api/autopilot/proposals/*", authMiddleware, requireAuth);
  app.use("/api/autopilot/acknowledge", authMiddleware, requireAuth);
  app.use("/api/autopilot/execute", authMiddleware, requireAuth);
  app.use("/api/autopilot/history", authMiddleware, requireAuth);
  app.route("/api/autopilot", createAutopilotRoutes());

  // Optional auth — sets user context if token present, anonymous if not
  // All routes below get user identity when available
  app.use("/api/notifications", authMiddleware);
  app.use("/api/notifications/*", authMiddleware);
  app.use("/api/riskflow", authMiddleware);
  app.use("/api/riskflow/*", authMiddleware);
  app.use("/api/psych", authMiddleware);
  app.use("/api/psych/*", authMiddleware);
  app.use("/api/ai", authMiddleware);
  app.use("/api/ai/*", authMiddleware);
  app.use("/api/agents", authMiddleware);
  app.use("/api/agents/*", authMiddleware);
  app.use("/api/er", authMiddleware);
  app.use("/api/er/*", authMiddleware);

  // Hard auth required — these endpoints MUST have a verified identity
  app.use("/api/account", authMiddleware, requireAuth);
  app.use("/api/account/*", authMiddleware, requireAuth);
  app.use("/api/trading", authMiddleware, requireAuth);
  app.use("/api/trading/*", authMiddleware, requireAuth);
  app.use("/api/rithmic", authMiddleware, requireAuth);
  app.use("/api/rithmic/*", authMiddleware, requireAuth);
  app.use("/api/hyperliquid", authMiddleware, requireAuth);
  app.use("/api/hyperliquid/*", authMiddleware, requireAuth);
  app.use("/api/voice", authMiddleware, requireAuth);
  app.use("/api/voice/*", authMiddleware, requireAuth);
  app.use("/api/settings", authMiddleware, requireAuth);
  app.use("/api/settings/*", authMiddleware, requireAuth);
  app.use("/api/profile", authMiddleware, requireAuth);
  app.use("/api/profile/*", authMiddleware, requireAuth);
  // [S23-T4] /api/me — client identity diagnostic for cross-device account debugging.
  app.use("/api/me", authMiddleware, requireAuth);
  app.use("/api/me/*", authMiddleware, requireAuth);
  app.use("/api/peers", authMiddleware, requireAuth);
  app.use("/api/peers/*", authMiddleware, requireAuth);
  app.use("/api/documents", authMiddleware, requireAuth);
  app.use("/api/documents/*", authMiddleware, requireAuth);
  app.use("/api/bulletin", authMiddleware, requireAuth);
  app.use("/api/bulletin/*", authMiddleware, requireAuth);
  app.use("/api/sticky-bulletin", authMiddleware, requireAuth);
  app.use("/api/sticky-bulletin/*", authMiddleware, requireAuth);
  // Journal — public (local Electron app, no user auth needed)

  // Phase 1: Account routes
  app.route("/api/account", createAccountRoutes());

  // Phase 2: Notification routes
  app.route("/api/notifications", createNotificationRoutes());

  // Web push subscription management (T7)
  app.use("/api/notifications/web-push", authMiddleware, requireAuth);
  app.use("/api/notifications/web-push/*", authMiddleware, requireAuth);
  app.route("/api/notifications/web-push", createWebPushRoutes());

  // Phase 2: Trading routes
  app.route("/api/trading", createTradingRoutes());

  // Rithmic routes (Autopilot primary broker scaffold)
  app.route("/api/rithmic", createRithmicRoutes());

  // Hyperliquid DEX routes (perpetual futures)
  app.route("/api/hyperliquid", createHyperliquidRoutes());

  // Phase 4: RiskFlow routes
  app.route("/api/riskflow", createRiskFlowRoutes());

  // Psych assist routes (existing)
  app.route("/api/psych", createPsychAssistRoutes());

  // Phase 5: AI routes
  app.route("/api/ai", createAiRoutes());

  // Phase 6: Agent routes
  app.route("/api/agents", createAgentRoutes());

  // ER telemetry routes
  app.route("/api/er", createERRoutes());

  // Voice assistant routes
  app.route("/api/voice", createVoiceRoutes());

  // LiveKit group voice call token generation
  app.route("/api/livekit", livekit);

  // User settings persistence
  app.route("/api/settings", createSettingsRoutes());

  // User profiles + app state (localStorage migration target)
  app.route("/api/profile", createProfileRoutes());

  // [S23-T4] /api/me — diagnostic: { userId, email, traderName }
  app.route("/api/me", createMeRoutes());

  // Claude peers: registry, desks, heartbeat, group voice room
  app.route("/api/peers", createPeersRoutes());

  // Trading journal (human psych + agent performance)
  app.route("/api/journal", createJournalRoutes());

  // Documents — TipTap editor CRUD (S12-T2)
  app.route("/api/documents", createDocumentRoutes());

  // Bulletin board — peer trade ideas + voting (S12-T1)
  app.route("/api/bulletin", createBulletinRoutes());

  // Sticky bulletin — personal trade notes, antilag times, event of week
  app.route("/api/sticky-bulletin", createStickyBulletinRoutes());

  // Skills — Claude Computer Use trade plan generation (S13-T2)
  app.use("/api/skills", authMiddleware, requireAuth);
  app.use("/api/skills/*", authMiddleware, requireAuth);
  app.route("/api/skills", createSkillsRoutes());

  // Research task board — kanban-style deep-dive tracker (S12-T3)
  app.use("/api/research", authMiddleware, requireAuth);
  app.use("/api/research/*", authMiddleware, requireAuth);
  app.route("/api/research", createResearchRoutes());

  // Shared memory — team-level KV store + analysis history FTS (S13-T3)
  app.use("/api/memory", authMiddleware, requireAuth);
  app.use("/api/memory/*", authMiddleware, requireAuth);
  app.route("/api/memory", createMemoryRoutes());

  // Editor sidebar — agentic actions for document enrichment (S13-T3)
  app.use("/api/editor", authMiddleware, requireAuth);
  app.use("/api/editor/*", authMiddleware, requireAuth);
  app.route("/api/editor", createEditorRoutes());
}
