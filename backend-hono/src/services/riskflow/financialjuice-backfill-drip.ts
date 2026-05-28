// [claude-code 2026-05-04] Slow-drip FinancialJuice backfill runner for last-2d
// recovery.
// [codex 2026-05-07] Rebuilt on FinancialJuice's RSS feed instead of X profile
// scraping. Admin controls now exercise the same primary pipe as the worker.

import { collectFromFinancialJuiceRss } from "../../workers/riskflow-worker/sources/financialjuice-rss.js";
import {
  upsertHeartbeat,
  writeCollectedItems,
} from "../../workers/riskflow-worker/persist.js";
import { scoringCycle } from "./central-scorer.js";
import { rescoreInMemoryFeed, seedCacheFromDb } from "./feed-service.js";
import { createLogger } from "../../lib/logger.js";

const log = createLogger("FJDrip");

const HANDLE = "financialjuice";
const FROM = "rss";
const TO = "latest";
const MIN_BATCH = 1;
const MAX_BATCH = 80;
const INTERVAL_MS = 120 * 1000;
const RATE_LIMIT_BACKOFF_MS =
  Number(process.env.FINANCIALJUICE_BACKOFF_MS) || 300_000;

export interface FinancialJuiceRssRefreshResult {
  refreshed: boolean;
  skipped: boolean;
  rateLimited: boolean;
  fetched: number;
  written: number;
  scored: number;
  rescored: number;
  cacheSeeded: boolean;
  errors: number;
  error: string | null;
  warnings: string[];
  backoffMs: number | null;
  refreshedAt: string;
}

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

function isFinancialJuiceRateLimit(message: string): boolean {
  return /\b429\b/.test(message);
}

async function writeFinancialJuiceHeartbeat(row: {
  lastRunAt: string;
  written: number;
  errors: number;
}): Promise<void> {
  await upsertHeartbeat({
    tier: "financialjuice",
    last_run_at: row.lastRunAt,
    items_ingested: row.written,
    errors: row.errors,
  }).catch(() => {});
}

async function runFinancialJuiceRssRefresh(): Promise<FinancialJuiceRssRefreshResult> {
  const refreshedAt = new Date().toISOString();
  const warnings: string[] = [];
  let fetched = 0;
  let written = 0;
  let scored = 0;
  let rescored = 0;
  let cacheSeeded = false;

  try {
    const items = await collectFromFinancialJuiceRss({
      tier: "breaking",
      limit: MAX_BATCH,
    });
    fetched = items.length;
    log.info("FJ RSS refresh fetched", { fetched });

    written = await writeCollectedItems(items);
    log.info("FJ RSS refresh written", { fetched, written });

    scored =
      written > 0
        ? await scoringCycle().catch((err: unknown) => {
            warnings.push(
              `scoring failed: ${err instanceof Error ? err.message : String(err)}`,
            );
            return 0;
          })
        : 0;

    await seedCacheFromDb()
      .then(() => {
        cacheSeeded = true;
      })
      .catch((err: unknown) => {
        warnings.push(
          `cache seed failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      });

    rescored = await rescoreInMemoryFeed().catch((err: unknown) => {
      warnings.push(
        `cache rescore failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return 0;
    });

    await writeFinancialJuiceHeartbeat({
      lastRunAt: refreshedAt,
      written,
      errors: 0,
    });

    return {
      refreshed: true,
      skipped: false,
      rateLimited: false,
      fetched,
      written,
      scored,
      rescored,
      cacheSeeded,
      errors: 0,
      error: null,
      warnings,
      backoffMs: null,
      refreshedAt,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const rateLimited = isFinancialJuiceRateLimit(message);
    await writeFinancialJuiceHeartbeat({
      lastRunAt: refreshedAt,
      written,
      errors: 1,
    });
    return {
      refreshed: false,
      skipped: false,
      rateLimited,
      fetched,
      written,
      scored,
      rescored,
      cacheSeeded,
      errors: 1,
      error: message,
      warnings,
      backoffMs: rateLimited ? RATE_LIMIT_BACKOFF_MS : null,
      refreshedAt,
    };
  }
}

async function runOneTick(
  force = false,
): Promise<FinancialJuiceRssRefreshResult | null> {
  if (!state.running && !force) return null;
  if (inFlight) {
    return {
      refreshed: false,
      skipped: true,
      rateLimited: false,
      fetched: 0,
      written: 0,
      scored: 0,
      rescored: 0,
      cacheSeeded: false,
      errors: 0,
      error: "FinancialJuice RSS refresh already running",
      warnings: [],
      backoffMs: null,
      refreshedAt: new Date().toISOString(),
    };
  }
  inFlight = true;
  state.lastError = null;
  state.lastRunAt = new Date().toISOString();
  let result: FinancialJuiceRssRefreshResult | null = null;
  try {
    result = await runFinancialJuiceRssRefresh();
    state.lastWritten = result.written;
    state.lastScored = result.scored;
    state.totalWritten += result.written;
    state.totalScored += result.scored;
    state.lastError = result.error;
  } finally {
    inFlight = false;
    if (state.running) {
      state.nextRunAt = new Date(Date.now() + INTERVAL_MS).toISOString();
      timer = setTimeout(() => {
        void runOneTick();
      }, INTERVAL_MS);
    }
  }
  return result;
}

export async function runFinancialJuiceBackfillDripNow(): Promise<DripState> {
  await runOneTick(true);
  return getFinancialJuiceBackfillDripStatus();
}

export async function refreshFinancialJuiceRssConnection(): Promise<FinancialJuiceRssRefreshResult> {
  const result = await runOneTick(true);
  if (result) return result;
  return {
    refreshed: false,
    skipped: true,
    rateLimited: false,
    fetched: 0,
    written: 0,
    scored: 0,
    rescored: 0,
    cacheSeeded: false,
    errors: 0,
    error: "FinancialJuice RSS refresh did not start",
    warnings: [],
    backoffMs: null,
    refreshedAt: new Date().toISOString(),
  };
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
