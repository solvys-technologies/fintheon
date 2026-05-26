// [claude-code 2026-05-15] S66-T1: extended triggerWeekPlan for multi-week generation.
//   Added weekCount parameter, pre-session price fetch cron.
// [claude-code 2026-05-13] S64-T1: added triggerWeekPlan() for TWT-publish-driven weekly
//   plan generation. Called from brief-generator.ts after TWT completes.
// [claude-code 2026-04-28] S48-T2: CAO Desk Plan midnight pulse.
// Runs at 00:00 ET weekdays. Harper polls economic_events for today's
// scheduled prints and produces a desk_plan with countdown timestamps.
// Frontend SessionCountdownWidget reads from the in-memory cache + SSE.

import cron from "node-cron";
import { createLogger } from "../lib/logger.js";
import { getSupabaseClient } from "../config/supabase.js";
import { refreshPricesFromTV } from "./iv-scoring/instrument.js";

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
 * Trigger desk plan generation for one or more weeks. Called from
 * brief-generator.ts after TWT (Weekly Tribune) is published. Generates day
 * plans for the specified number of weeks ahead using the window scheduler.
 */
export async function triggerWeekPlan(options?: {
  weekCount?: number;
}): Promise<void> {
  log.info("triggerWeekPlan skipped — Desk Plans are user-controlled", {
    requestedWeeks: options?.weekCount ?? 4,
  });
}

const PRE_SESSION_SCHEDULE = "*/15 * * * 1-5";

let preSessionTask: cron.ScheduledTask | null = null;
let preSessionRunning = false;

async function preSessionTick(): Promise<void> {
  if (preSessionRunning) return;
  preSessionRunning = true;

  try {
    const now = new Date(
      new Date().toLocaleString("en-US", { timeZone: "America/New_York" }),
    );
    const hh = now.getHours();
    const mm = now.getMinutes();
    const nowTotal = hh * 60 + mm;

    const sb = getSupabaseClient();
    if (!sb) return;

    // Find windows starting in exactly 30 minutes
    const dateIso = now.toISOString().slice(0, 10);

    const { data: plans } = await sb
      .from("day_plans")
      .select("id")
      .eq("team_id", "pic")
      .eq("date", dateIso);
    if (!plans || plans.length === 0) return;

    const planIds = plans.map((p) => p.id);
    const { data: windows } = await sb
      .from("day_plan_windows")
      .select("*")
      .in("day_plan_id", planIds)
      .is("session_price", null);

    if (!windows || windows.length === 0) return;

    const targets: string[] = [];
    for (const w of windows) {
      const startStr: string = w.start_time;
      const [sH, sM] = startStr.split(":").map(Number);
      const startTotal = (sH ?? 0) * 60 + (sM ?? 0);
      // 30 min before window start
      if (Math.abs(startTotal - nowTotal - 30) <= 15) {
        const instrument = DEFAULT_INSTRUMENT;
        if (!targets.includes(instrument)) targets.push(instrument);
      }
    }

    if (targets.length > 0) {
      const prices = await refreshPricesFromTV(targets).catch(() => new Map());
      if (prices.size > 0) {
        for (const w of windows) {
          const inst = DEFAULT_INSTRUMENT;
          const price = prices.get(inst);
          if (price != null) {
            await sb
              .from("day_plan_windows")
              .update({ session_price: price })
              .eq("id", w.id);
          }
        }
        log.info("Pre-session prices fetched", {
          instruments: targets,
          priceCount: prices.size,
        });
      }
    }
  } catch (err) {
    log.warn("Pre-session price tick failed", {
      error: err instanceof Error ? err.message : String(err),
    });
  } finally {
    preSessionRunning = false;
  }
}

const DEFAULT_INSTRUMENT = "/NQ";

export function startDeskPlanCron(): void {
  if (running) return;
  if (process.env.DESK_PLAN_CRON_ENABLED !== "true") {
    log.info(
      "Disabled by default; set DESK_PLAN_CRON_ENABLED=true to allow legacy countdown cache generation",
    );
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

  preSessionTask = cron.schedule(
    PRE_SESSION_SCHEDULE,
    () => {
      preSessionTick().catch((err) =>
        log.warn("Pre-session tick failed (swallowed)", { error: String(err) }),
      );
    },
    { timezone: "America/New_York" },
  );
  log.info(
    `Pre-session price cron registered (${PRE_SESSION_SCHEDULE} America/New_York)`,
  );
}

export function stopDeskPlanCron(): void {
  if (!running) return;
  task?.stop();
  task = null;
  preSessionTask?.stop();
  preSessionTask = null;
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
