// [claude-code 2026-04-16] S20-T9: Two-phase boot — bootCritical() before listen, bootBackground() after via queueMicrotask
// [claude-code 2026-04-03] Added AgentDesk daily cron (6:00 AM ET weekdays) to boot sequence
// [claude-code 2026-03-29] Added catalyst promoter to boot sequence (graduates scored items → narrative catalysts)
// [claude-code 2026-03-24] Added VIX polling, central scorer, IV ticker, VIX rescore to boot sequence
// [claude-code 2026-03-20] Service boot consolidation — single entry point for all background services

import { hostname } from "node:os";
import { createLogger } from "../lib/logger.js";
import { startFeedPoller } from "../services/riskflow/feed-poller.js";
import { startAgentReachPoller } from "../services/riskflow/agent-reach-poller.js";
import { startPollWatchdog } from "../services/riskflow/poll-watchdog.js";
import { seedCacheFromDb } from "../services/riskflow/feed-service.js";
import { startEconEnricher } from "../services/cron/econ-enricher.js";
import { startEconPoller } from "../services/riskflow/econ-rettiwt-poller.js";
import { startExaScheduledMonitor } from "../services/riskflow/exa-scheduled-monitor.js";
import { initClaudeSDK } from "../services/claude-sdk/process-manager.js";
import { initToolApprovalStore } from "../services/tool-approval-store.js";
import { startPersistentSession } from "../services/claude-sdk/session-manager.js";
import {
  initHermesAgent,
  isHermesAvailable,
} from "../services/hermes-handler.js";
import {
  registerPeer,
  sendHeartbeat,
  startHeartbeatMonitor,
} from "../services/peers/peer-registry.js";
import { startAutopilotScheduler } from "../services/autopilot/autopilot-scheduler.js";
import { startContextBankTicker } from "../services/context-bank/context-bank-service.js";
import { startBoardroomScheduler } from "../services/cron/boardroom-scheduler.js";
import {
  startDispatchScheduler,
  catchUpMissedBriefs,
} from "../services/cron/dispatch-scheduler.js";
// [claude-code 2026-03-27] cleanupOldItems import removed — feed items retained for calibration
import { startVIXPolling } from "../services/vix-service.js";
import { startRegimePushListener } from "../services/notifications/regime-push.js";
import { startCentralScorer } from "../services/riskflow/central-scorer.js";
import { startIVScoreTicker } from "../services/market-data/iv-score-ticker.js";
import { initVIXRescore } from "../services/riskflow/vix-rescore.js";
import { startAgentNotesCron } from "../services/riskflow/agent-notes.js";
// [claude-code 2026-04-04] Re-enabled: Exa-powered X scraper bypasses CLI rate limits
import { startCommentaryScraper } from "../services/riskflow/commentary-scraper.js";
import { startMarketImpactEnricher } from "../services/cron/market-impact-enricher.js";
import { startMonitoringLoop } from "../services/cron/monitoring-loop.js";
import { startCatalystPromoter } from "../services/riskflow/catalyst-promoter.js";
import { isComputerUseAvailable } from "../services/skills/tradingview-trade-plan.js";
import * as projectxService from "../services/projectx-service.js";
import { startSharedMemoryCleanup } from "../services/peers/shared-memory.js";
import { startReflectScheduler } from "../services/autoresearch/reflect-scheduler.js";
import { startAgentDeskDaily } from "../services/cron/agent-desk-daily.js";
import { startAquariumScheduler } from "../services/riskflow/aquarium-scheduler.js";
import { restoreAgentDeskRunningState } from "../services/agent-desk/agent-desk-boot.js";
import { startDivergenceDetector } from "../services/polymarket-kalshi-divergence.js";
import { startPredictionResolver } from "../services/polymarket-prediction-resolver.js";
import { bootHarperAutonomous } from "../services/harper-autonomous/index.js";
import { initRettiwtPool } from "../services/rettiwt-service.js";
import { cleanupOldRawItems } from "../services/supabase-service.js";
import { startRelayConnector } from "../services/relay-connector.js";
import { startOracleResearch } from "../services/cron/oracle-research-scheduler.js";
import { startOutcomeResolver } from "../services/cron/outcome-resolver.js";
import { startOutcomeTagger } from "../services/scoring/outcome-tagger.js";

const log = createLogger("Boot");
let localPeerHeartbeatTimer: ReturnType<typeof setInterval> | null = null;

