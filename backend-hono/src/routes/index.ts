/**
 * Route Aggregation
 * Central registration of all API routes
 */

import type { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth.js';
import { createAccountRoutes } from './account/index.js';
import { createMarketRoutes } from './market/index.js';
import { createNotificationRoutes } from './notifications/index.js';
import { createTradingRoutes } from './trading/index.js';
import { createRiskFlowRoutes } from './riskflow/index.js';
import { createPsychAssistRoutes } from './psych-assist.js';
import { createAiRoutes } from './ai/index.js';
import { createAgentRoutes } from './agents/index.js';
import { createBoardroomRoutes } from './boardroom/index.js';
import { createRithmicRoutes } from './rithmic/index.js';
import { createHyperliquidRoutes } from './hyperliquid/index.js';
import { createDataRoutes } from './data/index.js';
import { createNarrativeRoutes } from './narrative/index.js';
import { createMirofishRoutes } from './mirofish/index.js';
import { createERRoutes } from './er/index.js';
import { createVoiceRoutes } from './voice/index.js';
import { createRegimeRoutes } from './regimes/index.js';

import { createVersionRoutes } from './version/index.js';
import { createMarketDataRoutes } from './market-data/index.js';
import { createSettingsRoutes } from './settings/index.js';
import { createJournalRoutes } from './journal/index.js';
import { createBlindspotsRoutes } from './blindspots.js';
import { systemic as systemicRoutes } from './systemic/index.js';
import { createContextBankRoutes } from './context-bank/index.js';
import { createAutopilotRoutes } from './autopilot/index.js';
import { createProposalRoutes } from './proposals/index.js';
import cloudRoutes from './cloud/index.js';
import { createDiagnosticsRoutes } from './diagnostics/index.js';
import { createTerminalRoutes } from './terminal/index.js';

export function registerRoutes(app: Hono): void {
  // Public routes (no auth required)
  // Diagnostics — service status, missing env vars, suggested fixes
  app.route('/api/diagnostics', createDiagnosticsRoutes());
  // Terminal — local-dev shell execution (localhost guard inside handler)
  app.route('/api/terminal', createTerminalRoutes());
  // Version check (public, used by auto-update prompt)
  app.route('/api/version', createVersionRoutes());
  // Phase 2: Market routes - VIX is public
  app.route('/api/market', createMarketRoutes());
  app.route('/api/boardroom', createBoardroomRoutes());
  // Data routes — Supabase-backed (replaces Notion polling routes)
  app.route('/api/data', createDataRoutes());
  // Legacy /api/notion/* aliases → redirect to /api/data/* for one sprint
  app.all('/api/notion/*', (c) => {
    const suffix = c.req.path.replace('/api/notion', '/api/data');
    const query = c.req.url.includes('?') ? '?' + c.req.url.split('?')[1] : '';
    return c.redirect(suffix + query, 301);
  });
  // Regime tracker — public, returns active trading regimes
  app.route('/api/regimes', createRegimeRoutes());
  // Market data — Yahoo Finance quotes/VIX + Unusual Whales GEX/walls/flow (public)
  app.route('/api/market-data', createMarketDataRoutes());
  // Narrative scoring — LLM-scored catalyst candidates
  app.route('/api/narrative', createNarrativeRoutes());
  // Blindspots — public, agent-controllable via ER monitoring
  app.route('/api/blindspots', createBlindspotsRoutes());
  // Systemic risk — public, read-only (causal chains, historical rhyming, FRED data)
  app.route('/api/systemic', systemicRoutes);
  // Context Bank — public, agents consume directly (unified snapshot + desk reports)
  app.route('/api/context-bank', createContextBankRoutes());
  // MiroFish multi-agent simulation — feature-flagged via MIROFISH_ENABLED
  app.route('/api/mirofish', createMirofishRoutes());
  // Proposal charting — Playwright automation for TopStepX (public, local only)
  app.route('/api/proposals', createProposalRoutes());

  // Cloud API — Supabase-backed scored items, ER sessions, settings, consilium
  app.route('/api/cloud', cloudRoutes);

  // Autopilot — signal-ingest/status/signals are public (QC/TV webhooks), proposal mgmt needs auth
  app.use('/api/autopilot/proposals', authMiddleware);
  app.use('/api/autopilot/proposals/*', authMiddleware);
  app.use('/api/autopilot/acknowledge', authMiddleware);
  app.use('/api/autopilot/execute', authMiddleware);
  app.use('/api/autopilot/history', authMiddleware);
  app.route('/api/autopilot', createAutopilotRoutes());

  // Protected routes (auth required) — use base path so exact path (e.g. GET /api/account) is covered
  app.use('/api/account', authMiddleware);
  app.use('/api/account/*', authMiddleware);
  app.use('/api/notifications', authMiddleware);
  app.use('/api/notifications/*', authMiddleware);
  app.use('/api/trading', authMiddleware);
  app.use('/api/trading/*', authMiddleware);
  app.use('/api/rithmic', authMiddleware);
  app.use('/api/rithmic/*', authMiddleware);
  app.use('/api/hyperliquid', authMiddleware);
  app.use('/api/hyperliquid/*', authMiddleware);
  // RiskFlow routes - exclude cron endpoint from auth
  const riskflowAuth = async (c: Parameters<typeof authMiddleware>[0], next: Parameters<typeof authMiddleware>[1]) => {
    if (c.req.path.includes('/cron/')) {
      return next();
    }
    return authMiddleware(c, next);
  };
  app.use('/api/riskflow', riskflowAuth);
  app.use('/api/riskflow/*', riskflowAuth);
  app.use('/api/psych', authMiddleware);
  app.use('/api/psych/*', authMiddleware);
  app.use('/api/ai', authMiddleware);
  app.use('/api/ai/*', authMiddleware);
  app.use('/api/agents', authMiddleware);
  app.use('/api/agents/*', authMiddleware);
  app.use('/api/er', authMiddleware);
  app.use('/api/er/*', authMiddleware);
  app.use('/api/voice', authMiddleware);
  app.use('/api/voice/*', authMiddleware);
  app.use('/api/settings', authMiddleware);
  app.use('/api/settings/*', authMiddleware);
  // Journal — public (local Electron app, no user auth needed)

  // Phase 1: Account routes
  app.route('/api/account', createAccountRoutes());

  // Phase 2: Notification routes
  app.route('/api/notifications', createNotificationRoutes());

  // Phase 2: Trading routes
  app.route('/api/trading', createTradingRoutes());

  // Rithmic routes (Autopilot primary broker scaffold)
  app.route('/api/rithmic', createRithmicRoutes());

  // Hyperliquid DEX routes (perpetual futures)
  app.route('/api/hyperliquid', createHyperliquidRoutes());

  // Phase 4: RiskFlow routes
  app.route('/api/riskflow', createRiskFlowRoutes());

  // Psych assist routes (existing)
  app.route('/api/psych', createPsychAssistRoutes());

  // Phase 5: AI routes
  app.route('/api/ai', createAiRoutes());

  // Phase 6: Agent routes
  app.route('/api/agents', createAgentRoutes());

  // ER telemetry routes
  app.route('/api/er', createERRoutes());

  // Voice assistant routes
  app.route('/api/voice', createVoiceRoutes());


  // User settings persistence
  app.route('/api/settings', createSettingsRoutes());

  // Trading journal (human psych + agent performance)
  app.route('/api/journal', createJournalRoutes());
}
