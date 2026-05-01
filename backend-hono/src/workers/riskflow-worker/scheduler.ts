// [claude-code 2026-04-24] S35-T10: renamed dir from workers/news-worker. Heartbeats now
//   key on riskflow_worker_heartbeats; diagnostics surfaces riskflow_worker_age_seconds
//   (with news_worker_age_seconds dual-emitted through 2026-05-08).
// [claude-code 2026-04-30] S55: Commentary tier added — 60s cadence, same as breaking.
// Commentary handles produce opinion/analysis, not structured econ data.
// [claude-code 2026-04-19] S27-T7 (W2d): scheduler — three tiers.
// Breaking (60s): X/Twitter wire handles via browser-harness.
// Commentary (60s): X/Twitter commentary handles via browser-harness.
// Standard (5m): COT, FOMC Minutes, Fed Speeches, Macro X handles, Kalshi whale alerts.

import {
  runBreakingTier,
  runStandardTier,
  runCommentaryTier,
} from "./sources/index.js";
import { upsertHeartbeat } from "./persist.js";
import { NEWS_WORKER_CONTRACT } from "./contract.js";

const BREAKING_INTERVAL_MS = NEWS_WORKER_CONTRACT.BREAKING_INTERVAL_MS;
const COMMENTARY_INTERVAL_MS = NEWS_WORKER_CONTRACT.COMMENTARY_INTERVAL_MS;
const STANDARD_INTERVAL_MS = NEWS_WORKER_CONTRACT.STANDARD_INTERVAL_MS;

interface TierState {
  tier: "breaking" | "standard" | "commentary";
  running: boolean;
  lastRunAt: string | null;
  lastItemsIngested: number;
  lastErrors: number;
  totalRuns: number;
  totalErrors: number;
  timer: NodeJS.Timeout | null;
}

const state: Record<"breaking" | "standard" | "commentary", TierState> = {
  breaking: {
    tier: "breaking",
    running: false,
    lastRunAt: null,
    lastItemsIngested: 0,
    lastErrors: 0,
    totalRuns: 0,
    totalErrors: 0,
    timer: null,
  },
  standard: {
    tier: "standard",
    running: false,
    lastRunAt: null,
    lastItemsIngested: 0,
    lastErrors: 0,
    totalRuns: 0,
    totalErrors: 0,
    timer: null,
  },
  commentary: {
    tier: "commentary",
    running: false,
    lastRunAt: null,
    lastItemsIngested: 0,
    lastErrors: 0,
    totalRuns: 0,
    totalErrors: 0,
    timer: null,
  },
};

async function runTier(
  tier: "breaking" | "standard" | "commentary",
): Promise<void> {
  const s = state[tier];
  if (s.running) return;
  s.running = true;
  const started = Date.now();
  let ingested = 0;
  let errors = 0;
  try {
    const result =
      tier === "breaking"
        ? await runBreakingTier()
        : tier === "commentary"
          ? await runCommentaryTier()
          : await runStandardTier();
    ingested = result.ingested;
    errors = result.errors;
  } catch (err) {
    errors += 1;
    console.error(
      JSON.stringify({
        ts: new Date().toISOString(),
        service: "riskflow-worker",
        stage: "tier_error",
        tier,
        error: err instanceof Error ? err.message : String(err),
      }),
    );
  } finally {
    s.running = false;
    s.lastRunAt = new Date().toISOString();
    s.lastItemsIngested = ingested;
    s.lastErrors = errors;
    s.totalRuns += 1;
    s.totalErrors += errors;

    await upsertHeartbeat({
      tier,
      last_run_at: s.lastRunAt,
      items_ingested: ingested,
      errors,
    }).catch(() => {});

    console.log(
      JSON.stringify({
        ts: new Date().toISOString(),
        service: "riskflow-worker",
        stage: "tier_complete",
        tier,
        ingested,
        errors,
        duration_ms: Date.now() - started,
      }),
    );
  }
}

export function startScheduler(): void {
  if (state.breaking.timer || state.standard.timer || state.commentary.timer)
    return;

  // Stagger first runs so tiers don't fire on the same tick.
  setTimeout(() => void runTier("breaking"), 1_000);
  setTimeout(() => void runTier("commentary"), 2_000);
  setTimeout(() => void runTier("standard"), 3_000);

  state.breaking.timer = setInterval(
    () => void runTier("breaking"),
    BREAKING_INTERVAL_MS,
  );
  state.commentary.timer = setInterval(
    () => void runTier("commentary"),
    COMMENTARY_INTERVAL_MS,
  );
  state.standard.timer = setInterval(
    () => void runTier("standard"),
    STANDARD_INTERVAL_MS,
  );
}

export async function stopScheduler(): Promise<void> {
  if (state.breaking.timer) clearInterval(state.breaking.timer);
  if (state.standard.timer) clearInterval(state.standard.timer);
  if (state.commentary.timer) clearInterval(state.commentary.timer);
  state.breaking.timer = null;
  state.standard.timer = null;
  state.commentary.timer = null;
}

export function getSchedulerSnapshot() {
  const tiers = (["breaking", "standard", "commentary"] as const).map((t) => {
    const s = state[t];
    return {
      tier: s.tier,
      running: s.running,
      last_run_at: s.lastRunAt,
      last_items_ingested: s.lastItemsIngested,
      last_errors: s.lastErrors,
      total_runs: s.totalRuns,
      total_errors: s.totalErrors,
    };
  });
  return { tiers };
}
