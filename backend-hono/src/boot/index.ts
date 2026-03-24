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
import { startDispatchScheduler, catchUpMissedBriefs } from '../services/cron/dispatch-scheduler.js';
import { cleanupOldItems } from '../services/riskflow/news-cache.js';

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

  // Dispatch scheduler (cron-driven MDB/ADB/PMDB/TOTT briefing generation)
  startDispatchScheduler();
  log.info('DispatchScheduler started');

  // Catch-up: generate any briefs that should have fired today but were missed (backend wasn't running)
  catchUpMissedBriefs().catch((err) =>
    log.warn('Brief catch-up failed (non-fatal)', { error: String(err) })
  );

  // Hermes/OpenRouter connection (non-blocking)
  initHermesAgent().catch((err) =>
    log.warn('Hermes init failed (non-fatal)', { error: String(err) })
  );

  // Claude SDK bridge (non-blocking)
  initClaudeSDK().catch((err) =>
    log.warn('Claude SDK init failed (non-fatal)', { error: String(err) })
  );

  // News feed cleanup — purge items older than 30 days on startup, then daily
  cleanupOldItems().catch((err) =>
    log.warn('Initial feed cleanup failed (non-fatal)', { error: String(err) })
  );
  setInterval(() => {
    cleanupOldItems().catch((err) =>
      log.warn('Scheduled feed cleanup failed', { error: String(err) })
    );
  }, 24 * 60 * 60 * 1000);
  log.info('FeedCleanup scheduled (30-day TTL, daily cycle)');

  log.info('All services initialized');
}
