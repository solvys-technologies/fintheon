// [claude-code 2026-04-20] Drop "N updates ·" prefix — TP says the running counter is anxiety-inducing for traders.
//   Coalescer still collapses N→1 within the window, but the surviving push shows only the first headline.
// [claude-code 2026-04-18] B2: narrative-level debounce so repeat L3+ items within 60s collapse into one push
/**
 * Narrative-level coalescer
 *
 * In-memory 60s debounce keyed by `{userId|"all"}:{narrativeKey}`. Additional
 * L3+ items arriving during the window are silently dropped — only the first
 * item's headline is surfaced when the window flushes.
 *
 * Single-process: relies on in-memory state. Acceptable because the scorer
 * only runs in one place (ENABLE_CENTRAL_SCORING=true on TP's node).
 */

import { emitPushAndLog, type EmitInput } from "./emit.js";
import { createLogger } from "../../lib/logger.js";

const log = createLogger("NarrativeCoalesce");

const WINDOW_MS = 60_000;

interface PendingEntry {
  first: EmitInput;
  count: number;
  timer: ReturnType<typeof setTimeout>;
}

const pending = new Map<string, PendingEntry>();

function keyFor(input: EmitInput, narrativeKey: string): string {
  return `${input.userId}:${narrativeKey}`;
}

async function flush(key: string): Promise<void> {
  const entry = pending.get(key);
  if (!entry) return;
  pending.delete(key);

  // Always emit the first item unchanged — N-1 others were silently dropped
  // during the window. Dedup in emit.ts (content-only fingerprint + 30 min
  // window) then suppresses repeat first-item pushes across windows.
  await emitPushAndLog(entry.first).catch((err) =>
    log.warn("Flush emit failed", { error: String(err) }),
  );
  if (entry.count > 1) {
    log.info("Coalesced window", {
      key,
      dropped: entry.count - 1,
    });
  }
}

/**
 * Queue an emit through the coalescer. If no pending entry exists for the
 * narrative key, schedule a flush in WINDOW_MS. If a pending entry exists,
 * increment its count and extend the window.
 */
export function coalesceAndEmit(input: EmitInput, narrativeKey: string): void {
  const key = keyFor(input, narrativeKey);
  const existing = pending.get(key);

  if (existing) {
    existing.count += 1;
    clearTimeout(existing.timer);
    existing.timer = setTimeout(() => void flush(key), WINDOW_MS);
    return;
  }

  const timer = setTimeout(() => void flush(key), WINDOW_MS);
  pending.set(key, { first: input, count: 1, timer });
}

/** Test helper — flush pending without waiting. */
export async function drainPendingForTest(): Promise<void> {
  const keys = Array.from(pending.keys());
  for (const k of keys) {
    const entry = pending.get(k);
    if (entry) clearTimeout(entry.timer);
    await flush(k);
  }
}
