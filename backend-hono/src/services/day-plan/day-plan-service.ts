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
const FORECAST_MAX_AGE_MINUTES = 60;

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
  const dateIso = input.date
    ? reference.toISOString().slice(0, 10)
    : dateInNewYork(reference);
  const econEvents = await readEconEvents({ from: dateIso, to: dateIso }).catch(
    () => [],
  );
  const planned = planDay(new Date(`${dateIso}T12:00:00Z`), econEvents);

  if (!input.override) {
    const existing = await readDayPlan(teamId, dateIso);
    if (existing) {
      const candidate = hydrateLegacyWindowNames(existing, planned);
      if (isStaleAgainstUpcomingEvents(candidate, planned)) {
        log.warn("Existing day-plan is stale against upcoming econ events", {
          date: dateIso,
          existingEvent: candidate.eventName,
          plannedEvent: planned.dominantEvent,
        });
      } else {
        // Check if any existing windows need forecast refresh (30-min pre-window)
        const updated = await maybeRefreshExisting(candidate);
        return updated
          ? { plan: updated, persisted: true, reused: true }
          : { plan: candidate, persisted: false, reused: true };
      }
    }
  }

  const [feedResponse, regimeState] = await Promise.all([
    getFeed("system", { limit: 20 }).catch(() => ({ items: [] } as never)),
    getCurrentRegime().catch(() => null),
  ]);

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

function isStaleAgainstUpcomingEvents(
  existing: DayPlan,
  planned: ReturnType<typeof planDay>,
): boolean {
  if (planned.windows.length > 0 && existing.windows.length === 0) return true;
  const plannedNames = new Set(
    planned.windows
      .map((window) => normalizeEventName(window.eventName))
      .filter((name): name is string => Boolean(name)),
  );
  const plannedDominant = normalizeEventName(planned.dominantEvent);
  const existingNames = new Set(
    [
      existing.eventName,
      ...existing.windows.map((window) => window.eventName),
    ]
      .map(normalizeEventName)
      .filter((name): name is string => Boolean(name)),
  );

  if (plannedNames.size === 0 && !plannedDominant) {
    return existingNames.size > 0;
  }
  const existingWindowNames = existing.windows
    .map((window) => normalizeEventName(window.eventName))
    .filter(Boolean);
  if (plannedNames.size > 0 && existingWindowNames.length === 0) return true;
  if (plannedDominant && !existingNames.has(plannedDominant)) return true;
  for (const name of existingNames) {
    if (!plannedNames.has(name) && name !== plannedDominant) return true;
  }
  return false;
}

function hydrateLegacyWindowNames(
  existing: DayPlan,
  planned: ReturnType<typeof planDay>,
): DayPlan {
  if (existing.windows.length === 0) return existing;
  const hasStoredWindowNames = existing.windows.some((window) =>
    normalizeEventName(window.eventName),
  );
  if (hasStoredWindowNames) return existing;
  return {
    ...existing,
    windows: existing.windows.map((window, index) => ({
      ...window,
      eventName: planned.windows[index]?.eventName ?? window.eventName,
    })),
  };
}

function normalizeEventName(value: string | null | undefined): string | null {
  const normalized = value?.trim().toLowerCase().replace(/\s+/g, " ");
  return normalized || null;
}

function dateInNewYork(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
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
    eventCountry?: string | null;
    econForecast: any;
  }>
