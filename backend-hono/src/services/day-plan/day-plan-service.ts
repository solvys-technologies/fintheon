// [claude-code 2026-05-15] Econ forecast: replaced TV-based price computation with
//   AI-powered econ forecast engine. Each window now carries miss/beat scenarios,
//   AI prediction, and notable events instead of invalidation/profit-target/entries.
//   Prices pulled fresh at viewing time (30 min before window) via maybeRefreshForecast.
//   Old price fields retained as optional for migration transition.

import { getSupabaseClient } from "../../config/supabase.js";
import { createLogger } from "../../lib/logger.js";
import { readEconEvents } from "../supabase-service.js";
import { getFeed } from "../riskflow/feed-service.js";
import { getCurrentRegime } from "../regime/regime-service.js";
import {
  generateEconForecast,
  isSpeechEvent,
} from "../econ-forecast/econ-forecast-service.js";
import { generateDeskTheme } from "./desk-theme-generator.js";
import { planDay, type PlannedWindow } from "./window-scheduler.js";
import type { DayPlan, DayPlanWindow } from "../../types/day-plan.js";

const log = createLogger("DayPlanService");

const DEFAULT_TEAM = "pic";
const DEFAULT_INSTRUMENT = "/NQ";

export interface GenerateDayPlanInput {
  teamId?: string;
  date?: Date;
  instrument?: string;
  override?: boolean;
  overrideReason?: string;
  generatedBy?: string;
  planVariant?: string | null;
}

export interface GenerateDayPlanResult {
  plan: DayPlan;
  persisted: boolean;
  reused: boolean;
}

/**
 * Generate the Desk Plan for a given date. Pulls econ events, schedules windows,
 * generates AI forecasts per window, and persists.
 */
export async function generateDayPlan(
  input: GenerateDayPlanInput = {},
): Promise<GenerateDayPlanResult> {
  const teamId = input.teamId ?? DEFAULT_TEAM;
  const reference = input.date ?? new Date();
  const dateIso = reference.toISOString().slice(0, 10);

  if (!input.override) {
    const existing = await readDayPlan(teamId, dateIso);
    if (existing) {
      // Check if any existing windows need forecast refresh (30-min pre-window)
      const updated = await maybeRefreshExisting(existing);
      return updated
        ? { plan: updated, persisted: true, reused: true }
        : { plan: existing, persisted: false, reused: true };
    }
  }

  const [econEvents, feedResponse, regimeState] = await Promise.all([
    readEconEvents({ from: dateIso, to: dateIso }).catch(() => []),
    getFeed("system", { limit: 20 }).catch(() => ({ items: [] } as never)),
    getCurrentRegime().catch(() => null),
  ]);

  const planned = planDay(reference, econEvents);

  const topHeadline = (feedResponse.items ?? [])[0]?.headline ?? "";
  const eventName = planned.dominantEvent;

  // Build windows with econ forecasts
  const windows = await buildWindows(
    dateIso,
    planned,
    econEvents,
  );

  // Generate desk theme (no price references)
  const deskTheme = await generateDeskTheme({
    date: dateIso,
    catalystHeadline: topHeadline || (eventName ?? "today's session"),
    ivScore: planned.ivScore,
    eventName,
    windowLabel: windows[0]
      ? `${windows[0].startTime}-${windows[0].endTime}`
      : "09:30-11:00",
    instrument: input.instrument ?? DEFAULT_INSTRUMENT,
    pricesOfInterest: [], // no longer used for price-based theme
    regime: regimeState?.regime ?? null,
  });

  const plan = await persistDayPlan({
    teamId,
    dateIso,
    eventName,
    deskTheme,
    generatedBy: input.generatedBy ?? "day-plan-cron",
    planVariant: input.planVariant ?? null,
    windows,
  });

  log.info("Day-plan generated with econ forecasts", {
    date: dateIso,
    teamId,
    windowCount: windows.length,
    override: !!input.override,
  });

  return { plan, persisted: true, reused: false };
}

