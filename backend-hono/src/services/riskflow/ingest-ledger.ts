// [claude-code 2026-04-29] S53-T4B: Ingest activity ledger — tracks every poll
// attempt with source, pipeline, decision, reason, and timestamp. In-memory ring
// buffer (max 500 entries), flushed to riskflow_ingest_ledger every 60s.
// Leak sentinel and continuity counters are embedded in the ledger statistics.

import { createLogger } from "../../lib/logger.js";
import { getSupabaseClient } from "../../config/supabase.js";

const log = createLogger("IngestLedger");

export type LedgerDecision =
  | "polled"
  | "accepted"
  | "blocked_by_policy"
  | "dropped_before_feed"
  | "rate_limited"
  | "errored";

export interface LedgerEntry {
  id: number;
  source: string;
  pipeline: string;
  decision: LedgerDecision;
  reason: string;
  headline_preview?: string;
  timestamp: string;
}

export interface LeakSentinelCounters {
  rejected_non_allowlisted: number;
  blocked_before_feed: number;
  unexpected_feed_insertions: number;
  last_leak_event_at: string | null;
  last_leak_detail: string | null;
}

export interface ContinuityCounters {
  econ_expected: number;
  econ_received: number;
  commentary_expected: number;
  commentary_received: number;
  last_econ_ingest_at: string | null;
  last_commentary_ingest_at: string | null;
  econ_stalled: boolean;
  commentary_stalled: boolean;
}

const MAX_ENTRIES = 500;
const FLUSH_INTERVAL_MS = 60_000;

let entries: LedgerEntry[] = [];
let nextId = 1;
let flushTimer: ReturnType<typeof setInterval> | null = null;

const leakCounters: LeakSentinelCounters = {
  rejected_non_allowlisted: 0,
  blocked_before_feed: 0,
  unexpected_feed_insertions: 0,
  last_leak_event_at: null,
  last_leak_detail: null,
};

const continuityCounters: ContinuityCounters = {
  econ_expected: 0,
  econ_received: 0,
  commentary_expected: 0,
  commentary_received: 0,
  last_econ_ingest_at: null,
  last_commentary_ingest_at: null,
  econ_stalled: false,
  commentary_stalled: false,
};

export function recordIngestAttempt(params: {
  source: string;
  pipeline: string;
  decision: LedgerDecision;
  reason: string;
  headlinePreview?: string;
}): void {
  const entry: LedgerEntry = {
    id: nextId++,
    source: params.source.slice(0, 128),
    pipeline: params.pipeline.slice(0, 64),
    decision: params.decision,
    reason: params.reason.slice(0, 256),
    headline_preview: params.headlinePreview?.slice(0, 120),
    timestamp: new Date().toISOString(),
  };

  entries.push(entry);
  if (entries.length > MAX_ENTRIES) {
    entries = entries.slice(-MAX_ENTRIES);
  }
}

export function recordLeakEvent(detail: string): void {
  leakCounters.rejected_non_allowlisted++;
  leakCounters.last_leak_event_at = new Date().toISOString();
  leakCounters.last_leak_detail = detail.slice(0, 256);
}

export function recordBlockedBeforeFeed(detail: string): void {
  leakCounters.blocked_before_feed++;
  leakCounters.last_leak_event_at = new Date().toISOString();
  leakCounters.last_leak_detail = `blocked-before-feed: ${detail.slice(0, 200)}`;
}

export function recordUnexpectedInsertion(detail: string): void {
  leakCounters.unexpected_feed_insertions++;
  leakCounters.last_leak_event_at = new Date().toISOString();
  leakCounters.last_leak_detail = `unexpected-insertion: ${detail.slice(0, 200)}`;
}

export function recordEconIngest(received: boolean, expectedCount = 1): void {
  continuityCounters.econ_expected += expectedCount;
  if (received) {
    continuityCounters.econ_received++;
    continuityCounters.last_econ_ingest_at = new Date().toISOString();
    continuityCounters.econ_stalled = false;
  }
}

export function recordCommentaryIngest(received: boolean, expectedCount = 1): void {
  continuityCounters.commentary_expected += expectedCount;
  if (received) {
    continuityCounters.commentary_received++;
    continuityCounters.last_commentary_ingest_at = new Date().toISOString();
    continuityCounters.commentary_stalled = false;
  }
}

export function getLedgerEntries(limit = 100): LedgerEntry[] {
  return entries.slice(-limit).reverse();
}

export function getLeakSentinel(): LeakSentinelCounters {
  return { ...leakCounters };
}

export function getContinuityCounters(): ContinuityCounters {
  const now = Date.now();
  const STALL_MINUTES = 30;

  const econStalled =
    continuityCounters.last_econ_ingest_at
      ? now - new Date(continuityCounters.last_econ_ingest_at).getTime() > STALL_MINUTES * 60_000
      : continuityCounters.econ_expected > 0;

  const commentaryStalled =
    continuityCounters.last_commentary_ingest_at
      ? now - new Date(continuityCounters.last_commentary_ingest_at).getTime() > STALL_MINUTES * 60_000
      : continuityCounters.commentary_expected > 0;

  return {
    ...continuityCounters,
    econ_stalled: econStalled,
    commentary_stalled: commentaryStalled,
  };
}

export function resetCounters(): void {
  leakCounters.rejected_non_allowlisted = 0;
  leakCounters.blocked_before_feed = 0;
  leakCounters.unexpected_feed_insertions = 0;
  leakCounters.last_leak_event_at = null;
  leakCounters.last_leak_detail = null;

  continuityCounters.econ_expected = 0;
  continuityCounters.econ_received = 0;
  continuityCounters.commentary_expected = 0;
  continuityCounters.commentary_received = 0;
  continuityCounters.last_econ_ingest_at = null;
  continuityCounters.last_commentary_ingest_at = null;
  continuityCounters.econ_stalled = false;
  continuityCounters.commentary_stalled = false;
}

export async function flushLedgerToDb(): Promise<number> {
  if (entries.length === 0) return 0;

  const batch = entries.map((e) => ({
    source: e.source,
    pipeline: e.pipeline,
    decision: e.decision,
    reason: e.reason,
    headline_preview: e.headline_preview ?? null,
    recorded_at: e.timestamp,
  }));

  entries = [];
  nextId = 1;

  const sb = getSupabaseClient();
  if (!sb) {
    log.info(`Ledger flush skipped — ${batch.length} entries (no Supabase)`);
    return 0;
  }

  try {
    const { error } = await sb.from("riskflow_ingest_ledger").insert(batch);
    if (error) {
      log.warn("Ledger flush error", { error: error.message, rows: batch.length });
      return 0;
    }
    return batch.length;
  } catch (err) {
    log.warn("Ledger flush exception", {
      error: err instanceof Error ? err.message : String(err),
      rows: batch.length,
    });
    return 0;
  }
}

export function startLedgerFlush(): void {
  if (flushTimer) return;
  flushTimer = setInterval(() => {
    flushLedgerToDb().catch((err) =>
      log.warn("Scheduled ledger flush failed", {
        error: err instanceof Error ? err.message : String(err),
      }),
    );
  }, FLUSH_INTERVAL_MS);
  log.info(`Ingest ledger flush started (every ${FLUSH_INTERVAL_MS / 1000}s)`);
}

export function stopLedgerFlush(): void {
  if (flushTimer) {
    clearInterval(flushTimer);
    flushTimer = null;
  }
}