async function registerLocalPeerOnBoot(): Promise<void> {
  if (process.env.PEER_AUTO_REGISTER === "false") {
    log.info("Peer auto-register disabled (PEER_AUTO_REGISTER=false)");
    return;
  }

  const userId =
    process.env.PEER_BOOT_USER_ID ||
    process.env.SUPABASE_BOOT_USER_ID ||
    (process.env.BYPASS_AUTH === "true" ? "local-user" : "");

  if (!userId) {
    log.info("Peer auto-register skipped (set PEER_BOOT_USER_ID to enable)");
    return;
  }

  const hermesAvailable = isHermesAvailable();
  const capabilities = ["claude-cli"];
  if (process.env.PEER_ENABLE_TWITTER !== "false") capabilities.push("rettiwt");
  if (hermesAvailable) capabilities.push("hermes");

  const peer = await registerPeer(userId, {
    deviceName: process.env.PEER_DEVICE_NAME || hostname(),
    platform: process.platform,
    capabilities,
    status: "online",
    hermesAvailable,
  });

  log.info("Local peer registered on boot", {
    peerId: peer.id,
    userId: peer.userId,
    deviceName: peer.deviceName,
    status: peer.status,
    hermesAvailable: peer.hermesAvailable,
  });

  if (!localPeerHeartbeatTimer) {
    localPeerHeartbeatTimer = setInterval(() => {
      sendHeartbeat(peer.id, { status: "online" }).catch((err) =>
        log.warn("Local peer heartbeat failed (non-fatal)", {
          error: String(err),
        }),
      );
    }, 60_000);
    localPeerHeartbeatTimer.unref?.();
  }
}

/**
 * Critical-path boot: runs BEFORE server.listen().
 * Only services that must be ready before the first HTTP request.
 */
export async function bootCritical(): Promise<void> {
  const t0 = Date.now();
  log.info("Critical boot starting");

  // VIX background polling (60s interval — must start before rescore triggers)
  startVIXPolling();
  log.info("VIX polling started");

  // [claude-code 2026-04-18] A2: regime-change → push listener (must come after VIX polling starts)
  startRegimePushListener();

  // Scoring env var assertion — CRITICAL if missing/misconfigured
  const enableCentralScoring = process.env.ENABLE_CENTRAL_SCORING;
  if (enableCentralScoring !== "true") {
    log.error(
      '[Boot] CRITICAL: ENABLE_CENTRAL_SCORING is not set to "true". ' +
        `Current value: "${enableCentralScoring ?? "undefined"}". ` +
        "Raw feed items will accumulate in raw_riskflow_items but NOTHING will be scored. " +
        "Set ENABLE_CENTRAL_SCORING=true in production .env immediately.",
    );
  }

  // Central scorer (30s — scores unscored items, gated by ENABLE_CENTRAL_SCORING env)
  startCentralScorer();
  log.info("CentralScorer started");

  // Feed cache seed (cold start: hydrate from scored_riskflow_items)
  await seedCacheFromDb();
  log.info("FeedCache seeded from DB");

  // IV score ticker (60s — computes blended IV score, persists to DB)
  const instrument = process.env.PRIMARY_INSTRUMENT || "/ES";
  startIVScoreTicker(instrument);
  log.info(`IVScoreTicker started (${instrument})`);

  // [claude-code 2026-04-19] S24 unify: 24h-runtime mode — relay comes up BEFORE server.listen()
  // returns so the mobile PWA never sees a moment where the backend is cut on but unreachable.
  // Auto-discovers userId from ~/.fintheon/peer.json; set-user RPC overrides once Electron signs in.
  startRelayConnector();
  log.info("RelayConnector started");

  log.info(`Critical boot complete in ${Date.now() - t0}ms`);
}

/**
 * Background boot: runs AFTER server.listen() via queueMicrotask.
 * Crons, scrapers, agents, heartbeat — everything non-critical.
 */