export async function regenerateDayPlan(
  options: { teamId?: string; date?: Date; overrideReason?: string } = {},
): Promise<GenerateDayPlanResult> {
  return generateDayPlan({
    ...options,
    override: true,
    generatedBy: "harper-cao-override",
  });
}

export async function readDayPlan(
  teamId: string,
  dateIso: string,
): Promise<DayPlan | null> {
  const sb = getSupabaseClient();
  if (!sb) return null;

  const { data: planRow, error: planErr } = await sb
    .from("day_plans")
    .select("*")
    .eq("team_id", teamId)
    .eq("date", dateIso)
    .maybeSingle();
  if (planErr) {
    log.warn("readDayPlan plan query failed", { error: planErr.message });
    return null;
  }
  if (!planRow) return null;

  const { data: windowRows, error: winErr } = await sb
    .from("day_plan_windows")
    .select("*")
    .eq("day_plan_id", planRow.id)
    .order("window_index", { ascending: true });
  if (winErr) {
    log.warn("readDayPlan windows query failed", { error: winErr.message });
  }

  return rowsToDayPlan(planRow, windowRows ?? []);
}

export async function readWeekPlans(
  teamId: string,
  fromIso: string,
  toIso: string,
): Promise<DayPlan[]> {
  const sb = getSupabaseClient();
  if (!sb) return [];

  const { data: planRows, error } = await sb
    .from("day_plans")
    .select("*")
    .eq("team_id", teamId)
    .gte("date", fromIso)
    .lte("date", toIso)
    .order("date", { ascending: true });
  if (error) {
    log.warn("readWeekPlans failed", { error: error.message });
    return [];
  }

  if (!planRows || planRows.length === 0) return [];

  const ids = planRows.map((p) => p.id);
  const { data: windowRows } = await sb
    .from("day_plan_windows")
    .select("*")
    .in("day_plan_id", ids)
    .order("window_index", { ascending: true });

  const grouped = new Map<string, typeof windowRows>();
  for (const w of windowRows ?? []) {
    if (!grouped.has(w.day_plan_id)) grouped.set(w.day_plan_id, [] as never);
    grouped.get(w.day_plan_id)!.push(w);
  }

  return planRows.map((p) => rowsToDayPlan(p, grouped.get(p.id) ?? []));
}

// ── Window building ─────────────────────────────────────────────────────────

async function buildWindows(
  dateIso: string,
  planned: { windows: PlannedWindow[] },
  econEvents: Awaited<ReturnType<typeof readEconEvents>>,
): Promise<
  Array<{
    windowIndex: number;
    startTime: string;
    endTime: string;
    eventName: string | null;
    econForecast: any;
  }>
> {
  const results: Array<{
    windowIndex: number;
    startTime: string;
    endTime: string;
    eventName: string | null;
    econForecast: any;
  }> = [];

  for (const pw of planned.windows ?? []) {
    const matchedEvent = findMatchingEvent(pw.eventName, econEvents);
    const isSpeech = matchedEvent ? isSpeechEvent(matchedEvent) : false;

    let econForecast = null;
    if (matchedEvent) {
      econForecast = await generateEconForecast({
        eventName: matchedEvent.name,
        eventDate: dateIso,
        eventTime: matchedEvent.time ?? pw.startTime,
        eventCountry: matchedEvent.country ?? undefined,
        eventCategory: matchedEvent.category ?? undefined,
        forecast: matchedEvent.forecast ?? undefined,
        previous: matchedEvent.previous ?? undefined,
        isSpeech,
      }).catch((err) => {
        log.warn("Econ forecast generation failed for window", {
          event: matchedEvent.name,
          error: err instanceof Error ? err.message : String(err),
        });
        return null;
      });
    }

    results.push({
      windowIndex: pw.windowIndex,
      startTime: pw.startTime,
      endTime: pw.endTime,
      eventName: pw.eventName ?? null,
      econForecast,
    });
  }

  return results;
}

