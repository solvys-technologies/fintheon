// [claude-code 2026-04-25] S40-P6: Time-To-Print scheduler — drives the
// imminent → live → printed → cleared SSE state machine.
//
//   imminent  T-5min from next eligible event (fade in via t-panel-slide)
//   live      T-0:00 (pulse on countdown digits, awaiting actual)
//   printed   actual arrives via econ-print or earnings.update
//   cleared   T+30s post-print (fade out)
//
// Polls the eligibility view every 30s. The cadence inside the 5-min window
// tightens to 5s to drive timely state transitions.

import { createLogger } from "../../lib/logger.js";
import { getNextEligibleEvents } from "./eligibility.js";
import {
  broadcastTimeToPrint,
  type TimeToPrintPayload,
} from "../riskflow/sse-broadcaster.js";

const log = createLogger("TimeToPrintScheduler");

const POLL_FAR_MS = 30_000;
const POLL_NEAR_MS = 5_000;
const PRE_FADE_MS = 5 * 60_000; // T-5min
const POST_FADE_MS = 30_000;

interface ActiveEvent {
  id: string;
  fires_at: string;
  state: TimeToPrintPayload["state"];
  emittedAt: number;
}

const active = new Map<string, ActiveEvent>();
let pollTimer: NodeJS.Timeout | null = null;
let running = false;

function payloadFor(
  e: Awaited<ReturnType<typeof getNextEligibleEvents>>[number],
  state: TimeToPrintPayload["state"],
): TimeToPrintPayload {
  return {
    id: e.id,
    fires_at: e.fires_at,
    state,
    event: {
      name: e.name,
      country: e.country,
      forecast: e.forecast,
      actual: e.actual,
      beatMiss: e.beatMiss,
      surprisePercent: e.surprisePercent,
      impactRank: e.impactRank,
    },
  };
}

async function tick(): Promise<void> {
  const events = await getNextEligibleEvents({
    windowMinutes: 6, // 5-min UI window + 1-min slack
    country: "US",
  });

  const now = Date.now();
  const seenIds = new Set<string>();

  for (const e of events) {
    seenIds.add(e.id);
    const fires = new Date(e.fires_at).getTime();
    const delta = fires - now;
    const existing = active.get(e.id);

    // Imminent — within T-5min, before actual.
    if (delta <= PRE_FADE_MS && delta > 0 && !e.actual) {
      if (!existing || existing.state === "cleared") {
        const payload = payloadFor(e, "imminent");
        broadcastTimeToPrint(payload);
        active.set(e.id, {
          id: e.id,
          fires_at: e.fires_at,
          state: "imminent",
          emittedAt: now,
        });
      }
      continue;
    }

    // Live — passed fires_at, no actual yet.
    if (delta <= 0 && !e.actual) {
      if (!existing || existing.state !== "live") {
        broadcastTimeToPrint(payloadFor(e, "live"));
        active.set(e.id, {
          id: e.id,
          fires_at: e.fires_at,
          state: "live",
          emittedAt: now,
        });
      }
      continue;
    }

    // Printed — actual present.
    if (e.actual && (!existing || existing.state !== "printed")) {
      broadcastTimeToPrint(payloadFor(e, "printed"));
      active.set(e.id, {
        id: e.id,
        fires_at: e.fires_at,
        state: "printed",
        emittedAt: now,
      });
      continue;
    }

    // Cleared — printed event past POST_FADE window.
    if (
      existing &&
      existing.state === "printed" &&
      now - existing.emittedAt > POST_FADE_MS
    ) {
      broadcastTimeToPrint(payloadFor(e, "cleared"));
      active.delete(e.id);
    }
  }

  // Tear down any active events that no longer appear in the eligibility set
  // (e.g. fell off the 6-min window without a printed result).
  for (const [id, entry] of active) {
    if (!seenIds.has(id) && now - entry.emittedAt > POST_FADE_MS) {
      // We can't broadcast a "cleared" without the event payload, so just
      // drop. The frontend treats no event === clear.
      active.delete(id);
    }
  }
}

function pollIntervalForActive(): number {
  for (const entry of active.values()) {
    if (entry.state === "imminent" || entry.state === "live") {
      return POLL_NEAR_MS;
    }
  }
  return POLL_FAR_MS;
}

function loop(): void {
  if (!running) return;
  tick()
    .catch((err) =>
      log.warn("TTP tick threw (swallowed)", { error: String(err) }),
    )
    .finally(() => {
      pollTimer = setTimeout(loop, pollIntervalForActive());
    });
}

export function startTimeToPrintScheduler(): void {
  if (running) return;
  if (process.env.TIME_TO_PRINT_ENABLED === "false") {
    log.info("Disabled via TIME_TO_PRINT_ENABLED=false");
    return;
  }
  running = true;
  loop();
  log.info("Started — polling eligibility every 5-30s");
}

export function stopTimeToPrintScheduler(): void {
  if (!running) return;
  running = false;
  if (pollTimer) clearTimeout(pollTimer);
  pollTimer = null;
}
