// [claude-code 2026-04-24] S34-T4: silent-drop counters. In-memory per-source
// per-stage per-reason bumps, flushed every 60s into riskflow_drop_counters.
// Instrumentation-first — no behavior change; just counts real zeroes so the
// news-worker "items_ingested: 0, errors: 0" mystery can be traced to a
// concrete drop class per source.

import { createLogger } from "../../lib/logger.js";
import { getSupabaseClient } from "../../config/supabase.js";

const log = createLogger("DropCounters");

const FLUSH_INTERVAL_MS = 60_000;

type CounterKey = string; // `${source}|${stage}|${reason}`

interface LiveCounter {
  source: string;
  stage: string;
  reason: string;
  count: number;
}

let counters = new Map<CounterKey, LiveCounter>();
let windowStart = new Date();
let flushTimer: ReturnType<typeof setInterval> | null = null;

function key(source: string, stage: string, reason: string): CounterKey {
  return `${source}|${stage}|${reason}`;
}

export function bumpCounter(
  source: string,
  stage: string,
  reason: string,
  count = 1,
): void {
  if (count <= 0) return;
  const safeSource = (source || "unknown").slice(0, 128);
  const k = key(safeSource, stage, reason);
  const existing = counters.get(k);
  if (existing) {
    existing.count += count;
  } else {
    counters.set(k, {
      source: safeSource,
      stage,
      reason,
      count,
    });
  }
}

export interface DropCounterSnapshot {
  window_start: string;
  window_end: string;
  counters: LiveCounter[];
  total_dropped: number;
}

export function getCurrentSnapshot(): DropCounterSnapshot {
  const now = new Date();
  const rows = Array.from(counters.values()).sort((a, b) => b.count - a.count);
  return {
    window_start: windowStart.toISOString(),
    window_end: now.toISOString(),
    counters: rows,
    total_dropped: rows.reduce((acc, r) => acc + r.count, 0),
  };
}

export async function flushCounters(): Promise<number> {
  if (counters.size === 0) {
    windowStart = new Date();
    return 0;
  }

  const windowEnd = new Date();
  const batch = Array.from(counters.values());
  const rows = batch.map((c) => ({
    source: c.source,
    stage: c.stage,
    reason: c.reason,
    count: c.count,
    window_start: windowStart.toISOString(),
    window_end: windowEnd.toISOString(),
  }));

  // Swap the map BEFORE the async write so new bumps land in the next window.
  counters = new Map<CounterKey, LiveCounter>();
  windowStart = windowEnd;

  const sb = getSupabaseClient();
  if (!sb) {
    log.info(
      `Supabase unconfigured — dropped ${rows.length} counter rows (would have written)`,
    );
    return 0;
  }

  try {
    const { error } = await sb.from("riskflow_drop_counters").insert(rows);
    if (error) {
      log.warn("flush error — counters lost for this window", {
        error: error.message,
        rows: rows.length,
      });
      return 0;
    }
    return rows.length;
  } catch (err) {
    log.warn("flush exception — counters lost for this window", {
      error: err instanceof Error ? err.message : String(err),
      rows: rows.length,
    });
    return 0;
  }
}

export function startDropCounterFlush(): void {
  if (flushTimer) return;
  windowStart = new Date();
  flushTimer = setInterval(() => {
    flushCounters().catch((err) =>
      log.warn("scheduled flush failed", {
        error: err instanceof Error ? err.message : String(err),
      }),
    );
  }, FLUSH_INTERVAL_MS);
  log.info(`Drop-counter flush started (every ${FLUSH_INTERVAL_MS / 1000}s)`);
}

export function stopDropCounterFlush(): void {
  if (flushTimer) {
    clearInterval(flushTimer);
    flushTimer = null;
  }
}
