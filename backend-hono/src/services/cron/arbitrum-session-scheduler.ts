// [claude-code 2026-04-24] S35-T1/T12 Phase B: Arbitrum session scheduler.
// Fires the 5-seat chamber at 17:00 ET weekdays (Mon-Fri) for a macro
// session digest. Output persists to arbitrum_verdicts with trigger_type=
// "session"; PMDB at 17:15 ET picks it up via getLatestChamberRead() (T11).
//
// Pattern cloned from econ-keyword-scheduler.ts — node-cron in-process,
// never a hosted Routine (memory: feedback_no_claude_routines). Gated by
// ARBITRUM_SESSION_SCHEDULER_ENABLED; defaults on.

import cron from "node-cron";
import { createLogger } from "../../lib/logger.js";
import { runChamber } from "../arbitrum/engine.js";

const log = createLogger("ArbitrumSessionCron");

// Mon-Fri at 17:00 America/New_York (cron DoW: 1=Mon ... 5=Fri)
const SESSION_CRON = "0 17 * * 1-5";

let task: cron.ScheduledTask | null = null;
let running = false;
let lastFiredAt: string | null = null;

function buildSessionInput(): {
  question: string;
  category: string;
  context: string;
} {
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "America/New_York",
  });
  return {
    question: `End-of-session read for ${dateStr}: what is the chamber's consensus on market posture heading into the next session, and where is the dissent?`,
    category: "session-digest",
    context:
      "This is the 17:00 ET daily chamber. Synthesize today's price action, headline flow, and macro backdrop into a probabilistic forward read. PMDB will consume this at 17:15 ET.",
  };
}

async function tick(): Promise<void> {
  try {
    const input = buildSessionInput();
    const { verdict, persisted } = await runChamber(input, "session");
    lastFiredAt = new Date().toISOString();
    log.info("Arbitrum session cron completed", {
      verdict_id: verdict.verdict_id,
      persisted,
      consensus_probability: verdict.consensus_probability,
      dissent: verdict.dissent?.seat ?? null,
    });
  } catch (err) {
    log.error("Arbitrum session cron threw", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export function startArbitrumSessionScheduler(): void {
  if (running) return;
  if (process.env.ARBITRUM_SESSION_SCHEDULER_ENABLED === "false") {
    log.info("Disabled via ARBITRUM_SESSION_SCHEDULER_ENABLED=false");
    return;
  }

  task = cron.schedule(
    SESSION_CRON,
    () => {
      tick().catch((err) =>
        log.warn("Session tick failed (swallowed)", { error: String(err) }),
      );
    },
    { timezone: "America/New_York" },
  );
  running = true;
  log.info(
    `Registered Arbitrum session chamber (${SESSION_CRON} America/New_York)`,
  );
}

export function stopArbitrumSessionScheduler(): void {
  if (!running) return;
  task?.stop();
  task = null;
  running = false;
  log.info("Stopped Arbitrum session scheduler");
}

export function isArbitrumSessionSchedulerActive(): boolean {
  return running;
}

export function getLastArbitrumSessionFiredAt(): string | null {
  return lastFiredAt;
}
