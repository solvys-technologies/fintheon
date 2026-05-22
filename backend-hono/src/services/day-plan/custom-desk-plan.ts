import { createHash } from "crypto";
import { z } from "zod";
import { getSupabaseClient } from "../../config/supabase.js";
import { createLogger } from "../../lib/logger.js";
import {
  generateEconForecast,
  isSpeechEvent,
} from "../econ-forecast/econ-forecast-service.js";
import { readDayPlan } from "./day-plan-service.js";
import type { DayPlan, DayPlanWindow } from "../../types/day-plan.js";

const log = createLogger("CustomDeskPlan");
const TEAM_ID = "pic";

export const CustomDeskPlanSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  eventName: z.string().min(2).max(180),
  country: z.string().min(2).max(6).transform((value) => value.toUpperCase()),
  currency: z.string().min(3).max(6).transform((value) => value.toUpperCase()),
  category: z.string().min(2).max(40).default("Economic"),
  impact: z.enum(["low", "medium", "high"]).default("medium"),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  forecast: z.string().max(80).optional(),
  previous: z.string().max(80).optional(),
  detail: z.string().max(700).optional(),
});

export type CustomDeskPlanInput = z.infer<typeof CustomDeskPlanSchema>;

export async function addCustomDeskPlanEvent(
  input: CustomDeskPlanInput,
): Promise<{ plan: DayPlan; eventId: string | null }> {
  const sb = getSupabaseClient();
  const eventKey = buildEventKey(input);
  let eventId: string | null = null;

  if (sb) {
    const { data, error } = await sb
      .from("economic_events")
      .upsert(
        {
          name: input.eventName,
          date: input.date,
          time: input.time,
          country: input.country,
          category: input.category,
          impact: input.impact,
          forecast: input.forecast || null,
          previous: input.previous || null,
          detail: input.detail || `Manual desk plan event (${input.currency})`,
          event_key: eventKey,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "event_key" },
      )
      .select("id")
      .single();
    if (error) log.warn("manual economic event upsert failed", { error: error.message });
    eventId = data?.id ?? null;
  }

  const existing = await readDayPlan(TEAM_ID, input.date);
  const forecast = await generateEconForecast({
    eventName: input.eventName,
    eventDate: input.date,
    eventTime: input.time,
    eventCountry: input.country,
    eventCategory: input.category,
    forecast: input.forecast,
    previous: input.previous,
    isSpeech: isSpeechEvent(input),
  });
  const windows = mergeWindows(existing?.windows ?? [], {
    windowIndex: 0,
    startTime: input.startTime,
    endTime: input.endTime,
    eventName: input.eventName,
    eventCountry: input.country,
    econForecast: forecast,
  });

  const plan = await persistManualPlan({
    existing,
    input,
    windows,
  });
  return { plan, eventId };
}

function mergeWindows(
  existing: DayPlanWindow[],
  custom: Omit<DayPlanWindow, "id" | "dayPlanId">,
): Array<Omit<DayPlanWindow, "id" | "dayPlanId">> {
  const kept = existing.filter((window) => {
    const name = (window.eventName ?? "").trim().toLowerCase();
    return !(
      name === custom.eventName?.trim().toLowerCase() &&
      window.startTime === custom.startTime
    );
  });
  return [...kept, custom]
    .sort((a, b) => a.startTime.localeCompare(b.startTime))
    .map((window, index) => ({ ...window, windowIndex: index }));
}

