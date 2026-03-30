// [claude-code 2026-03-29] Added catalyst promoter to boot sequence (graduates scored items → narrative catalysts)
// [claude-code 2026-03-24] Added VIX polling, central scorer, IV ticker, VIX rescore to boot sequence
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
// [claude-code 2026-03-27] cleanupOldItems import removed — feed items retained for calibration
import { startVIXPolling } from '../services/vix-service.js';
import { startCentralScorer } from '../services/riskflow/central-scorer.js';
import { startIVScoreTicker } from '../services/market-data/iv-score-ticker.js';
import { initVIXRescore } from '../services/riskflow/vix-rescore.js';
import { startAgentNotesCron } from '../services/riskflow/agent-notes.js';
import { startCommentaryScraper } from '../services/riskflow/commentary-scraper.js';
import { startMarketImpactEnricher } from '../services/cron/market-impact-enricher.js';
import { startCatalystPromoter } from '../services/riskflow/catalyst-promoter.js';
import * as projectxService from '../services/projectx-service.js';

const log = createLogger('Boot');

export async function bootServices(): Promise<void> {
  log.info('Starting background services');

  // VIX background polling (60s interval — must start before rescore triggers)
  startVIXPolling();
  log.info('VIX polling started');

  // RiskFlow Level 4 detection feed
  startFeedPoller();
  log.info('FeedPoller started');

  // Central scorer (30s — scores unscored items, gated by ENABLE_CENTRAL_SCORING env)
  startCentralScorer();

  // Catalyst promoter (60s — graduates scored items into narrative catalysts with thread links)
  startCatalystPromoter();
  log.info('CatalystPromoter started');

  // IV score ticker (60s — computes blended IV score, persists to DB)
  const instrument = process.env.PRIMARY_INSTRUMENT || '/ES';
  startIVScoreTicker(instrument);
  log.info(`IVScoreTicker started (${instrument})`);

  // VIX-triggered rescore (rescores last 4h of items on spike/velocity/regime change)
  initVIXRescore();
  log.info('VIXRescore initialized');

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

  // Agent notes cron (3min — generates Oracle tactical notes for high/critical items)
  startAgentNotesCron();
  log.info('AgentNotesCron started');

  // Commentary scraper (30min — Firecrawl-powered FJ/ZeroHedge/DeItaOne web scrape)
  startCommentaryScraper();
  log.info('CommentaryScraper started');

  // Market impact enricher (24h — enriches HIGH/CRITICAL scored items with NQ/ES/YM daily close)
  startMarketImpactEnricher();
  log.info('MarketImpactEnricher started');

  // [claude-code 2026-03-27] Feed cleanup DISABLED — items accumulate for calibration DB
  // cleanupOldItems() was purging items older than 30 days. Now we keep everything.
  log.info('FeedCleanup DISABLED — items retained for historical calibration');

  // Execution bridge health check (non-blocking)
  projectxService.getConnectionStatus('system').then((status) => {
    if (status.connected) {
      log.info('Execution bridge connected');
    } else {
      log.info(`Execution bridge not available: ${status.message}`);
    }
  }).catch(() => {
    log.info('Execution bridge not available (will retry on first use)');
  });

  log.info('All services initialized');
}
