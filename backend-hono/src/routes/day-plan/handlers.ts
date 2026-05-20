// [claude-code 2026-05-15] S66-T1: added GET /multi-week endpoint for multi-week desk plan cycling.
// [claude-code 2026-04-26] S45-T1: Day-plan API handlers.
// GET /today, GET /week, GET /streak, GET /drift-status, POST /feedback,
// GET /feedback?range=week.
// [claude-code 2026-05-13] T4: Added handlePostCaoEveningReview().

import type { Context } from "hono";
import { z } from "zod";
import { getSupabaseClient } from "../../config/supabase.js";
import { createLogger } from "../../lib/logger.js";
import {
  generateDayPlan,
  readDayPlan,
  readWeekPlans,
} from "../../services/day-plan/day-plan-service.js";
import { planWeek, planWeeks } from "../../services/day-plan/window-scheduler.js";
import {
  generateEconForecast,
  isSpeechEvent,
} from "../../services/econ-forecast/econ-forecast-service.js";
import { readEconEvents } from "../../services/supabase-service.js";
import { getLastDriftEvent } from "../../services/desk-drift/drift-monitor.js";
import { isInsideAnyWindow } from "../../services/desk-drift/dead-volume-rule.js";
import type {
  DayPlan,
  DayPlanWindow,
  DriftStatus,
  StreakResponse,
  WeekDayEntry,
} from "../../types/day-plan.js";

const log = createLogger("DayPlanHandlers");

const TEAM_ID = "pic";

const FeedbackSchema = z.object({
  window_id: z.string().uuid(),
  action: z.enum(["followed", "faded", "sat_out"]),
  reason_code: z.string().max(64).optional(),
  reason_text: z.string().max(2000).optional(),
  fill_price: z.number().optional(),
  outcome_pnl: z.number().optional(),
});

/** Schema for a single window update from the CAO evening review. */
const TradingWindowUpdateSchema = z.object({
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "HH:MM format required"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "HH:MM format required"),
  eventName: z.string().max(256).optional(),
  catalystDetail: z.string().max(1024).optional(),
  expectedMovePct: z.number().min(0).max(100).optional(),
  pricesOfInterest: z.array(z.number()).optional(),
  entries: z.array(z.number()).optional(),
});

/** Schema for the CAO evening review POST body. */
const CaoEveningReviewSchema = z.object({
  windows: z.array(TradingWindowUpdateSchema).min(1).max(10),
  reason: z.string().min(1).max(2000),
});

