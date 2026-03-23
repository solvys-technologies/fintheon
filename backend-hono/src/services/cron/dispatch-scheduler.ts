// [claude-code 2026-03-22] Dispatch briefing scheduler — cron-driven MDB/ADB/PMDB/TOTT generation
/**
 * Dispatch Scheduler
 *
 * Automates the 4 recurring Harper briefings that were previously run by
 * Perplexity Computer cron jobs. Generates briefs via AI and stores in Supabase.
 *
 * Schedule (America/New_York, weekdays unless noted):
 *   6:30 AM  — MDB  (Morning Daily Brief)
 *   10:45 AM — ADB  (Afternoon Daily Brief)
 *   5:15 PM  — PMDB (Post-Market Daily Brief)
 *   4:30 PM Sunday — TOTT (Tale of the Tape / Weekly Tribune)
 */

import cron from 'node-cron';
import { generateBrief, wasBriefGeneratedToday } from '../brief-generator.js';
import { appendToBoardroom } from '../hermes-sessions.js';
import { createLogger } from '../../lib/logger.js';
import type { BriefType } from '../supabase-service.js';

const log = createLogger('DispatchScheduler');

interface DispatchJob {
  id: string;
  briefType: BriefType;
  cronExpression: string;
  timezone: string;
  description: string;
}

const DISPATCH_JOBS: DispatchJob[] = [
  {
    id: 'dispatch-mdb',
    briefType: 'MDB',
    cronExpression: '30 6 * * 1-5',
    timezone: 'America/New_York',
    description: 'Morning Daily Brief (6:30 AM ET, weekdays)',
  },
  {
    id: 'dispatch-adb',
    briefType: 'ADB',
    cronExpression: '45 10 * * 1-5',
    timezone: 'America/New_York',
    description: 'Afternoon Daily Brief (10:45 AM ET, weekdays)',
  },
  {
    id: 'dispatch-pmdb',
    briefType: 'PMDB',
    cronExpression: '15 17 * * 1-5',
    timezone: 'America/New_York',
    description: 'Post-Market Daily Brief (5:15 PM ET, weekdays)',
  },
  {
    id: 'dispatch-tott',
    briefType: 'TOTT',
    cronExpression: '30 16 * * 0',
    timezone: 'America/New_York',
    description: 'Tale of the Tape (4:30 PM ET, Sunday)',
  },
];

let scheduledJobs: cron.ScheduledTask[] = [];
let isRunning = false;

/**
 * Run a single dispatch briefing — generate, store, and post to boardroom.
 */
async function runDispatch(job: DispatchJob): Promise<void> {
  log.info(`Generating ${job.briefType} dispatch`);

  // Skip if already generated today (idempotency guard)
  const alreadyDone = await wasBriefGeneratedToday(job.briefType);
  if (alreadyDone) {
    log.info(`${job.briefType} already generated today — skipping`);
    return;
  }

  try {
    const result = await generateBrief(job.briefType);

    // Post to boardroom for agent visibility
    try {
      const label = `[${job.briefType}]`;
      await appendToBoardroom(`${label}\n${result.content}`, 'assistant');
    } catch {
      // Non-fatal — brief is still stored in Supabase
    }

    log.info(`${job.briefType} dispatch complete`, {
      supabaseId: result.supabaseId,
      length: result.content.length,
    });
  } catch (err) {
    log.error(`${job.briefType} dispatch failed:`, err);
  }
}

/**
 * Start the dispatch briefing scheduler.
 * Registers cron jobs for all 4 briefing types.
 */
export function startDispatchScheduler(): void {
  if (isRunning) {
    log.info('Already running');
    return;
  }

  // Check if dispatch scheduling is disabled via env
  if (process.env.DISPATCH_SCHEDULER_ENABLED === 'false') {
    log.info('Dispatch scheduler disabled via DISPATCH_SCHEDULER_ENABLED=false');
    return;
  }

  for (const job of DISPATCH_JOBS) {
    const cronJob = cron.schedule(
      job.cronExpression,
      () => {
        runDispatch(job).catch((err) => {
          log.error(`Dispatch cron error for ${job.id}:`, err);
        });
      },
      { timezone: job.timezone }
    );

    scheduledJobs.push(cronJob);
    log.info(`Registered: ${job.description} (${job.cronExpression} ${job.timezone})`);
  }

  isRunning = true;
  log.info(`Started ${scheduledJobs.length} dispatch cron jobs`);
}

/**
 * Stop all dispatch cron jobs.
 */
export function stopDispatchScheduler(): void {
  if (!isRunning) return;
  for (const job of scheduledJobs) {
    job.stop();
  }
  scheduledJobs = [];
  isRunning = false;
  log.info('Stopped all dispatch cron jobs');
}

/**
 * Check if the dispatch scheduler is running.
 */
export function isDispatchSchedulerActive(): boolean {
  return isRunning;
}

/**
 * Get status of all dispatch cron jobs.
 */
export function getDispatchSchedulerStatus(): {
  active: boolean;
  jobCount: number;
  jobs: Array<{ id: string; briefType: BriefType; description: string; cron: string }>;
} {
  return {
    active: isRunning,
    jobCount: scheduledJobs.length,
    jobs: DISPATCH_JOBS.map((j) => ({
      id: j.id,
      briefType: j.briefType,
      description: j.description,
      cron: j.cronExpression,
    })),
  };
}
