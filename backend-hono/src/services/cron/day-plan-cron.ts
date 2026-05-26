// [claude-code 2026-04-26] S45-T1: Day-plan cron — Mon-Fri 06:15 ET. Generates
// today's canonical day_plan + windows. Pattern cloned from
// arbitrum-session-scheduler.ts; node-cron in-process per
// memory:feedback_no_claude_routines.

import cron from "node-cron";
import { createLogger } from "../../lib/logger.js";
import { generateDayPlan } from "../day-plan/day-plan-service.js";

const log = createLogger("DayPlanCron");

const SCHEDULE = "15 6 * * 1-5";

let task: cron.ScheduledTask | null = null;
let running = false;
let lastFiredAt: string | null = null;

async function tick(): Promise<void> {
  try {
    const result = await generateDayPlan({});
    lastFiredAt = new Date().toISOString();
    log.info("Day-plan cron fired", {
      date: result.plan.date,
      planId: result.plan.id,
      reused: result.reused,
      persisted: result.persisted,
    });
  } catch (err) {
    log.error("Day-plan cron threw", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export function startDayPlanCron(): void {
  if (running) return;
  if (process.env.DAY_PLAN_CRON_ENABLED !== "true") {
    log.info(
      "Disabled by default; set DAY_PLAN_CRON_ENABLED=true to allow autonomous generation",
    );
    return;
  }

  task = cron.schedule(
    SCHEDULE,
    () => {
      tick().catch((err) =>
        log.warn("Day-plan tick failed (swallowed)", { error: String(err) }),
      );
    },
    { timezone: "America/New_York" },
  );
  running = true;
  log.info(`Registered Day-plan cron (${SCHEDULE} America/New_York)`);
}

export function stopDayPlanCron(): void {
  if (!running) return;
  task?.stop();
  task = null;
  running = false;
}

export function getLastDayPlanFiredAt(): string | null {
  return lastFiredAt;
}

export function isDayPlanCronActive(): boolean {
  return running;
}
