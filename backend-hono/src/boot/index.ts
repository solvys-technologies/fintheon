// [claude-code 2026-03-20] Service boot consolidation — single entry point for all background services

import { createLogger } from '../lib/logger.js';
import { startFeedPoller } from '../services/riskflow/feed-poller.js';
import { startEconEnricher } from '../services/cron/econ-enricher.js';
import { startEconTwitterPoller } from '../services/twitter-cli/index.js';
import { initClaudeSDK } from '../services/claude-sdk/process-manager.js';
import { initHermesAgent } from '../services/hermes-handler.js';
import { startAutopilotScheduler } from '../services/autopilot/autopilot-scheduler.js';
import { startContextBankTicker } from '../services/context-bank/context-bank-service.js';
import { startBoardroomScheduler } from '../services/cron/boardroom-scheduler.js';

const log = createLogger('Boot');

export async function bootServices(): Promise<void> {
  log.info('Starting background services');

  // RiskFlow Level 4 detection feed
  startFeedPoller();
  log.info('FeedPoller started');

  // Econ calendar enricher (Notion calendar → RiskFlow feed)
  startEconEnricher();
  log.info('EconEnricher started');

  // Econ-triggered twitter-cli poller
  startEconTwitterPoller();
  log.info('EconTwitterPoller started');

  // Autopilot scheduler (30s cycle — proposal expiry, session detection)
  startAutopilotScheduler();
  log.info('AutopilotScheduler started');

  // Context Bank ticker (120s — unified snapshot for all agents)
  startContextBankTicker();
  log.info('ContextBankTicker started');

  // Boardroom scheduler (cron-driven standups, econ scans, market-open triggers)
  startBoardroomScheduler();
  log.info('BoardroomScheduler started');

  // Hermes/OpenRouter connection (non-blocking)
  initHermesAgent().catch((err) =>
    log.warn('Hermes init failed (non-fatal)', { error: String(err) })
  );

  // Claude SDK bridge (non-blocking)
  initClaudeSDK().catch((err) =>
    log.warn('Claude SDK init failed (non-fatal)', { error: String(err) })
  );

  log.info('All services initialized');
}