export async function handleGetToday(c: Context): Promise<Response> {
  let plan: DayPlan | null = null;
  try {
    const result = await generateDayPlan({ teamId: TEAM_ID });
    plan = result.plan;
  } catch (err) {
    log.warn("on-demand day-plan generation failed", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
  return c.json({ plan });
}

export async function handleGetWeek(c: Context): Promise<Response> {
  const planned = await planWeek(new Date());
  const fromIso = planned[0]?.date;
  const toIso = planned[planned.length - 1]?.date;
  const persistedPlans =
    fromIso && toIso ? await readWeekPlans(TEAM_ID, fromIso, toIso) : [];
  const persistedByDate = new Map(persistedPlans.map((p) => [p.date, p]));

  const week: WeekDayEntry[] = planned.map((p) => {
    const persisted = persistedByDate.get(p.date);
    return {
      date: p.date,
      day: p.day,
      ivScore: p.ivScore,
      windowCount: persisted?.windows.length ?? p.windows.length,
      eventName: p.dominantEvent,
    };
  });
  return c.json({ week });
}

export async function handleGetMultiWeek(c: Context): Promise<Response> {
  const from = c.req.query("from");
  const to = c.req.query("to");

  let result: DayPlan[][] = [];

  if (from && to) {
    await ensureGeneratedPlans(collectDateRange(from, to));
    const plans = await readWeekPlans(TEAM_ID, from, to);
    const byWeek = new Map<string, DayPlan[]>();
    for (const plan of plans) {
      const d = new Date(`${plan.date}T12:00:00Z`);
      const dow = d.getUTCDay();
      const weekStart = new Date(d);
      weekStart.setUTCDate(d.getUTCDate() - (dow === 0 ? 6 : dow - 1));
      const key = weekStart.toISOString().slice(0, 10);
      const list = byWeek.get(key) ?? [];
      list.push(plan);
      byWeek.set(key, list);
    }
    result = [...byWeek.values()];
  } else {
    const weekCount = parseInt(c.req.query("weeks") ?? "4", 10);
    const plannedWeeks = await planWeeks(new Date(), Math.max(1, Math.min(12, weekCount)));

    const allDates = plannedWeeks.flat().map((p) => p.date);
    const fromIso = allDates[0] ?? new Date().toISOString().slice(0, 10);
    const toIso = allDates[allDates.length - 1] ?? fromIso;
    await ensureGeneratedPlans(allDates);
    const persisted = await readWeekPlans(TEAM_ID, fromIso, toIso);
    const persistedByDate = new Map<string, DayPlan[]>();
    for (const p of persisted) {
      const list = persistedByDate.get(p.date) ?? [];
      list.push(p);
      persistedByDate.set(p.date, list);
    }

    result = plannedWeeks.map((weekPlans) =>
      weekPlans.map((pd) => {
        const existingPlans = persistedByDate.get(pd.date) ?? [];
        if (existingPlans.length > 0) return existingPlans[0];
        return {
          id: `plan-${pd.date}`,
          teamId: TEAM_ID,
          date: pd.date,
          eventName: pd.dominantEvent,
          deskTheme: null,
          generatedBy: "multi-week-planner",
          generatedAt: new Date().toISOString(),
          sourceBriefId: null,
          institutionalPositioning: null,
          windows: pd.windows.map((pw, i) => ({
            id: `w-${pd.date}-${i}`,
            dayPlanId: `plan-${pd.date}`,
            windowIndex: pw.windowIndex,
            startTime: pw.startTime,
            endTime: pw.endTime,
            eventName: pw.eventName ?? null,
            econForecast: null,
          })),
        } satisfies DayPlan;
      }),
    );
  }

  return c.json({ weeks: result });
}

async function ensureGeneratedPlans(dates: string[]): Promise<void> {
  const uniqueDates = [...new Set(dates)].filter(Boolean).slice(0, 31);
  for (const date of uniqueDates) {
    await generateDayPlan({
      teamId: TEAM_ID,
      date: new Date(`${date}T12:00:00Z`),
      generatedBy: "multi-week-planner",
    }).catch((err) => {
      log.warn("multi-week day-plan materialization failed", {
        date,
        error: err instanceof Error ? err.message : String(err),
      });
    });
  }
}

function collectDateRange(from: string, to: string): string[] {
  const dates: string[] = [];
  const cursor = new Date(`${from}T12:00:00Z`);
  const end = new Date(`${to}T12:00:00Z`);
  while (dates.length < 31 && cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

async function forecastMissingWindows(
  dateIso: string,
  windows: Array<{
    windowIndex: number;
    startTime: string;
    endTime: string;
    eventName: string | null;
    econForecast: DayPlanWindow["econForecast"];
  }>,
): Promise<typeof windows> {
  const events = await readEconEvents({ from: dateIso, to: dateIso }).catch(() => []);
  const resolved: typeof windows = [];
  for (const window of windows) {
    if (!window.eventName || window.econForecast) {
      resolved.push(window);
      continue;
    }
    const event = findEventForWindow(window.eventName, events);
    if (!event) {
      resolved.push(window);
      continue;
    }
    const econForecast = await generateEconForecast({
      eventName: event.name,
      eventDate: dateIso,
      eventTime: event.time ?? window.startTime,
      eventCountry: event.country ?? undefined,
      eventCategory: event.category ?? undefined,
      forecast: event.forecast ?? undefined,
      previous: event.previous ?? undefined,
      isSpeech: isSpeechEvent(event),
    }).catch(() => null);
    resolved.push({ ...window, econForecast });
  }
  return resolved;
}

function findEventForWindow(
  eventName: string,
  events: Awaited<ReturnType<typeof readEconEvents>>,
): (typeof events)[number] | null {
  const name = eventName.toLowerCase().trim();
  for (const event of events) {
    const eventLabel = (event.name ?? "").toLowerCase().trim();
    if (eventLabel === name || eventLabel.includes(name) || name.includes(eventLabel)) {
      return event;
    }
  }
  return null;
}

export async function handleGetStreak(c: Context): Promise<Response> {
  const userId = c.get("userId") as string | undefined;
  if (!userId) {
    return c.json(
      { streakAtClose: 0, last30: [] } satisfies StreakResponse,
      200,
    );
  }
  const sb = getSupabaseClient();
  if (!sb) {
    return c.json(
      { streakAtClose: 0, last30: [] } satisfies StreakResponse,
      200,
    );
  }

  const since = new Date();
  since.setDate(since.getDate() - 30);
  const sinceIso = since.toISOString().slice(0, 10);

  const { data, error } = await sb
    .from("day_plan_streaks")
    .select("date, daily_color, streak_at_close")
    .eq("user_id", userId)
    .gte("date", sinceIso)
    .order("date", { ascending: false });
  if (error) {
    log.warn("streak read failed", { error: error.message });
    return c.json(
      { streakAtClose: 0, last30: [] } satisfies StreakResponse,
      200,
    );
  }

  const streakAtClose = data?.[0]?.streak_at_close ?? 0;
  const last30 = (data ?? []).map((r) => ({
    date: r.date as string,
    color: r.daily_color as StreakResponse["last30"][number]["color"],
  }));
  return c.json({ streakAtClose, last30 } satisfies StreakResponse);
}

// [claude-code 2026-05-16] S67: Graded streak — compares Agentic Desk forecasts
// against actual econ print outcomes, producing analysis_correct boolean per day.
export async function handleGetGradedStreak(c: Context): Promise<Response> {
  const userId = c.get("userId") as string | undefined;
  if (!userId) {
    return c.json({ streakAtClose: 0, last30: [] });
  }

  const { getGradedStreak } = await import("../../services/econ-grading-service.js");
  const result = await getGradedStreak(userId);
  return c.json(result);
}

export async function handleGetDriftStatus(c: Context): Promise<Response> {
  const dateIso = new Date().toISOString().slice(0, 10);
  const plan = await readDayPlan(TEAM_ID, dateIso);
  const windows = plan?.windows ?? [];
  const nowEt = new Date(
    new Date().toLocaleString("en-US", { timeZone: "America/New_York" }),
  );
  const inWindow = isInsideAnyWindow(nowEt, windows);
  const lastEvent = getLastDriftEvent();

  if (inWindow || !lastEvent || lastEvent.firedAt < dateIso) {
    return c.json({
      inWindow,
      kind: null,
      firedAt: null,
      message: null,
    } satisfies DriftStatus);
  }

  return c.json({
    inWindow,
    kind: lastEvent.kind,
    firedAt: lastEvent.firedAt,
    message: lastEvent.message,
  } satisfies DriftStatus);
}

export async function handlePostFeedback(c: Context): Promise<Response> {
  const userId = c.get("userId") as string | undefined;
  if (!userId) return c.json({ error: "unauthorized" }, 401);

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid_json" }, 400);
  }
  const parsed = FeedbackSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "invalid_body", detail: parsed.error.flatten() },
      400,
    );
  }

  const sb = getSupabaseClient();
  if (!sb) return c.json({ error: "supabase_unavailable" }, 503);

  const { data, error } = await sb
    .from("day_plan_feedback")
    .insert({
      window_id: parsed.data.window_id,
      user_id: userId,
      action: parsed.data.action,
      reason_code: parsed.data.reason_code ?? null,
      reason_text: parsed.data.reason_text ?? null,
      fill_price: parsed.data.fill_price ?? null,
      outcome_pnl: parsed.data.outcome_pnl ?? null,
    })
    .select("id")
    .single();
  if (error || !data) {
    log.warn("feedback insert failed", { error: error?.message });
    return c.json({ error: "insert_failed" }, 500);
  }
  return c.json({ id: data.id }, 200);
}

