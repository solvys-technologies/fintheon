// [claude-code 2026-04-18] S24-T4: RiskFlow V4 monitoring loop — 2h cron that proposes regime/lexicon/walk-back changes
/**
 * Monitoring Loop
 *
 * Runs every 2 hours. Self-check on the scoring pipeline:
 *   1. Count L9/L10 items in the last 24h. If > 5 → flag regime rubric for review (proposal).
 *   2. Scan open L9/L10 items for walk-back candidates via T2's walk-back-pairer.
 *   3. Call T2's lexicon proposer to surface new keyword suggestions.
 *   4. Check regime vs market direction (stub until T4-8 backend has SPY reader); propose if divergent.
 *
 * All proposals go through emit.ts → notifications + push.
 * Gated by ENABLE_MONITORING_LOOP env var (default off; turn on after T1/T2/T3 land).
 */

import cron from "node-cron";
import { createLogger } from "../../lib/logger.js";
import { sql, isDatabaseAvailable } from "../../config/database.js";

const log = createLogger("MonitoringLoop");

const DEFAULT_CRON = "0 */2 * * *"; // every 2h
const TIMEZONE = "America/New_York";
const L10_DAILY_THRESHOLD = 5;

interface LoopState {
  enabled: boolean;
  intervalSeconds: number;
  lastRunAt: Date | null;
  nextRunAt: Date | null;
  lastRunOutcome: {
    proposalsCreated: number;
    walkBacksReviewed: number;
    lexiconSuggestions: number;
  } | null;
}

const state: LoopState = {
  enabled: false,
  intervalSeconds: 2 * 60 * 60,
  lastRunAt: null,
  nextRunAt: null,
  lastRunOutcome: null,
};

let task: cron.ScheduledTask | null = null;

export function getMonitoringStatus(): LoopState {
  return { ...state };
}

async function countRecentL10(): Promise<number> {
  if (!isDatabaseAvailable()) return 0;
  try {
    const rows = await sql`
      SELECT COUNT(*)::int AS n FROM scored_riskflow_items
      WHERE iv_score >= 9.5 AND created_at > now() - interval '24 hours'
    `;
    return Number(rows[0]?.n ?? 0);
  } catch {
    return 0;
  }
}

interface ProposeRegimeInput {
  proposedBy: string;
  proposedRegime: string;
  reason: string;
  evidence?: Record<string, unknown>;
}
interface RegimeProposeModule {
  proposeRegimeChange?: (input: ProposeRegimeInput) => Promise<unknown>;
}
interface LexiconProposerModule {
  proposeLexiconUpdates?: () => Promise<number | void>;
}
interface WalkBackPairerModule {
  reviewOpenWalkBacks?: () => Promise<number | void>;
}

async function safeImport<T>(spec: string): Promise<T | null> {
  try {
    // Spec is a variable, not a literal — TS skips static resolution so T1/T2
    // modules are free to not exist until they land.
    const mod = (await import(/* @vite-ignore */ spec)) as T;
    return mod;
  } catch {
    return null;
  }
}

async function runCycle(): Promise<LoopState["lastRunOutcome"]> {
  const outcome = {
    proposalsCreated: 0,
    walkBacksReviewed: 0,
    lexiconSuggestions: 0,
  };

  // 1. L10 volume anomaly → regime rubric review proposal
  const l10 = await countRecentL10();
  if (l10 > L10_DAILY_THRESHOLD) {
    const proposeMod = await safeImport<RegimeProposeModule>(
      `../regime/propose.${"js"}`,
    );
    if (proposeMod?.proposeRegimeChange) {
      try {
        await proposeMod.proposeRegimeChange({
          proposedBy: "monitoring_loop",
          proposedRegime: "REVIEW",
          reason: `L10 volume anomaly: ${l10} score-10 items in the last 24h (threshold ${L10_DAILY_THRESHOLD}). Matrix rubric may need tightening.`,
          evidence: { l10Count: l10, threshold: L10_DAILY_THRESHOLD },
        });
        outcome.proposalsCreated++;
      } catch (err) {
        log.warn("L10 anomaly proposal failed", { error: String(err) });
      }
    }
  }

  // 2. Lexicon proposer — T2's function, surfaces keyword suggestions
  const lexiconMod = await safeImport<LexiconProposerModule>(
    `../scoring/lexicon-proposer.${"js"}`,
  );
  if (lexiconMod?.proposeLexiconUpdates) {
    try {
      const n = await lexiconMod.proposeLexiconUpdates();
      outcome.lexiconSuggestions = typeof n === "number" ? n : 0;
    } catch (err) {
      log.warn("Lexicon proposer failed", { error: String(err) });
    }
  }

  // 3. Walk-back review — T2's pairer scans open L9/L10 for contradictions
  const walkBackMod = await safeImport<WalkBackPairerModule>(
    `../scoring/walk-back-pairer.${"js"}`,
  );
  if (walkBackMod?.reviewOpenWalkBacks) {
    try {
      const n = await walkBackMod.reviewOpenWalkBacks();
      outcome.walkBacksReviewed = typeof n === "number" ? n : 0;
    } catch (err) {
      log.warn("Walk-back review failed", { error: String(err) });
    }
  }

  return outcome;
}

async function tick(): Promise<void> {
  const t0 = Date.now();
  state.lastRunAt = new Date();
  log.info("Monitoring cycle starting");
  try {
    state.lastRunOutcome = await runCycle();
    log.info("Monitoring cycle complete", {
      ...state.lastRunOutcome,
      elapsedMs: Date.now() - t0,
    });
  } catch (err) {
    log.error("Monitoring cycle crashed", { error: String(err) });
  } finally {
    if (task) {
      // node-cron doesn't expose nextInvocation cleanly; estimate from cron expr
      state.nextRunAt = new Date(Date.now() + state.intervalSeconds * 1000);
    }
  }
}

export function startMonitoringLoop(): void {
  if (task) return;
  const cronExpr = process.env.MONITORING_LOOP_CRON || DEFAULT_CRON;
  state.enabled = process.env.ENABLE_MONITORING_LOOP === "true";
  if (!state.enabled) {
    log.info("Monitoring loop disabled via ENABLE_MONITORING_LOOP");
    return;
  }
  task = cron.schedule(cronExpr, () => void tick(), {
    timezone: TIMEZONE,
  });
  state.nextRunAt = new Date(Date.now() + state.intervalSeconds * 1000);
  log.info(`Monitoring loop started (${cronExpr} ${TIMEZONE})`);
}

export function stopMonitoringLoop(): void {
  if (task) {
    task.stop();
    task = null;
    state.enabled = false;
    state.nextRunAt = null;
    log.info("Monitoring loop stopped");
  }
}

export async function runNow(): Promise<LoopState["lastRunOutcome"]> {
  await tick();
  return state.lastRunOutcome;
}

export function setEnabled(next: boolean): void {
  if (next === state.enabled) return;
  if (next) {
    process.env.ENABLE_MONITORING_LOOP = "true";
    startMonitoringLoop();
  } else {
    stopMonitoringLoop();
  }
}
