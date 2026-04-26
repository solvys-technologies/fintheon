// [claude-code 2026-04-19] S27-T7 (W2d): scheduler — two tiers.
// [claude-code 2026-04-25] S40-P2: cadence locked — see NEWS_WORKER_CONTRACT.md.
//   Breaking 60s → 180s, Standard 5m → 1h. Reuters/Bloomberg dropped from
//   breaking; promoted Macro Twitter handles take their slot. Boot-time
//   assertion in boot.ts overrides drift before this scheduler starts.

import { runBreakingTier, runStandardTier } from "./sources/index.js";
import { upsertHeartbeat } from "./persist.js";
import { NEWS_WORKER_CONTRACT } from "./contract.js";

const BREAKING_INTERVAL_MS = NEWS_WORKER_CONTRACT.BREAKING_INTERVAL_MS;
const STANDARD_INTERVAL_MS = NEWS_WORKER_CONTRACT.STANDARD_INTERVAL_MS;

interface TierState {
  tier: "breaking" | "standard";
  running: boolean;
  lastRunAt: string | null;
  lastItemsIngested: number;
  lastErrors: number;
  totalRuns: number;
  totalErrors: number;
  timer: NodeJS.Timeout | null;
}

const state: Record<"breaking" | "standard", TierState> = {
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
};

async function runTier(tier: "breaking" | "standard"): Promise<void> {
  const s = state[tier];
  if (s.running) return;
  s.running = true;
  const started = Date.now();
  let ingested = 0;
  let errors = 0;
  try {
    const result =
      tier === "breaking" ? await runBreakingTier() : await runStandardTier();
    ingested = result.ingested;
    errors = result.errors;
  } catch (err) {
    errors += 1;
    console.error(
      JSON.stringify({
        ts: new Date().toISOString(),
        service: "news-worker",
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
        service: "news-worker",
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
  if (state.breaking.timer || state.standard.timer) return;

  // Stagger first runs so both tiers don't fire on the same tick.
  setTimeout(() => void runTier("breaking"), 1_000);
  setTimeout(() => void runTier("standard"), 3_000);

  state.breaking.timer = setInterval(
    () => void runTier("breaking"),
    BREAKING_INTERVAL_MS,
  );
  state.standard.timer = setInterval(
    () => void runTier("standard"),
    STANDARD_INTERVAL_MS,
  );
}

export async function stopScheduler(): Promise<void> {
  if (state.breaking.timer) clearInterval(state.breaking.timer);
  if (state.standard.timer) clearInterval(state.standard.timer);
  state.breaking.timer = null;
  state.standard.timer = null;
}

export function getSchedulerSnapshot() {
  const tiers = (["breaking", "standard"] as const).map((t) => {
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