export async function handleGetFeedback(c: Context): Promise<Response> {
  const userId = c.get("userId") as string | undefined;
  if (!userId) return c.json({ feedback: [] });

  const range = c.req.query("range") ?? "week";
  const days = range === "month" ? 30 : range === "day" ? 1 : 7;
  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceIso = since.toISOString();

  const sb = getSupabaseClient();
  if (!sb) return c.json({ feedback: [] });

  const { data, error } = await sb
    .from("day_plan_feedback")
    .select("*")
    .eq("user_id", userId)
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false });
  if (error) {
    log.warn("feedback read failed", { error: error.message });
    return c.json({ feedback: [] });
  }
  return c.json({ feedback: data ?? [] });
}

/**
 * POST /api/day-plan/cao-evening-review
 *
 * Accepts window updates from Harper's evening review and merges them into
 * the existing day plan. New windows are appended — existing ones are NOT
 * replaced. Returns the updated plan.
 *
 * Body: { windows: TradingWindowUpdate[], reason: string }
 */
export async function handlePostCaoEveningReview(
  c: Context,
): Promise<Response> {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid_json" }, 400);
  }

  const parsed = CaoEveningReviewSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "invalid_body", detail: parsed.error.flatten() },
      400,
    );
  }

  const dateIso = new Date().toISOString().slice(0, 10);
  const existingPlan = await readDayPlan(TEAM_ID, dateIso);

  // Derive next window index
  const existingWindows = existingPlan?.windows ?? [];
  const nextIndex = existingWindows.length;

  // Build new DayPlanWindow entries
  const newWindows: Array<{
    windowIndex: number;
    startTime: string;
    endTime: string;
    eventName: string | null;
    econForecast: DayPlanWindow["econForecast"];
  }> = parsed.data.windows.map((wu, i) => ({
    windowIndex: nextIndex + i,
    startTime: wu.startTime,
    endTime: wu.endTime,
    eventName: wu.eventName ?? null,
    econForecast: null,
  }));

  // Merge: existing + new (additive, not replacement)
  const allWindows = await forecastMissingWindows(dateIso, [
    ...existingWindows.map((w: DayPlanWindow) => ({
      windowIndex: w.windowIndex,
      startTime: w.startTime,
      endTime: w.endTime,
      eventName: w.eventName ?? null,
      econForecast: w.econForecast ?? null,
    })),
    ...newWindows,
  ]);

  // Persist through Supabase
  const sb = getSupabaseClient();
  if (!sb) {
    log.warn("Supabase unavailable — returning in-memory merged plan");
    return c.json({
      plan: {
        id: `mem-${TEAM_ID}-${dateIso}`,
        teamId: TEAM_ID,
        date: dateIso,
        eventName: existingPlan?.eventName ?? null,
        deskTheme: existingPlan?.deskTheme ?? null,
        generatedBy: "cao-evening-review",
        generatedAt: new Date().toISOString(),
        sourceBriefId: null,
        institutionalPositioning: null,
        windows: allWindows.map((w, i) => ({
          id: `mem-w-${i}`,
          dayPlanId: `mem-${TEAM_ID}-${dateIso}`,
          windowIndex: w.windowIndex,
          startTime: w.startTime,
          endTime: w.endTime,
          eventName: w.eventName,
          econForecast: w.econForecast,
        })),
      } satisfies DayPlan,
      reason: parsed.data.reason,
    });
  }

  // Upsert the day plan row
  const { data: planRow, error: planErr } = await sb
    .from("day_plans")
    .upsert(
      {
        team_id: TEAM_ID,
        date: dateIso,
        event_name: existingPlan?.eventName ?? null,
        desk_theme: existingPlan?.deskTheme ?? null,
        generated_by: "cao-evening-review",
        generated_at: new Date().toISOString(),
      },
      { onConflict: "team_id,date" },
    )
    .select()
    .single();

  if (planErr || !planRow) {
    log.warn("day_plans upsert failed for evening review", {
      error: planErr?.message,
    });
    return c.json({ error: "persist_failed" }, 500);
  }

  // Insert the new windows only (delete + reinsert all to keep things clean)
  await sb.from("day_plan_windows").delete().eq("day_plan_id", planRow.id);

  const inserts = allWindows.map((w) => ({
    day_plan_id: planRow.id,
    window_index: w.windowIndex,
    start_time: w.startTime,
    end_time: w.endTime,
    event_name: w.eventName,
    econ_forecast: w.econForecast,
  }));

  const { data: insertedWindows, error: winErr } = await sb
    .from("day_plan_windows")
    .insert(inserts)
    .select();

  if (winErr) {
    log.warn("day_plan_windows insert failed for evening review", {
      error: winErr.message,
    });
  }

  const resolvedWindows = (insertedWindows ?? []).map((w: any) => ({
    id: w.id,
    dayPlanId: w.day_plan_id,
    windowIndex: w.window_index,
    startTime:
      typeof w.start_time === "string"
        ? w.start_time.slice(0, 5)
        : w.start_time,
    endTime:
      typeof w.end_time === "string" ? w.end_time.slice(0, 5) : w.end_time,
    eventName: w.event_name ?? null,
    econForecast: w.econ_forecast ?? null,
  }));

  log.info("CAO evening review merged windows", {
    date: dateIso,
    existingCount: existingWindows.length,
    addedCount: parsed.data.windows.length,
    totalCount: allWindows.length,
    reason: parsed.data.reason,
  });

  return c.json({
    plan: {
      id: planRow.id,
      teamId: planRow.team_id,
      date: planRow.date,
      eventName: planRow.event_name,
      deskTheme: planRow.desk_theme,
      generatedBy: planRow.generated_by,
      generatedAt: planRow.generated_at,
      sourceBriefId: planRow.source_brief_id,
      institutionalPositioning: planRow.institutional_positioning ?? null,
      windows: resolvedWindows,
    } satisfies DayPlan,
    reason: parsed.data.reason,
  });
}
