// [claude-code 2026-05-04] Slow-drip FinancialJuice backfill runner for last-2d
// recovery.
// [codex 2026-05-07] Rebuilt on FinancialJuice's RSS feed instead of X profile
// scraping. Admin controls now exercise the same primary pipe as the worker.

import { collectFromFinancialJuiceRss } from "../../workers/riskflow-worker/sources/financialjuice-rss.js";
import { writeCollectedItems } from "../../workers/riskflow-worker/persist.js";
import { scoringCycle } from "./central-scorer.js";
import { createLogger } from "../../lib/logger.js";

const log = createLogger("FJDrip");

const HANDLE = "financialjuice";
const FROM = "rss";
const TO = "latest";
const MIN_BATCH = 1;
const MAX_BATCH = 80;
const INTERVAL_MS = 120 * 1000;

interface DripState {
  running: boolean;
  startedAt: string | null;
  lastRunAt: string | null;
  nextRunAt: string | null;
  from: string;
  to: string;
  handle: string;
  batchMin: number;
  batchMax: number;
  intervalMs: number;
  lastWritten: number;
  lastScored: number;
  totalWritten: number;
  totalScored: number;
  lastError: string | null;
}

let timer: ReturnType<typeof setTimeout> | null = null;
let inFlight = false;

const state: DripState = {
  running: false,
  startedAt: null,
  lastRunAt: null,
  nextRunAt: null,
  from: FROM,
  to: TO,
  handle: HANDLE,
  batchMin: MIN_BATCH,
  batchMax: MAX_BATCH,
  intervalMs: INTERVAL_MS,
  lastWritten: 0,
  lastScored: 0,
  totalWritten: 0,
  totalScored: 0,
  lastError: null,
};

async function runOneTick(force = false): Promise<void> {
  if ((!state.running && !force) || inFlight) return;
  inFlight = true;
  state.lastError = null;
  state.lastRunAt = new Date().toISOString();
  try {
    const items = await collectFromFinancialJuiceRss({
      tier: "breaking",
      limit: MAX_BATCH,
    });
    log.info("FJ RSS drip tick", { fetched: items.length });
    const written = await writeCollectedItems(items);
    log.info("FJ RSS drip written", { items: items.length, written });
    const scored = written > 0 ? await scoringCycle() : 0;
    state.lastWritten = written;
    state.lastScored = scored;
    state.totalWritten += written;
    state.totalScored += scored;
  } catch (error) {
    state.lastError = error instanceof Error ? error.message : String(error);
  } finally {
    inFlight = false;
    if (state.running) {
      state.nextRunAt = new Date(Date.now() + INTERVAL_MS).toISOString();
      timer = setTimeout(() => {
        void runOneTick();
      }, INTERVAL_MS);
    }
  }
}

export async function runFinancialJuiceBackfillDripNow(): Promise<DripState> {
  await runOneTick(true);
  return getFinancialJuiceBackfillDripStatus();
}

export function startFinancialJuiceBackfillDrip(): DripState {
  if (state.running) return getFinancialJuiceBackfillDripStatus();
  state.running = true;
  state.startedAt = new Date().toISOString();
  state.nextRunAt = new Date().toISOString();
  void runOneTick();
  return getFinancialJuiceBackfillDripStatus();
}

export function stopFinancialJuiceBackfillDrip(): DripState {
  state.running = false;
  state.nextRunAt = null;
  if (timer) clearTimeout(timer);
  timer = null;
  return getFinancialJuiceBackfillDripStatus();
}

export function getFinancialJuiceBackfillDripStatus(): DripState {
  return { ...state };
}