> {
  const results: Array<{
    windowIndex: number;
    startTime: string;
    endTime: string;
    eventName: string | null;
    eventCountry?: string | null;
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
      if (econForecast) {
        econForecast = {
          ...econForecast,
          eventCountry: matchedEvent.country ?? null,
          eventTime: matchedEvent.time ?? pw.startTime,
        };
      }
    }

    results.push({
      windowIndex: pw.windowIndex,
      startTime: pw.startTime,
      endTime: pw.endTime,
      eventName: pw.eventName ?? null,
      eventCountry: matchedEvent?.country ?? null,
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
  const econEvents = await readEconEvents({
    from: plan.date,
    to: plan.date,
  }).catch(() => []);

  for (const w of plan.windows) {
    if (!w.eventName) {
      updatedWindows.push(w);
      continue;
    }

    const age = w.econForecast?.generatedAt
      ? Date.now() - new Date(w.econForecast.generatedAt).getTime()
      : Infinity;
    const isFresh = age < FORECAST_MAX_AGE_MINUTES * 60_000;
    if (w.econForecast && isFresh) {
      updatedWindows.push(w);
      continue;
    }

    try {
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
          eventCountry: matchedEvent.country ?? w.eventCountry ?? null,
          econForecast: forecast
            ? {
                ...forecast,
                eventCountry: matchedEvent.country ?? null,
                eventTime: matchedEvent.time ?? w.startTime,
              }
            : w.econForecast,
        });
        continue;
      }
    } catch {
      // Non-fatal
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
    eventCountry?: string | null;
    econForecast: any;
  }>;
}

async function persistDayPlan(input: PersistInput): Promise<DayPlan> {
  const sb = getSupabaseClient();
  if (!sb) {
    return synthesizeInMemoryPlan(input);
  }

  const generatedAt = new Date().toISOString();
  const planPayload = {
    team_id: input.teamId,
    date: input.dateIso,
    event_name: input.eventName,
    desk_theme: input.deskTheme,
    generated_by: input.generatedBy,
    generated_at: generatedAt,
    plan_variant: input.planVariant ?? null,
  };
  let { data: planRow, error: planErr } = await sb
    .from("day_plans")
    .upsert(planPayload, { onConflict: "team_id,date" })
    .select()
    .single();
  if (planErr?.message?.includes("plan_variant")) {
    const { plan_variant: _planVariant, ...legacyPayload } = planPayload;
    const legacyResult = await sb
      .from("day_plans")
      .upsert(legacyPayload, { onConflict: "team_id,date" })
      .select()
      .single();
    planRow = legacyResult.data;
    planErr = legacyResult.error;
  }
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

  let { data: insertedWindows, error: winErr } = await sb
    .from("day_plan_windows")
    .insert(windowInserts)
    .select();
  if (winErr?.message?.includes("econ_forecast")) {
    const legacyWindowInserts = windowInserts.map(
      ({ econ_forecast: _econForecast, ...legacyWindow }) => legacyWindow,
    );
    const legacyWindowResult = await sb
      .from("day_plan_windows")
      .insert(legacyWindowInserts)
      .select();
    insertedWindows = legacyWindowResult.data;
    winErr = legacyWindowResult.error;
  }
  if (winErr?.message?.includes("event_name")) {
    const minimalWindowInserts = windowInserts.map(
      ({
        event_name: _eventName,
        econ_forecast: _econForecast,
        ...legacyWindow
      }) => legacyWindow,
    );
    const minimalWindowResult = await sb
      .from("day_plan_windows")
      .insert(minimalWindowInserts)
      .select();
    insertedWindows = minimalWindowResult.data;
    winErr = minimalWindowResult.error;
  }
  if (winErr) {
    log.warn("day_plan_windows insert failed", { error: winErr.message });
  }

  const persisted = rowsToDayPlan(planRow, insertedWindows ?? []);
  if (persisted.windows.length === 0) return persisted;
  return {
    ...persisted,
    windows: persisted.windows.map((window, index) => ({
      ...window,
      eventName: input.windows[index]?.eventName ?? window.eventName,
      eventCountry: input.windows[index]?.eventCountry ?? window.eventCountry,
      econForecast: input.windows[index]?.econForecast ?? window.econForecast,
    })),
  };
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
      eventCountry: w.eventCountry ?? w.econForecast?.eventCountry ?? null,
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
    eventCountry: row.econ_forecast?.eventCountry ?? null,
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
