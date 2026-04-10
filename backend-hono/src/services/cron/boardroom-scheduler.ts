// [claude-code 2026-03-20] Boardroom cron scheduler — morning standup + news trigger scheduling
/**
 * Boardroom Scheduler
 *
 * Uses node-cron to trigger morning standup rounds at scheduled times.
 * Follows the same start/stop pattern as autopilot-scheduler.ts and econ-enricher.ts.
 *
 * Schedule (America/New_York, weekdays only):
 *   7:30 AM — Initial standup
 *   8:00 AM — 30-min check-in
 *   8:30 AM — Economic data scan
 *   9:00 AM — Pre-market final
 *   9:30 AM — Market open wrap
 */

import cron from "node-cron";
import { getEnabledSchedules } from "../../config/boardroom-cron.js";
import {
  spawnBoardroomStandup,
  type StandupTask,
} from "../boardroom-spawner.js";
import { createLogger } from "../../lib/logger.js";

const log = createLogger("BoardroomScheduler");

/** Map cron schedule IDs to StandupTask types */
const SCHEDULE_ID_TO_TASK: Record<string, StandupTask> = {
  "boardroom-standup-7-30": "morning-standup",
  "boardroom-standup-8-00": "checkin-8am",
  "boardroom-standup-8-30": "econ-scan",
  "boardroom-standup-9-00": "premarket",
  "boardroom-standup-9-30": "market-open",
};

let scheduledJobs: cron.ScheduledTask[] = [];
let isRunning = false;

/**
 * Start the boardroom cron scheduler.
 * Registers all enabled schedules from boardroom-cron.ts config.
 */
export function startBoardroomScheduler(): void {
  if (isRunning) {
    log.info(" Already running");
    return;
  }

  const schedules = getEnabledSchedules();

  if (schedules.length === 0) {
    log.info(" No enabled schedules found");
    return;
  }

  for (const schedule of schedules) {
    const task = SCHEDULE_ID_TO_TASK[schedule.id];
    if (!task) {
      log.warn(` Unknown schedule ID: ${schedule.id}, skipping`);
      continue;
    }

    const job = cron.schedule(
      schedule.cronExpression,
      async () => {
        console.log(`[BoardroomScheduler] Firing: ${schedule.description}`);
        try {
          await spawnBoardroomStandup(task);
        } catch (error) {
          log.error(` Failed to run ${task}:`, error);
        }
      },
      { timezone: schedule.timezone },
    );

    scheduledJobs.push(job);
    console.log(
      `[BoardroomScheduler] Registered: ${schedule.description} (${schedule.cronExpression} ${schedule.timezone})`,
    );
  }

  isRunning = true;
  console.log(`[BoardroomScheduler] Started ${scheduledJobs.length} cron jobs`);
}

/**
 * Stop all scheduled boardroom cron jobs.
 */
export function stopBoardroomScheduler(): void {
  if (!isRunning) return;

  for (const job of scheduledJobs) {
    job.stop();
  }
  scheduledJobs = [];
  isRunning = false;
  log.info(" Stopped all cron jobs");
}

/**
 * Check if the scheduler is currently running.
 */
export function isBoardroomSchedulerActive(): boolean {
  return isRunning;
}

/**
 * Get status of all registered cron jobs.
 */
export function getBoardroomSchedulerStatus(): {
  active: boolean;
  jobCount: number;
  schedules: Array<{
    id: string;
    description: string;
    cron: string;
    timezone: string;
  }>;
} {
  const schedules = getEnabledSchedules();
  return {
    active: isRunning,
    jobCount: scheduledJobs.length,
    schedules: schedules.map((s) => ({
      id: s.id,
      description: s.description,
      cron: s.cronExpression,
      timezone: s.timezone,
    })),
  };
}
