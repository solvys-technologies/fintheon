// [claude-code 2026-05-03] Round-robin multi-device scheduler for X polling.
// Replaced the 3-tier timer architecture with a single coordination-aware loop:
//   1. Check cross-device coordinator (Supabase) — should THIS Mac mini poll now?
//   2. If yes, run unified X tier (one home-timeline pass for all handles) +
//      standard tier (non-X: COT, FOMC, Fed Speeches, Kalshi).
//   3. If no, sleep CHECK_INTERVAL_MS then re-check.
//   4. 90-minute rotation between team devices. Fallback chain to main device.
//
// Legacy tiers (breaking/commentary/standard X) replaced by runUnifiedXTier.
// Non-X standard tier preserved as runStandardTier.
//
// [claude-code 2026-04-24] S35-T10: renamed dir from workers/news-worker.
// [claude-code 2026-04-19] S27-T7 (W2d): original scheduler.

import {
  runUnifiedXTier,
  runStandardTier,
} from "./sources/index.js";
import { upsertHeartbeat } from "./persist.js";
import {
  shouldPollThisCycle,
  recordCycleSuccess,
  releaseSlot,
  getCheckIntervalMs,
  getDeviceId,
  getRotationIntervalMs,
} from "./coordination.js";

const UNIFIED_INTERVAL_MS = 60_000; // 60s between X cycles when active
const STANDARD_INTERVAL_MS = 300_000; // 5m between non-X sweeps when active

interface TierState {
  running: boolean;
  lastRunAt: string | null;
  lastItemsIngested: number;
  lastErrors: number;
  totalRuns: number;
  totalErrors: number;
}

const state: Record<
  "unified" | "standard",
  TierState & { timer: ReturnType<typeof setTimeout> | null; intervalMs: number }
> = {
  unified: {
    running: false,
    lastRunAt: null,
    lastItemsIngested: 0,
    lastErrors: 0,
    totalRuns: 0,
    totalErrors: 0,
    timer: null,
    intervalMs: UNIFIED_INTERVAL_MS,
  },
  standard: {
    running: false,
    lastRunAt: null,
    lastItemsIngested: 0,
    lastErrors: 0,
    totalRuns: 0,
    totalErrors: 0,
    timer: null,
    intervalMs: STANDARD_INTERVAL_MS,
  },
};

async function runCycle(tier: "unified" | "standard"): Promise<void> {
  const s = state[tier];
  if (s.running) return;
  s.running = true;
  const started = Date.now();
  let ingested = 0;
  let errors = 0;
  try {
    const result =
      tier === "unified" ? await runUnifiedXTier() : await runStandardTier();
    ingested = result.ingested;
    errors = result.errors;
    if (tier === "unified" && ingested > 0) {
      recordCycleSuccess().catch(() => {});
    }
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
        device: getDeviceId(),
      }),
    );
  }
}

async function unifiedPollLoop(): Promise<void> {
  const shouldPoll = await shouldPollThisCycle();
  if (shouldPoll) {
    await runCycle("unified");
    state.unified.timer = setTimeout(unifiedPollLoop, UNIFIED_INTERVAL_MS);
  } else {
    const checkMs = getCheckIntervalMs();
    state.unified.timer = setTimeout(unifiedPollLoop, checkMs);
  }
}

export function startScheduler(): void {
  if (state.unified.timer || state.standard.timer) return;

  const deviceId = getDeviceId();
  const rotationMin =
    Math.round(getRotationIntervalMs() / 60_000);

  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      service: "riskflow-worker",
      stage: "scheduler_started",
      device: deviceId,
      rotation_interval_minutes: rotationMin,
      unified_interval_ms: UNIFIED_INTERVAL_MS,
      standard_interval_ms: STANDARD_INTERVAL_MS,
    }),
  );

  // Unified X tier — coordination-aware loop
  setTimeout(() => void unifiedPollLoop(), 2_000);

  // Standard tier — independent, runs regardless of device rotation
  // (gov RSS + Kalshi don't need X credentials)
  setTimeout(() => void runCycle("standard"), 5_000);
  state.standard.timer = setInterval(
    () => void runCycle("standard"),
    STANDARD_INTERVAL_MS,
  );
}

export async function stopScheduler(): Promise<void> {
  if (state.unified.timer) clearTimeout(state.unified.timer);
  if (state.standard.timer) clearInterval(state.standard.timer);
  state.unified.timer = null;
  state.standard.timer = null;
  await releaseSlot();
}

export function getSchedulerSnapshot() {
  const tiers = ([
    "unified",
    "standard",
  ] as const).map((t) => {
    const s = state[t];
    return {
      tier: t,
      running: s.running,
      last_run_at: s.lastRunAt,
      last_items_ingested: s.lastItemsIngested,
      last_errors: s.lastErrors,
      total_runs: s.totalRuns,
      total_errors: s.totalErrors,
    };
  });
  return { tiers, device: getDeviceId() };
}