export async function bootBackground(): Promise<void> {
  const t0 = Date.now();
  log.info("Background boot starting");

  // [claude-code 2026-04-18] S25-T1: Agent-Reach is the PRIMARY news source. It runs on its
  // own schedule with UA pool + per-domain token bucket, hits RSS first then HTML fallback,
  // and needs no credentials — so it keeps the feed alive even when Rettiwt has zero keys.
  startAgentReachPoller();
  log.info("AgentReachPoller started (primary news source)");

  // RiskFlow Level 4 detection feed — now handles econ + Rettiwt (secondary)
  startFeedPoller();
  log.info("FeedPoller started");

  // [claude-code 2026-04-19] S27-T4: Rettiwt cut from Herald dispatcher. Pool init and
  // econ-rettiwt-poller start are gated behind RETTIWT_REENABLE=true so we can reactivate
  // without a code change if browser-harness coverage falls short in the 48h review.
  if (process.env.RETTIWT_REENABLE === "true") {
    await initRettiwtPool();
    log.info("Rettiwt key pool initialized (RETTIWT_REENABLE=true)");

    const poolReloadTimer = setInterval(() => {
      initRettiwtPool().catch((err) =>
        log.warn("Rettiwt pool reload failed (non-fatal)", {
          error: String(err),
        }),
      );
    }, 15 * 60_000);
    poolReloadTimer.unref?.();
    log.info("Rettiwt pool reload scheduled (15 min)");
  } else {
    log.info(
      "Rettiwt key pool skipped — S27-T4 cut from dispatcher (set RETTIWT_REENABLE=true to restore)",
    );
  }

  // Poll watchdog — detects stalled Agent Reach, soft-nudges then restarts if needed
  startPollWatchdog();
  log.info("PollWatchdog started");

  if (process.env.RETTIWT_REENABLE === "true") {
    // Econ-triggered Rettiwt poller (replaces twitter-cli)
    startEconPoller();
    log.info("EconRettiwtPoller started (RETTIWT_REENABLE=true)");
  } else {
    log.info(
      "EconRettiwtPoller skipped — S27-T4 (set RETTIWT_REENABLE=true to restore)",
    );
  }

  // Exa scheduled-event monitor (supplementary discovery, not headline ingestion)
  startExaScheduledMonitor();
  log.info("ExaScheduledMonitor started");

  // Autopilot scheduler (30s cycle — proposal expiry, session detection)
  startAutopilotScheduler();
  log.info("AutopilotScheduler started");

  // Catalyst promoter (60s — graduates scored items into narrative catalysts with thread links)
  startCatalystPromoter();
  log.info("CatalystPromoter started");

  // AgentDesk running state restore (from latest Aquarium simulation — non-blocking)
  restoreAgentDeskRunningState().catch((err) =>
    log.warn("AgentDesk running state restore failed (non-fatal)", {
      error: String(err),
    }),
  );

  // VIX-triggered rescore (rescores last 4h of items on spike/velocity/regime change)
  initVIXRescore();
  log.info("VIXRescore initialized");

  // Econ calendar enricher (Notion calendar → RiskFlow feed)
  startEconEnricher();
  log.info("EconEnricher started");

  // Context Bank ticker (120s — unified snapshot for all agents)
  startContextBankTicker();
  log.info("ContextBankTicker started");

  // Boardroom scheduler (cron-driven standups, econ scans, market-open triggers)
  startBoardroomScheduler();
  log.info("BoardroomScheduler started");

  // Dispatch scheduler (cron-driven MDB/ADB/PMDB/TOTT briefing generation)
  startDispatchScheduler();
  log.info("DispatchScheduler started");

  // Catch-up: generate any briefs that should have fired today but were missed (backend wasn't running)
  catchUpMissedBriefs().catch((err) =>
    log.warn("Brief catch-up failed (non-fatal)", { error: String(err) }),
  );

  // Hermes/OpenRouter connection (non-blocking)
  initHermesAgent().catch((err) =>
    log.warn("Hermes init failed (non-fatal)", { error: String(err) }),
  );

  // Tool approval store (load persistent permissions)
  initToolApprovalStore().catch((err) =>
    log.warn("Tool approval store init failed", { error: String(err) }),
  );

  // Claude SDK bridge (non-blocking)
  initClaudeSDK()
    .then(() => startPersistentSession())
    .then(async () => {
      log.info("Persistent Claude session started");
      startHeartbeatMonitor();
      log.info("Peer heartbeat monitor started");
      await registerLocalPeerOnBoot();
    })
    .catch((err) =>
      log.warn("Claude SDK init failed (non-fatal)", { error: String(err) }),
    );

  // Agent notes cron (5min — generates Oracle tactical notes for high/critical items)
  startAgentNotesCron();
  log.info("AgentNotesCron started");

  startCommentaryScraper();
  log.info("CommentaryScraper started (Exa X-powered)");

  // Market impact enricher (24h — enriches HIGH/CRITICAL scored items with NQ/ES/YM daily close)
  startMarketImpactEnricher();
  log.info("MarketImpactEnricher started");

  // [claude-code 2026-04-18] S24-T4: V4 monitoring loop (2h — proposes regime/lexicon/walk-back changes)
  // Gated by ENABLE_MONITORING_LOOP env var. Turn on after T1/T2/T3 migrations land.
  startMonitoringLoop();

  // [claude-code 2026-03-27] Feed cleanup DISABLED — scored items accumulate for calibration DB
  // cleanupOldItems() was purging items older than 30 days. Now we keep everything.
  log.info(
    "FeedCleanup DISABLED — scored items retained for historical calibration",
  );

  // [claude-code 2026-04-12] Raw items auto-delete (7d) — raw_riskflow_items is just an inbox
  // for the central scorer. Once scored, they're redundant. Run on boot + every 6h.
  cleanupOldRawItems(7)
    .then((n) => {
      if (n > 0)
        log.info(`RawItemCleanup: deleted ${n} raw items older than 7d`);
    })
    .catch((err) =>
      log.warn("RawItemCleanup boot run failed (non-fatal)", {
        error: String(err),
      }),
    );
  const rawCleanupTimer = setInterval(
    () => {
      cleanupOldRawItems(7)
        .then((n) => {
          if (n > 0)
            log.info(`RawItemCleanup: deleted ${n} raw items older than 7d`);
        })
        .catch((err) =>
          log.warn("RawItemCleanup failed (non-fatal)", { error: String(err) }),
        );
    },
    6 * 60 * 60 * 1000,
  ); // Every 6 hours
  rawCleanupTimer.unref?.();
  log.info("RawItemCleanup scheduled (7d TTL, 6h interval)");

  // Execution bridge health check (non-blocking)
  projectxService
    .getConnectionStatus("system")
    .then((status) => {
      if (status.connected) {
        log.info("Execution bridge connected");
      } else {
        log.info(`Execution bridge not available: ${status.message}`);
      }
    })
    .catch(() => {
      log.info("Execution bridge not available (will retry on first use)");
    });

  // Computer Use availability (S13-T2: TradingView trade plan skill)
  log.info(
    `Computer Use: ${isComputerUseAvailable() ? "available" : "not configured (set ENABLE_COMPUTER_USE=true)"}`,
  );

  // Shared memory cleanup cron (60min — expires entries past TTL)
  startSharedMemoryCleanup();

  // AgentDesk daily auto-run (6:00 AM ET weekdays — once per day before MDB)
  startAgentDeskDaily();
  log.info("AgentDeskDaily cron scheduled");

  // Aquarium AI scheduler (Oracle/Nous — 60min interval, first run 20s after boot)
  startAquariumScheduler();

  // Polymarket/Kalshi divergence detector (15min interval, first run 30s after boot)
  startDivergenceDetector();

  // Prediction resolver (1h interval — resolves closed Polymarket predictions)
  startPredictionResolver();

  // REFLECT scheduler (04:00 UTC daily — news analysis quality self-improvement)
  startReflectScheduler();

  // Outcome resolver (2h interval — resolves deliberation predictions vs actual VIX at 24/48/72h)
  startOutcomeResolver();
  log.info("OutcomeResolver started");

  // Outcome tagger (S24-T3): 5min sweep that snapshots SPY at 4h + 24h after each regime decision
  startOutcomeTagger();

  // Harper Autonomous Loop — CAO autonomous agent (gated by HARPER_AUTONOMOUS_ENABLED=true)
  bootHarperAutonomous().catch((err) =>
    log.warn("Harper autonomous boot failed (non-fatal)", {
      error: String(err),
    }),
  );

  // Oracle research scheduler (4h interval — prediction market scanning + arb detection, gated by ORACLE_RESEARCH_ENABLED)
  startOracleResearch();

  // [claude-code 2026-04-19] Relay connector moved to bootCritical — duplicate call removed here.

  log.info(`Background boot complete in ${Date.now() - t0}ms`);
}

/**
 * Legacy entry point — calls both phases sequentially.
 * Kept for backward compatibility; prefer bootCritical() + bootBackground().
 */
export async function bootServices(): Promise<void> {
  await bootCritical();
  await bootBackground();
}
