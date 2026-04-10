// [claude-code 2026-04-03] REFLECT scheduler — runs nightly analysis of news scoring quality
// Triggers at 04:00 UTC daily. Results available for Harper morning standup.

import { runReflect } from "./reflect-engine.js";
import { createLogger } from "../../lib/logger.js";

const log = createLogger("REFLECTScheduler");

let schedulerTimer: ReturnType<typeof setTimeout> | null = null;
let isRunning = false;

/**
 * Start the REFLECT scheduler. Runs at 04:00 UTC daily.
 */
export function startReflectScheduler(): void {
  if (process.env.ENABLE_REFLECT !== "true") {
    log.info("REFLECT disabled (set ENABLE_REFLECT=true to enable)");
    return;
  }

  log.info("REFLECT scheduler started — runs daily at 04:00 UTC");
  scheduleNextRun();
}

export function stopReflectScheduler(): void {
  if (schedulerTimer) {
    clearTimeout(schedulerTimer);
    schedulerTimer = null;
    log.info("REFLECT scheduler stopped");
  }
}

function scheduleNextRun(): void {
  const now = new Date();
  const next = new Date(now);
  next.setUTCHours(4, 0, 0, 0);

  // If 04:00 UTC already passed today, schedule for tomorrow
  if (next.getTime() <= now.getTime()) {
    next.setUTCDate(next.getUTCDate() + 1);
  }

  const delayMs = next.getTime() - now.getTime();
  log.info(
    `Next REFLECT run at ${next.toISOString()} (in ${(delayMs / 3600000).toFixed(1)}h)`,
  );

  schedulerTimer = setTimeout(async () => {
    await executeReflect();
    scheduleNextRun(); // Reschedule for next day
  }, delayMs);
}

async function executeReflect(): Promise<void> {
  if (isRunning) {
    log.warn("REFLECT already running — skipping");
    return;
  }

  isRunning = true;
  log.info("Starting nightly REFLECT analysis...");

  try {
    const report = await runReflect(7); // Last 7 days
    log.info(
      `REFLECT complete: ${report.findings.length} findings, ${report.adjustments.length} adjustments`,
    );
    log.info(`Summary: ${report.summary}`);
  } catch (err) {
    log.error("REFLECT failed:", {
      error: err instanceof Error ? err.message : String(err),
    });
  } finally {
    isRunning = false;
  }
}

/**
 * Manually trigger a REFLECT run (for testing or on-demand).
 */
export async function triggerReflect(daysBack: number = 7) {
  return runReflect(daysBack);
}

export function isReflectRunning(): boolean {
  return isRunning;
}
