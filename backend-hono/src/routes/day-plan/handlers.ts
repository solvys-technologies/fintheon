// [claude-code 2026-04-26] S45-T1: Day-plan API handlers.
// GET /today, GET /week, GET /streak, GET /drift-status, POST /feedback,
// GET /feedback?range=week.

import type { Context } from "hono";
import { z } from "zod";
import { getSupabaseClient } from "../../config/supabase.js";
import { createLogger } from "../../lib/logger.js";
import {
  generateDayPlan,
  readDayPlan,
  readWeekPlans,
} from "../../services/day-plan/day-plan-service.js";
import { planWeek } from "../../services/day-plan/window-scheduler.js";
import { getLastDriftEvent } from "../../services/desk-drift/drift-monitor.js";
import { isInsideAnyWindow } from "../../services/desk-drift/dead-volume-rule.js";
import type {
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

export async function handleGetToday(c: Context): Promise<Response> {
  const dateIso = new Date().toISOString().slice(0, 10);
  let plan = await readDayPlan(TEAM_ID, dateIso);
  if (!plan) {
    // Best-effort live generation if the cron hasn't run yet today
    try {
      const result = await generateDayPlan({ teamId: TEAM_ID });
      plan = result.plan;
    } catch (err) {
      log.warn("on-demand day-plan generation failed", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
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
      eventName: persisted?.eventName ?? p.dominantEvent,
    };
  });
  return c.json({ week });
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
