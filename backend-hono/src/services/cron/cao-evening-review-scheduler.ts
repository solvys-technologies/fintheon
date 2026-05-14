// [claude-code 2026-05-13] T4: CAO evening review cron.
// Fires at 17:00 ET Sun-Thu and enqueues an evening-review task for Harper.
// Harper's autonomous loop picks it up, reads EVENING_REVIEW_SKILL_INSTRUCTIONS,
// and performs the review workflow. Does NOT call the day-plan API directly.
//
// Pattern cloned from arbitrum-session-scheduler.ts — node-cron in-process,
// uses enqueueTask from the Harper autonomous loop when available. Falls back
// to ops-feed logging if the loop isn't active. Gated by
// CAO_EVENING_REVIEW_ENABLED; defaults on.

import cron from "node-cron";
import { createLogger } from "../../lib/logger.js";

const log = createLogger("CaoEveningReviewCron");

// Sun-Thu at 17:00 America/New_York (cron DoW: 0=Sun, 1=Mon ... 4=Thu)
const EVENING_REVIEW_CRON = "0 17 * * 0-4";

let task: cron.ScheduledTask | null = null;
let running = false;
let lastFiredAt: string | null = null;

/**
 * Enqueue an evening-review task for Harper's autonomous loop.
 * Harper reads [SKILL:EVENING_REVIEW] from the task context and
 * executes the review workflow (checks econ events, WH Pool Call,
 * speeches, cross-border macro, then POSTs updates to day-plan API).
 */
async function tick(): Promise<void> {
  try {
    // Try to enqueue through Harper's autonomous loop
    const { enqueueTask } =
      await import("../harper-autonomous/loop-manager.js");

    const enqueued = enqueueTask({
      type: "evening-review",
      payload: {
        trigger: "cron:17:00-et",
        instructionsSource: "evening-review-instructions",
        timestamp: new Date().toISOString(),
      },
      priority: "normal",
    });

    if (enqueued) {
      lastFiredAt = new Date().toISOString();
      log.info("CAO evening review task enqueued for Harper");
    } else {
      log.warn("CAO evening review task NOT enqueued (queue full or dedup)");
    }
  } catch (err) {
    // Autonomous loop not available — log and skip
    log.info(
      "CAO evening review: Harper autonomous loop unavailable (non-fatal). Evening review will not auto-trigger.",
    );
  }
}

export function startCaoEveningReviewScheduler(): void {
  if (running) return;
  if (process.env.CAO_EVENING_REVIEW_ENABLED === "false") {
    log.info("Disabled via CAO_EVENING_REVIEW_ENABLED=false");
    return;
  }

  task = cron.schedule(
    EVENING_REVIEW_CRON,
    () => {
      tick().catch((err) =>
        log.warn("CAO evening review tick failed (swallowed)", {
          error: String(err),
        }),
      );
    },
    { timezone: "America/New_York" },
  );
  running = true;
  log.info(
    `Registered CAO evening review cron (${EVENING_REVIEW_CRON} America/New_York)`,
  );
}

export function stopCaoEveningReviewScheduler(): void {
  if (!running) return;
  task?.stop();
  task = null;
  running = false;
  log.info("Stopped CAO evening review scheduler");
}

export function isCaoEveningReviewSchedulerActive(): boolean {
  return running;
}

export function getLastCaoEveningReviewFiredAt(): string | null {
  return lastFiredAt;
}
