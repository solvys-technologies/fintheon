// [claude-code 2026-05-13] S64-T1: added triggerWeekPlan() for TWT-publish-driven weekly
//   plan generation. Called from brief-generator.ts after TWT completes.
// [claude-code 2026-04-28] S48-T2: CAO Desk Plan midnight pulse.
// Runs at 00:00 ET weekdays. Harper polls economic_events for today's
// scheduled prints and produces a desk_plan with countdown timestamps.
// Frontend SessionCountdownWidget reads from the in-memory cache + SSE.

import cron from "node-cron";
import { createLogger } from "../lib/logger.js";
import { getSupabaseClient } from "../config/supabase.js";
import { planWeek } from "./day-plan/window-scheduler.js";
import { generateDayPlan, readDayPlan } from "./day-plan/day-plan-service.js";

const log = createLogger("DeskPlanner");

const SCHEDULE = "0 0 * * 1-5";

let task: cron.ScheduledTask | null = null;
let running = false;
let lastGeneratedAt: string | null = null;

export interface DeskPlanEvent {
  name: string;
  time: string;
  forecast: string;
  previous: string;
  priority: "critical" | "high" | "medium" | "low";
  countdownTo: string;
}

export interface DeskPlan {
  date: string;
  events: DeskPlanEvent[];
  generatedAt: string;
}

let cachedPlan: DeskPlan | null = null;

function priorityLabel(importance: string | null): DeskPlanEvent["priority"] {
  switch (importance?.toLowerCase()) {
    case "high":
    case "critical":
      return "high";
    case "medium":
      return "medium";
    default:
      return "low";
  }
}

async function tick(): Promise<void> {
  const sb = getSupabaseClient();
  if (!sb) {
    log.warn("DeskPlan tick skipped (no Supabase client)");
    return;
  }

  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "America/New_York",
  });

  try {
    const { data, error } = await sb
      .from("economic_events")
      .select("name, time_est, forecast, previous, importance")
      .eq("date", today)
      .order("time_est", { ascending: true });

    if (error) {
      log.error("DeskPlan query failed", { error: error.message });
      return;
    }

    const events: DeskPlanEvent[] = (data ?? []).map((row: any) => {
      const timeStr = row.time_est ?? "";
      const [h, m] = timeStr.split(":").map(Number);
      const countdown = new Date();
      countdown.setHours(h ?? 0, m ?? 0, 0, 0);
      return {
        name: row.name ?? "",
        time: timeStr,
        forecast: row.forecast ?? "",
        previous: row.previous ?? "",
        priority: priorityLabel(row.importance),
        countdownTo: countdown.toISOString(),
      };
    });

    cachedPlan = {
      date: today,
      events,
      generatedAt: new Date().toISOString(),
    };

    lastGeneratedAt = cachedPlan.generatedAt;

    log.info("DeskPlan generated", {
      date: today,
      eventCount: events.length,
    });
  } catch (err) {
    log.error("DeskPlan tick threw", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Trigger a week-long desk plan generation. Called from brief-generator.ts
 * after TWT (Weekly Tribune) is published. Generates day plans for the next
 * 5 weekdays using the window scheduler.
 */
export async function triggerWeekPlan(): Promise<void> {
  if (running) {
    log.info("triggerWeekPlan skipped — already running");
    return;
  }

  running = true;
  try {
    const plannedDays = await planWeek(new Date());
    log.info("triggerWeekPlan: planning week", {
      dayCount: plannedDays.length,
    });

    for (const day of plannedDays) {
      const ref = new Date(`${day.date}T12:00:00Z`);
      const existing = await readDayPlan("pic", day.date);
      if (existing) {
        log.info("Day plan already exists, skipping", { date: day.date });
        continue;
      }

      try {
        await generateDayPlan({
          date: ref,
          generatedBy: "twt-trigger",
          override: false,
        });
        log.info("Day plan generated from TWT trigger", { date: day.date });
      } catch (planErr) {
        log.warn("Day plan generation from TWT trigger failed", {
          date: day.date,
          error: planErr instanceof Error ? planErr.message : String(planErr),
        });
      }
    }

    lastGeneratedAt = new Date().toISOString();
    log.info("triggerWeekPlan complete", { dayCount: plannedDays.length });
  } catch (err) {
    log.error("triggerWeekPlan failed", {
      error: err instanceof Error ? err.message : String(err),
    });
  } finally {
    running = false;
  }
}

export function startDeskPlanCron(): void {
  if (running) return;
  if (process.env.DESK_PLAN_CRON_ENABLED === "false") {
    log.info("Disabled via DESK_PLAN_CRON_ENABLED=false");
    return;
  }

  task = cron.schedule(
    SCHEDULE,
    () => {
      tick().catch((err) =>
        log.warn("DeskPlan tick failed (swallowed)", { error: String(err) }),
      );
    },
    { timezone: "America/New_York" },
  );
  running = true;
  log.info(`DeskPlan cron registered (${SCHEDULE} America/New_York)`);
}

export function stopDeskPlanCron(): void {
  if (!running) return;
  task?.stop();
  task = null;
  running = false;
}

export function getLatestDeskPlan(): DeskPlan | null {
  return cachedPlan;
}

export function getLastGeneratedAt(): string | null {
  return lastGeneratedAt;
}

export function isDeskPlanCronActive(): boolean {
  return running;
}
