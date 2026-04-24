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
import { createAgentDeskRoutes } from "./agent-desk/index.js";
import { createERRoutes } from "./er/index.js";
import { createVoiceRoutes } from "./voice/index.js";
import { livekit } from "./livekit/index.js";
import { createRegimeRoutes } from "./regimes/index.js";
import { createMarketRegimeRoutes } from "./regime/index.js";
import { createLexiconRoutes } from "./lexicon/index.js";
import { createClassificationMatrixRoutes } from "./classification-matrix/index.js";

import { createVersionRoutes } from "./version/index.js";
import { createMarketDataRoutes } from "./market-data/index.js";
import { createSettingsRoutes } from "./settings/index.js";
import { createJournalRoutes } from "./journal/index.js";
import { createBlindspotsRoutes } from "./blindspots.js";
// [claude-code 2026-04-23] S31-T6 — user-scoped blindspots endpoints (auth-gated)
import { createBlindspotsUserRoutes } from "./blindspots-user.js";
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
// [claude-code 2026-04-19] v5.22 S1: shared cross-platform preferences
import { createPreferencesRoutes } from "./preferences/index.js";
import { createAuthCallbackRoute } from "./auth-callback.js";
import { createAuthRoutes } from "./auth/index.js";
import { createCommentatorRoutes } from "./commentator/index.js";
import { createSourceAccountRoutes } from "./source-accounts/index.js";
import { createEconFiltersRoutes } from "./econ-filters/index.js";
import { createCalibrationRoutes } from "./calibration/index.js";
import { createScoringRoutes } from "./scoring/index.js";
import { createHarperRoutes } from "./harper/index.js";
import { createHarperOpsRoutes } from "./harper-ops/index.js";
import { createOpsRoutes } from "./ops/index.js";
import { createEconRoutes } from "./econ/index.js";
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
import { createRelayQuickRoutes } from "./relay-quick.js";
import { createPreviewRoutes } from "./preview.js";
import { createWebPushRoutes } from "./web-push.js";
import { createOracleRoutes } from "./oracle.js";
import { createMeRoutes } from "./me/index.js";
import { createMaintenanceRoutes } from "./maintenance.js";
// [claude-code 2026-04-23] Routines Console retired — replaced by in-process schedulers + hooks.
// [claude-code 2026-04-20] S21: Harper Voice integration (formerly Omi) + PsychAssist fork admin
import { createHarperVoiceRoutes } from "./harper-voice.js";
import { createPsychAssistForkRoutes } from "./admin/psych-assist-fork.js";
// [claude-code 2026-04-23] Harper Vision — screen + audio perception layer
import { createHarperVisionRoutes } from "./harper-vision/index.js";
// [claude-code 2026-04-23] S31-T9 predictive knowledge graph — usage telemetry + Harper feature proposals
import { createUsageEventsRoutes } from "./usage-events.js";
import { createFeatureProposalsRoutes } from "./feature-proposals.js";
import { createFeatureProposalsWeeklyRoute } from "./harper-ops/feature-proposals-weekly.js";
// [S29-T4] Catalyst slide-out panel — date-filtered RiskFlow headlines
import { createCatalystsByDateRoute } from "./catalysts/by-date.js";
// [S29-T1] ProjectX trades history — calendar heatmap data layer
import { createProjectXTradesRoute } from "./projectx/trades.js";
// [claude-code 2026-04-23] S32-T7: Advisory layer — calendar pill, size hint, watchouts log.
import { createCalendarRoutes } from "./calendar/next-event.js";
import { createAdvisoryRoutes } from "./advisory/index.js";
import { createWatchoutsRoutes } from "./watchouts/index.js";

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
  // [S24-T1] /proposals subroute: agent proposals + TP approval queue.
  app.route("/api/regime", createMarketRegimeRoutes());
  // [S24-T1] Lexicon — agent-curated keyword → sentiment mapping (keywords + proposals)
  app.route("/api/lexicon", createLexiconRoutes());
  // [S24-T1] Classification matrix — regime → rubric (stance, entry/exit keywords, walk-back pairs)
  app.route("/api/classification-matrix", createClassificationMatrixRoutes());
  // Market data — Yahoo Finance quotes/VIX + Unusual Whales GEX/walls/flow (public)
  app.route("/api/market-data", createMarketDataRoutes());
  // Narrative scoring — LLM-scored catalyst candidates
  // [S36] cluster-summary is auth-gated; rest of the narrative router stays public-read.
  app.use("/api/narrative/cluster-summary", authMiddleware, requireAuth);
  app.route("/api/narrative", createNarrativeRoutes());
  // Blindspots — public, agent-controllable via ER monitoring
  app.route("/api/blindspots", createBlindspotsRoutes());
  // [S31-T6] Auth-gated, table-backed blindspots (psych + trading, per-user)
  app.use("/api/blindspots/psych", authMiddleware, requireAuth);
  app.use("/api/blindspots/trading", authMiddleware, requireAuth);
  app.use("/api/blindspots/latest", authMiddleware, requireAuth);
  app.route("/api/blindspots", createBlindspotsUserRoutes());
  // [S32-T7] Calendar countdown pill — public, always-on, independent of PsychAssist
  app.route("/api/calendar", createCalendarRoutes());
  // Systemic risk — public, read-only (causal chains, historical rhyming, FRED data)
  app.route("/api/systemic", systemicRoutes);
  // Context Bank — public, agents consume directly (unified snapshot + desk reports)
  app.route("/api/context-bank", createContextBankRoutes());
  // Agent Desk multi-agent simulation — feature-flagged via AGENT_DESK_ENABLED
  // [claude-code 2026-04-19] v5.22: dual-mount — /api/agent-desk is the new path,
  //   /api/miroshark kept as legacy alias for live clients mid-deploy.
  const agentDeskRoutes = createAgentDeskRoutes();
  app.route("/api/agent-desk", agentDeskRoutes);
  app.route("/api/miroshark", agentDeskRoutes);
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
  app.route("/api/econ-filters", createEconFiltersRoutes());
  // Calibration — scoring weight management, annotations, observations, bulk ingest (public, admin)
  app.route("/api/calibration", createCalibrationRoutes());
  // Scoring — V4 shadow stats + rescore-status [S24-T3]
  app.use("/api/scoring", authMiddleware, requireAuth);
  app.use("/api/scoring/*", authMiddleware, requireAuth);
  app.route("/api/scoring", createScoringRoutes());
  // Predictions — forward-looking instrument outlook from scored items + econ events
  app.route("/api/predictions", predictionsRoutes);
  // [S31-T9] Usage telemetry + Harper feature proposals (auth-gated)
  app.use("/api/usage-events", authMiddleware, requireAuth);
  app.use("/api/usage-events/*", authMiddleware, requireAuth);
  app.route("/api/usage-events", createUsageEventsRoutes());
  app.use("/api/feature-proposals", authMiddleware, requireAuth);
  app.use("/api/feature-proposals/*", authMiddleware, requireAuth);
  app.route("/api/feature-proposals", createFeatureProposalsRoutes());
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

  // [S25] Service-worker quick-action endpoint — no-auth, approval-id-as-secret.
  // Mounted OUTSIDE /api/relay so the authMiddleware wildcard doesn't block the SW's
  // lock-screen POST. Approval IDs (`approval-{ts}-{rand36}`) are unguessable within
  // the 10-min freshness window enforced inside the handler.
  app.route("/api/tool-decision-quick", createRelayQuickRoutes());

  // [S25] Public OG preview — allow-listed domains only. Served unauthenticated so the
  // mobile EmbedPreview can render even before Supabase token is hydrated on cold start.
  app.route("/api/preview", createPreviewRoutes());

  // [S26-P2 T9] Maintenance — super-admin commit/deploy/deny for agent-proposed fixes.
  // GET /api/maintenance/request/:id is public (modal renders for anyone), POST
  // /api/maintenance/decision is gated inside the handler (returns 401 unauthed /
  // 403 non-admin). optional-auth middleware fills userId when the JWT is present.
  app.use("/api/maintenance", authMiddleware);
  app.use("/api/maintenance/*", authMiddleware);
  app.route("/api/maintenance", createMaintenanceRoutes());
  // Harper — Claude CLI chat via SDK bridge (public, local-only)
  app.route("/api/harper", createHarperRoutes());
  // [claude-code 2026-04-23] S31-T9 predictive knowledge graph — Routine-secret-gated
  // weekly proposer trigger. Mounted BEFORE the harper-ops catch-all so the more
  // specific path wins.
  app.route(
    "/api/harper-ops/feature-proposals-weekly",
    createFeatureProposalsWeeklyRoute(),
  );
  // Harper Ops — autonomous loop monitoring + control (public, local-only)
  app.route("/api/harper-ops", createHarperOpsRoutes());
  // Aquarium ops — context audit badges + groupthink guard (Track 7b)
  app.route("/api/ops", createOpsRoutes());
  // Econ Intelligence — event cards, filters, KPI/instrument fuses (Track 4a/4b)
  app.route("/api/econ", createEconRoutes());
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
  // [claude-code 2026-04-19] v5.22 S1: shared cross-platform preferences — theme,
  //   traderName, notifications, fuse palette overrides (reusable by mobile).
  app.use("/api/preferences", authMiddleware, requireAuth);
  app.use("/api/preferences/*", authMiddleware, requireAuth);
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

  // v5.22 S1: cross-platform preferences (theme, notifications, fuse palette)
  app.route("/api/preferences", createPreferencesRoutes());

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

  // [S21] Harper Voice integration — webhooks are public (uid-param auth),
  //   session + pair endpoints are authMiddleware+requireAuth (inside the router).
  app.route("/api/harper-voice", createHarperVoiceRoutes());

  // [claude-code 2026-04-23] Harper Vision — screen + audio perception layer
  // Frame ingestion is public (Electron main process posts directly),
  // retrieval and scene building require auth.
  app.route("/api/harper-vision", createHarperVisionRoutes());

  // [S21-T5] PsychAssist fork admin — gated on psych_assist_fork.edit
  //   per-user override. Reasoning@pricedinresearch.io is seeded with access.
  app.use("/api/admin/psych-assist-fork", authMiddleware, requireAuth);
  app.use("/api/admin/psych-assist-fork/*", authMiddleware, requireAuth);
  app.route("/api/admin/psych-assist-fork", createPsychAssistForkRoutes());

  // [S29-T4] Catalysts — date-filtered RiskFlow headlines for calendar panel
  app.route("/api/catalysts", createCatalystsByDateRoute());

  // [S29-T1] ProjectX trades history — public (BYPASS_AUTH compatible)
  app.route("/api/projectx", createProjectXTradesRoute());
}