async function persistManualPlan(input: {
  existing: DayPlan | null;
  input: CustomDeskPlanInput;
  windows: Array<Omit<DayPlanWindow, "id" | "dayPlanId">>;
}): Promise<DayPlan> {
  const sb = getSupabaseClient();
  const planId = input.existing?.id ?? `manual-${TEAM_ID}-${input.input.date}`;
  if (!sb) return inMemoryPlan(planId, input);

  const generatedAt = new Date().toISOString();
  const planPayload = {
    team_id: TEAM_ID,
    date: input.input.date,
    event_name: input.existing?.eventName ?? input.input.eventName,
    desk_theme:
      input.existing?.deskTheme ??
      `${input.input.currency} ${input.input.eventName}: agentic desk forecast attached.`,
    generated_by: "agentic-desk-manual",
    generated_at: generatedAt,
    plan_variant: input.existing?.planVariant ?? null,
  };

  let { data: planRow, error } = await sb
    .from("day_plans")
    .upsert(planPayload, { onConflict: "team_id,date" })
    .select()
    .single();
  if (error?.message?.includes("plan_variant")) {
    const { plan_variant: _planVariant, ...legacyPayload } = planPayload;
    const legacy = await sb
      .from("day_plans")
      .upsert(legacyPayload, { onConflict: "team_id,date" })
      .select()
      .single();
    planRow = legacy.data;
    error = legacy.error;
  }
  if (error || !planRow) return inMemoryPlan(planId, input);

  await sb.from("day_plan_windows").delete().eq("day_plan_id", planRow.id);
  const inserts = input.windows.map((window) => ({
    day_plan_id: planRow.id,
    window_index: window.windowIndex,
    start_time: window.startTime,
    end_time: window.endTime,
    event_name: window.eventName,
    econ_forecast: window.econForecast,
  }));

  let { data: rows, error: winError } = await sb
    .from("day_plan_windows")
    .insert(inserts)
    .select();
  if (winError?.message?.includes("econ_forecast")) {
    const legacy = inserts.map(
      ({ econ_forecast: _econForecast, ...row }) => row,
    );
    const retry = await sb.from("day_plan_windows").insert(legacy).select();
    rows = retry.data;
    winError = retry.error;
  }
  if (winError?.message?.includes("event_name")) {
    const minimal = inserts.map(
      ({ event_name: _eventName, econ_forecast: _econForecast, ...row }) => row,
    );
    const retry = await sb.from("day_plan_windows").insert(minimal).select();
    rows = retry.data;
    winError = retry.error;
  }
  if (winError) log.warn("manual window insert failed", { error: winError.message });
  return rowPlan(planRow, rows ?? [], input.windows);
}

function inMemoryPlan(
  planId: string,
  input: Parameters<typeof persistManualPlan>[0],
): DayPlan {
  return {
    id: planId,
    teamId: TEAM_ID,
    date: input.input.date,
    eventName: input.existing?.eventName ?? input.input.eventName,
    deskTheme: input.existing?.deskTheme ?? `${input.input.currency} custom desk plan.`,
    generatedBy: "agentic-desk-manual",
    generatedAt: new Date().toISOString(),
    sourceBriefId: null,
    institutionalPositioning: null,
    planVariant: input.existing?.planVariant ?? null,
    windows: input.windows.map((window, index) => ({
      ...window,
      id: `manual-w-${index}`,
      dayPlanId: planId,
    })),
  };
}

function rowPlan(
  row: any,
  windowRows: any[],
  fallback: Array<Omit<DayPlanWindow, "id" | "dayPlanId">>,
): DayPlan {
  return {
    id: row.id,
    teamId: row.team_id,
    date: row.date,
    eventName: row.event_name,
    deskTheme: row.desk_theme,
    generatedBy: row.generated_by,
    generatedAt: row.generated_at,
    sourceBriefId: row.source_brief_id,
    institutionalPositioning: row.institutional_positioning ?? null,
    planVariant: row.plan_variant ?? null,
    windows: (windowRows.length ? windowRows : fallback).map((window: any, index) => ({
      id: window.id ?? `manual-w-${index}`,
      dayPlanId: window.day_plan_id ?? row.id,
      windowIndex: window.window_index ?? fallback[index]?.windowIndex ?? index,
      startTime: String(window.start_time ?? fallback[index]?.startTime).slice(0, 5),
      endTime: String(window.end_time ?? fallback[index]?.endTime).slice(0, 5),
      eventName: window.event_name ?? fallback[index]?.eventName ?? null,
      eventCountry:
        window.econ_forecast?.eventCountry ?? fallback[index]?.eventCountry ?? null,
      econForecast: window.econ_forecast ?? fallback[index]?.econForecast ?? null,
    })),
  };
}

function buildEventKey(input: CustomDeskPlanInput): string {
  return createHash("sha256")
    .update(`${input.eventName}|${input.date}|${input.time}|${input.country}`)
    .digest("hex");
}