function findMatchingEvent(
  eventName: string | null | undefined,
  events: Awaited<ReturnType<typeof readEconEvents>>,
): (typeof events)[number] | null {
  if (!eventName) return null;
  const name = eventName.toLowerCase().trim();
  const match = events.find(
    (e) => (e.name ?? "").toLowerCase().trim() === name,
  );
  if (match) return match;
  // Fuzzy match: event name contains the matching event
  for (const e of events) {
    const en = (e.name ?? "").toLowerCase().trim();
    if (en && (name.includes(en) || en.includes(name))) return e;
  }
  return null;
}

// ── Refresh logic ───────────────────────────────────────────────────────────

/**
 * Check if any existing windows need forecast refresh (within 30-min pre-window).
 * If so, regenerate the forecast and update persistence.
 */
async function maybeRefreshExisting(plan: DayPlan): Promise<DayPlan | null> {
  let changed = false;
  const updatedWindows: DayPlanWindow[] = [];

  for (const w of plan.windows) {
    if (!w.eventName || w.econForecast) {
      // Already has a forecast — check if it needs refreshing
      const now = Date.now();
      const age = w.econForecast?.generatedAt
        ? now - new Date(w.econForecast.generatedAt).getTime()
        : Infinity;

      if (age < 10 * 60_000) {
        updatedWindows.push(w);
        continue;
      }
    }

    // Check if we should generate/refresh
    const [h, m] = w.startTime.split(":").map(Number);
    const startDate = new Date();
    startDate.setHours(h, m, 0, 0);
    const startMs = startDate.getTime();
    const effectiveStart = startMs <= Date.now() ? startMs + 86_400_000 : startMs;
    const refreshStart = effectiveStart - 30 * 60_000;

    if (Date.now() >= refreshStart && Date.now() < effectiveStart) {
      // Within 30-min refresh window — regenerate
      try {
        const econEvents = await readEconEvents({
          from: plan.date,
          to: plan.date,
        });
        const matchedEvent = findMatchingEvent(w.eventName, econEvents);
        if (matchedEvent) {
          const isSpeech = isSpeechEvent(matchedEvent);
          const forecast = await generateEconForecast({
            eventName: matchedEvent.name,
            eventDate: plan.date,
            eventTime: matchedEvent.time ?? w.startTime,
            eventCountry: matchedEvent.country ?? undefined,
            eventCategory: matchedEvent.category ?? undefined,
            forecast: matchedEvent.forecast ?? undefined,
            previous: matchedEvent.previous ?? undefined,
            isSpeech,
          }).catch(() => null);

          changed = true;
          updatedWindows.push({
            ...w,
            econForecast: forecast ?? w.econForecast,
          });
          continue;
        }
      } catch {
        // Non-fatal
      }
    }

    updatedWindows.push(w);
  }

  if (!changed) return null;

  // Persist the refreshed forecasts
  const sb = getSupabaseClient();
  if (sb) {
    try {
      for (const w of updatedWindows) {
        await sb
          .from("day_plan_windows")
          .update({ econ_forecast: w.econForecast })
          .eq("id", w.id);
      }
    } catch (err) {
      log.warn("Failed to persist refreshed forecasts", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { ...plan, windows: updatedWindows };
}

// ── Persistence ─────────────────────────────────────────────────────────────

interface PersistInput {
  teamId: string;
  dateIso: string;
  eventName: string | null;
  deskTheme: string | null;
  generatedBy: string;
  planVariant?: string | null;
  windows: Array<{
    windowIndex: number;
    startTime: string;
    endTime: string;
    eventName: string | null;
    econForecast: any;
  }>;
}

async function persistDayPlan(input: PersistInput): Promise<DayPlan> {
  const sb = getSupabaseClient();
  if (!sb) {
    return synthesizeInMemoryPlan(input);
  }

  const { data: planRow, error: planErr } = await sb
    .from("day_plans")
    .upsert(
      {
        team_id: input.teamId,
        date: input.dateIso,
        event_name: input.eventName,
        desk_theme: input.deskTheme,
        generated_by: input.generatedBy,
        generated_at: new Date().toISOString(),
        plan_variant: input.planVariant ?? null,
      },
      { onConflict: "team_id,date" },
    )
    .select()
    .single();
  if (planErr || !planRow) {
    log.warn("day_plans upsert failed — returning in-memory plan", {
      error: planErr?.message,
    });
    return synthesizeInMemoryPlan(input);
  }

  await sb.from("day_plan_windows").delete().eq("day_plan_id", planRow.id);

  const windowInserts = input.windows.map((w) => ({
    day_plan_id: planRow.id,
    window_index: w.windowIndex,
    start_time: w.startTime,
    end_time: w.endTime,
    event_name: w.eventName,
    econ_forecast: w.econForecast,
  }));

  const { data: insertedWindows, error: winErr } = await sb
    .from("day_plan_windows")
    .insert(windowInserts)
    .select();
  if (winErr) {
    log.warn("day_plan_windows insert failed", { error: winErr.message });
  }

  return rowsToDayPlan(planRow, insertedWindows ?? []);
}

function synthesizeInMemoryPlan(input: PersistInput): DayPlan {
  const planId = `mem-${input.teamId}-${input.dateIso}`;
  return {
    id: planId,
    teamId: input.teamId,
    date: input.dateIso,
    eventName: input.eventName,
    deskTheme: input.deskTheme,
    generatedBy: input.generatedBy,
    generatedAt: new Date().toISOString(),
    sourceBriefId: null,
    institutionalPositioning: null,
    planVariant: input.planVariant ?? null,
    windows: input.windows.map((w, i) => ({
      id: `mem-w-${i}`,
      dayPlanId: planId,
      windowIndex: w.windowIndex,
      startTime: w.startTime,
      endTime: w.endTime,
      eventName: w.eventName,
      econForecast: w.econForecast ?? null,
    })),
  };
}

function rowsToDayPlan(planRow: any, windowRows: any[]): DayPlan {
  return {
    id: planRow.id,
    teamId: planRow.team_id,
    date: planRow.date,
    eventName: planRow.event_name,
    deskTheme: planRow.desk_theme,
    generatedBy: planRow.generated_by,
    generatedAt: planRow.generated_at,
    sourceBriefId: planRow.source_brief_id,
    institutionalPositioning: planRow.institutional_positioning ?? null,
    planVariant: planRow.plan_variant ?? null,
    windows: windowRows.map(rowToWindow),
  };
}

function rowToWindow(row: any): DayPlanWindow {
  return {
    id: row.id,
    dayPlanId: row.day_plan_id,
    windowIndex: row.window_index,
    startTime:
      typeof row.start_time === "string"
        ? row.start_time.slice(0, 5)
        : row.start_time,
    endTime:
      typeof row.end_time === "string"
        ? row.end_time.slice(0, 5)
        : row.end_time,
    eventName: row.event_name ?? null,
    econForecast: row.econ_forecast ?? null,
    // Deprecated price fields — retained for migration transition
    pricesOfInterest: Array.isArray(row.prices_of_interest)
      ? row.prices_of_interest.map((n: any) => Number(n))
      : [],
    entries: Array.isArray(row.entries)
      ? row.entries.map((n: any) => Number(n))
      : [],
    invalidation: row.invalidation == null ? null : Number(row.invalidation),
    profitTarget: row.profit_target == null ? null : Number(row.profit_target),
    expectedMovePct:
      row.expected_move_pct == null ? null : Number(row.expected_move_pct),
    sessionPrice: row.session_price == null ? null : Number(row.session_price),
  };
}
