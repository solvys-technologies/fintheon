// [claude-code 2026-04-24] S35-T5: TOTT/WT → TWT rename (The Weekly Tribune)
// [claude-code 2026-03-22] Dispatch briefing scheduler — cron-driven MDB/ADB/PMDB/TWT generation
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
 *   4:30 PM Sunday — TWT (The Weekly Tribune)
 */

import cron from "node-cron";
import { generateBrief, wasBriefGeneratedToday } from "../brief-generator.js";
import { appendToBoardroom } from "../hermes-sessions.js";
import { startPrediction } from "../agent-desk/agent-desk-service.js";
import { runMarketImpactEnrichment } from "./market-impact-enricher.js";
import { createLogger } from "../../lib/logger.js";
import type { BriefType } from "../supabase-service.js";

const log = createLogger("DispatchScheduler");

interface DispatchJob {
  id: string;
  briefType: BriefType;
  cronExpression: string;
  timezone: string;
  description: string;
}

const DISPATCH_JOBS: DispatchJob[] = [
  {
    id: "dispatch-mdb",
    briefType: "MDB",
    cronExpression: "30 6 * * 1-5",
    timezone: "America/New_York",
    description: "Morning Daily Brief (6:30 AM ET, weekdays)",
  },
  {
    id: "dispatch-adb",
    briefType: "ADB",
    cronExpression: "45 10 * * 1-5",
    timezone: "America/New_York",
    description: "Afternoon Daily Brief (10:45 AM ET, weekdays)",
  },
  {
    id: "dispatch-pmdb",
    briefType: "PMDB",
    cronExpression: "15 17 * * 1-5",
    timezone: "America/New_York",
    description: "Post-Market Daily Brief (5:15 PM ET, weekdays)",
  },
  {
    id: "dispatch-twt",
    briefType: "TWT",
    cronExpression: "30 16 * * 0",
    timezone: "America/New_York",
    description: "The Weekly Tribune (4:30 PM ET, Sunday)",
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
      await appendToBoardroom(`${label}\n${result.content}`, "assistant");
    } catch {
      // Non-fatal — brief is still stored in Supabase
    }

    // Fire-and-forget: trigger AgentDesk ArbitrumChamber after every brief
    startPrediction(
      { lanes: [], catalysts: [], ropes: [] },
      undefined,
      "full-brief",
    ).catch((err) => log.warn(`Post-brief ArbitrumChamber trigger failed:`, err));

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
    log.info("Already running");
    return;
  }

  // Check if dispatch scheduling is disabled via env
  if (process.env.DISPATCH_SCHEDULER_ENABLED === "false") {
    log.info(
      "Dispatch scheduler disabled via DISPATCH_SCHEDULER_ENABLED=false",
    );
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
      { timezone: job.timezone },
    );

    scheduledJobs.push(cronJob);
    log.info(
      `Registered: ${job.description} (${job.cronExpression} ${job.timezone})`,
    );
  }

  // Market impact enricher — 6 PM ET (22:00 UTC) weekdays
  const marketImpactJob = cron.schedule(
    "0 18 * * 1-5",
    () => {
      runMarketImpactEnrichment()
        .then((r) =>
          log.info(
            `Market impact: ${r.enriched}/${r.processed} enriched, ${r.errors} errors`,
          ),
        )
        .catch((err) => log.error("Market impact cron error:", err));
    },
    { timezone: "America/New_York" },
  );
  scheduledJobs.push(marketImpactJob);
  log.info("Registered: Market Impact Enricher (6:00 PM ET, weekdays)");

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
  log.info("Stopped all dispatch cron jobs");
}

/**
 * Catch-up: on boot, check if any scheduled briefs were missed today and generate them.
 * This handles the common case where the local backend wasn't running at cron time.
 */
export async function catchUpMissedBriefs(): Promise<void> {
  if (process.env.DISPATCH_SCHEDULER_ENABLED === "false") return;

  const now = new Date();
  const day = now.getDay(); // 0=Sun
  const h = now.getHours();
  const m = now.getMinutes();
  const timeVal = h * 60 + m;

  // Determine which briefs SHOULD have fired by now
  const dueJobs: DispatchJob[] = [];

  for (const job of DISPATCH_JOBS) {
    // Parse cron day-of-week field (e.g. '1-5' or '0')
    const cronParts = job.cronExpression.split(" ");
    const cronMin = parseInt(cronParts[0], 10);
    const cronHour = parseInt(cronParts[1], 10);
    const cronDow = cronParts[4]; // day-of-week field

    // Check if today matches the day-of-week
    const dowMatch =
      cronDow === "*" ||
      cronDow.split(",").some((seg) => {
        if (seg.includes("-")) {
          const [lo, hi] = seg.split("-").map(Number);
          return day >= lo && day <= hi;
        }
        return parseInt(seg, 10) === day;
      });
    if (!dowMatch) continue;

    // Check if the scheduled time has already passed
    const jobTimeVal = cronHour * 60 + cronMin;
    if (timeVal >= jobTimeVal) {
      dueJobs.push(job);
    }
  }

  if (dueJobs.length === 0) {
    log.info("Catch-up: no missed briefs for today");
    return;
  }

  log.info(
    `Catch-up: checking ${dueJobs.length} briefs that should exist by now`,
  );

  for (const job of dueJobs) {
    try {
      const alreadyDone = await wasBriefGeneratedToday(job.briefType);
      if (alreadyDone) {
        log.info(`Catch-up: ${job.briefType} already exists — skip`);
        continue;
      }

      log.info(`Catch-up: generating missed ${job.briefType}`);
      const result = await generateBrief(job.briefType);

      try {
        await appendToBoardroom(
          `[${job.briefType}]\n${result.content}`,
          "assistant",
        );
      } catch {
        /* non-fatal */
      }

      // Fire-and-forget: trigger AgentDesk ArbitrumChamber after catch-up brief
      startPrediction(
        { lanes: [], catalysts: [], ropes: [] },
        undefined,
        "full-brief",
      ).catch((err) =>
        log.warn(`Catch-up post-brief ArbitrumChamber trigger failed:`, err),
      );

      log.info(`Catch-up: ${job.briefType} generated`, {
        supabaseId: result.supabaseId,
      });
    } catch (err) {
      log.error(`Catch-up: ${job.briefType} failed:`, err);
    }
  }
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
  jobs: Array<{
    id: string;
    briefType: BriefType;
    description: string;
    cron: string;
  }>;
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
