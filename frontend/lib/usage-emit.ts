// [claude-code 2026-04-23] S31-T9 predictive knowledge graph + feature proposals
// Fire-and-forget client-side telemetry emitter. Batches events for 5s, drops to
// localStorage when offline, drains the buffer on next successful flush.
// Surface + action + opaque targetId only — never include prices, order IDs,
// or other sensitive payload data in metadata.

import { getAccessToken } from "./supabase";
import type { UsageEvent } from "../../shared/predictive-knowledge-graph";

const API_BASE_URL =
  import.meta.env.VITE_API_URL !== undefined &&
  import.meta.env.VITE_API_URL !== null
    ? import.meta.env.VITE_API_URL
    : "http://localhost:8080";

const FLUSH_INTERVAL_MS = 5_000;
const FORCE_FLUSH_AT = 20;
const MAX_BATCH = 100;
const STORAGE_KEY = "fintheon_usage_events_buffer_v1";

let queue: UsageEvent[] = [];
let flushScheduled = false;
let flushing = false;
let intervalHandle: ReturnType<typeof setInterval> | null = null;
let lifecycleAttached = false;

function readBuffer(): UsageEvent[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as UsageEvent[]) : [];
  } catch {
    return [];
  }
}

function writeBuffer(events: UsageEvent[]) {
  try {
    if (events.length === 0) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(events.slice(-500)));
    }
  } catch {
    // Quota exceeded or storage disabled — drop silently.
  }
}

async function postBatch(events: UsageEvent[]): Promise<boolean> {
  if (events.length === 0) return true;
  const token = await getAccessToken().catch(() => null);
  if (!token) return false;
  try {
    const response = await fetch(`${API_BASE_URL}/api/usage-events`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(events),
      keepalive: true,
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function flushNow(): Promise<void> {
  if (flushing) return;
  flushing = true;
  flushScheduled = false;

  try {
    const buffered = readBuffer();
    const live = queue;
    queue = [];

    const all = buffered.concat(live);
    if (all.length === 0) return;

    // Send in chunks of MAX_BATCH so a slow backend can't choke the queue.
    let cursor = 0;
    const failed: UsageEvent[] = [];
    while (cursor < all.length) {
      const slice = all.slice(cursor, cursor + MAX_BATCH);
      const ok = await postBatch(slice);
      if (!ok) {
        failed.push(...slice);
        // Stop sending more on first failure; keep ordering and try again later.
        cursor = all.length;
        break;
      }
      cursor += MAX_BATCH;
    }

    writeBuffer(failed);
  } finally {
    flushing = false;
  }
}

function schedule() {
  if (flushScheduled) return;
  flushScheduled = true;
  setTimeout(() => {
    void flushNow();
  }, FLUSH_INTERVAL_MS);
}

function attachLifecycleHandlers() {
  if (lifecycleAttached || typeof window === "undefined") return;
  lifecycleAttached = true;

  window.addEventListener("online", () => {
    void flushNow();
  });
  window.addEventListener("pagehide", () => {
    if (queue.length > 0) {
      writeBuffer(readBuffer().concat(queue));
      queue = [];
    }
  });

  if (intervalHandle === null) {
    intervalHandle = setInterval(() => {
      if (queue.length > 0 || readBuffer().length > 0) {
        void flushNow();
      }
    }, FLUSH_INTERVAL_MS * 6);
  }
}

/**
 * Record a single usage event. Fire-and-forget — never blocks UI, never throws.
 * surface: stable namespace string ("riskflow", "chat", "calendar", ...).
 * action: opaque verb ("view", "click", "filter", "promote", "ask_cao", "ask_harper" [legacy, migrating 2wk], ...).
 * // ask_harper deprecated 2026-05-08
 * // S35-T4: ask_cao is the primary action name; ask_harper stays as legacy dual-emit until 2026-05-08
 * targetId: optional opaque identifier (do NOT pass user-visible content).
 * metadata: optional small JSON-safe object (no prices, no order IDs).
 */
export function emit(
  surface: string,
  action: string,
  targetId?: string,
  metadata?: Record<string, unknown>,
): void {
  if (typeof window === "undefined") return;
  attachLifecycleHandlers();

  queue.push({
    surface,
    action,
    targetId,
    metadata,
  });

  if (queue.length >= FORCE_FLUSH_AT) {
    void flushNow();
  } else {
    schedule();
  }
}

export const __testing__ = {
  flushNow,
  readBuffer,
  writeBuffer,
};
