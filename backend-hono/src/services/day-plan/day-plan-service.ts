// [claude-code 2026-04-26] S45-T1: Day-plan orchestrator. Pulls TV/Yahoo bars,
// runs VWAP/POC/VAH/VAL math, picks the dominant window, computes prices of
// interest + invalidation + profit target + expected move, generates the
// Desk Theme via Sonnet, and persists day_plans + day_plan_windows. Idempotent
// on (team_id, date).

import { getSupabaseClient } from "../../config/supabase.js";
import { createLogger } from "../../lib/logger.js";
import { readEconEvents } from "../supabase-service.js";
import { getFeed } from "../riskflow/feed-service.js";
import { getCurrentRegime } from "../regime/regime-service.js";
import { getVix } from "../market-data/yahoo-market.js";
import { continuousVIXMultiplier } from "../iv-scoring/computation.js";
import { fetchInstrumentBars } from "./tv-bars-fetcher.js";
import {
  expectedMove,
  pointOfControl,
  timeAnchoredVWAP,
  valueArea,
  type OHLCVBar,
} from "./vwap-poc-math.js";
import {
  roundEntry,
  roundFine,
  roundPricesOfInterest,
} from "./price-rounding.js";
import { generateDeskTheme } from "./desk-theme-generator.js";
import { planDay } from "./window-scheduler.js";
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
}

export interface GenerateDayPlanResult {
  plan: DayPlan;
  persisted: boolean;
  reused: boolean;
}

export async function generateDayPlan(
  input: GenerateDayPlanInput = {},
): Promise<GenerateDayPlanResult> {
  const teamId = input.teamId ?? DEFAULT_TEAM;
  const reference = input.date ?? new Date();
  const dateIso = reference.toISOString().slice(0, 10);
  const instrument = input.instrument ?? DEFAULT_INSTRUMENT;

  if (!input.override) {
    const existing = await readDayPlan(teamId, dateIso);
    if (existing) {
      return { plan: existing, persisted: false, reused: true };
    }
  }

  const [econEvents, feedResponse, regimeState, vix] = await Promise.all([
    readEconEvents({ from: dateIso, to: dateIso }).catch(() => []),
    getFeed("system", { limit: 20 }).catch(() => ({ items: [] }) as never),
    getCurrentRegime().catch(() => null),
    getVix().catch(() => null),
  ]);

  const planned = planDay(reference, econEvents);
  const dominantWindow = planned.windows[0] ?? {
    windowIndex: 0,
    startTime: "09:30",
    endTime: "11:00",
    eventName: null,
    ivScore: null,
  };

  // Pull bars for the three benchmarks; the planner ultimately keys off
  // `instrument` but the fetcher does it in one shot for cost.
  const barSets = await fetchInstrumentBars(["/NQ", "/ES", "/YM"]);
  const barsForInstrument =
    barSets.find((b) => b.symbol === instrument)?.bars ??
    barSets[0]?.bars ??
    [];

  const anchorTs = anchorForWindow(reference, dominantWindow.startTime);
  const vwap = timeAnchoredVWAP(barsForInstrument, anchorTs);
  const poc = pointOfControl(barsForInstrument);
  const va = valueArea(barsForInstrument);

  const spot = latestClose(barsForInstrument) ?? vwap ?? poc ?? null;

  const ivScore = dominantWindow.ivScore;
  const ivPct = ivScoreToImpliedVol(ivScore);
  const vixMultiplier = vix?.value ? continuousVIXMultiplier(vix.value) : 1;
  const expectedMovePct = spot
    ? (expectedMove(spot, ivPct, 1, vixMultiplier) / spot) * 100
    : null;

  const candidatePrices = [vwap, poc, va?.vah, va?.val].filter(
    (n): n is number => typeof n === "number" && Number.isFinite(n),
  );
  const pricesOfInterest = roundPricesOfInterest(candidatePrices, instrument);
  const invalidation = computeInvalidation(va, instrument);
  const profitTarget = computeProfitTarget(spot, expectedMovePct, instrument);

  const topHeadline = (feedResponse.items ?? [])[0]?.headline ?? "";
  const eventName = planned.dominantEvent;
  const deskTheme = await generateDeskTheme({
    date: dateIso,
    catalystHeadline: topHeadline || (eventName ?? "today's session"),
    ivScore,
    eventName,
    windowLabel: `${dominantWindow.startTime}-${dominantWindow.endTime}`,
    instrument,
    pricesOfInterest,
    regime: regimeState?.regime ?? null,
  });

  const plan = await persistDayPlan({
    teamId,
    dateIso,
    eventName,
    deskTheme,
    generatedBy: input.generatedBy ?? "day-plan-cron",
    windows: [
      {
        windowIndex: dominantWindow.windowIndex,
        startTime: dominantWindow.startTime,
        endTime: dominantWindow.endTime,
        pricesOfInterest,
        invalidation,
        profitTarget,
        expectedMovePct,
      },
    ],
  });

  log.info("Day-plan generated", {
    date: dateIso,
    teamId,
    instrument,
    barsCount: barsForInstrument.length,
    pricesOfInterest,
    invalidation,
    profitTarget,
    expectedMovePct,
    override: !!input.override,
    overrideReason: input.overrideReason,
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

interface PersistInput {
  teamId: string;
  dateIso: string;
  eventName: string | null;
  deskTheme: string | null;
  generatedBy: string;
  windows: Array<{
    windowIndex: number;
    startTime: string;
    endTime: string;
    pricesOfInterest: number[];
    invalidation: number | null;
    profitTarget: number | null;
    expectedMovePct: number | null;
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

  // Replace windows for the day to keep persistence idempotent.
  await sb.from("day_plan_windows").delete().eq("day_plan_id", planRow.id);

  const windowInserts = input.windows.map((w) => ({
    day_plan_id: planRow.id,
    window_index: w.windowIndex,
    start_time: w.startTime,
    end_time: w.endTime,
    prices_of_interest: w.pricesOfInterest,
    invalidation: w.invalidation,
    profit_target: w.profitTarget,
    expected_move_pct: w.expectedMovePct,
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
    windows: input.windows.map((w, i) => ({
      id: `mem-w-${i}`,
      dayPlanId: planId,
      windowIndex: w.windowIndex,
      startTime: w.startTime,
      endTime: w.endTime,
      pricesOfInterest: w.pricesOfInterest,
      invalidation: w.invalidation,
      profitTarget: w.profitTarget,
      expectedMovePct: w.expectedMovePct,
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
    pricesOfInterest: Array.isArray(row.prices_of_interest)
      ? row.prices_of_interest.map((n: any) => Number(n))
      : [],
    invalidation: row.invalidation == null ? null : Number(row.invalidation),
    profitTarget: row.profit_target == null ? null : Number(row.profit_target),
    expectedMovePct:
      row.expected_move_pct == null ? null : Number(row.expected_move_pct),
  };
}

function anchorForWindow(reference: Date, hhmm: string): number {
  const [hh, mm] = hhmm.split(":").map((n) => parseInt(n, 10));
  const dt = new Date(reference);
  dt.setHours(hh ?? 9, mm ?? 30, 0, 0);
  return dt.getTime();
}

function latestClose(bars: OHLCVBar[]): number | null {
  for (let i = bars.length - 1; i >= 0; i--) {
    const close = bars[i]?.close;
    if (typeof close === "number" && Number.isFinite(close)) return close;
  }
  return null;
}

function ivScoreToImpliedVol(ivScore: number | null): number {
  if (ivScore == null) return 0.16;
  // Map 0-10 catalyst score to a rough IV decimal: 0→0.10, 5→0.20, 10→0.35
  const clamped = Math.max(0, Math.min(10, ivScore));
  return 0.1 + (clamped / 10) * 0.25;
}

function computeInvalidation(
  va: { vah: number; val: number; poc: number } | null,
  instrument: string,
): number | null {
  if (!va) return null;
  // Below VAL by one fine handle = invalidation for a long bias day
  return roundFine(va.val, instrument);
}

function computeProfitTarget(
  spot: number | null,
  expectedMovePct: number | null,
  instrument: string,
): number | null {
  if (spot == null || expectedMovePct == null) return null;
  const target = spot * (1 + expectedMovePct / 100);
  return roundEntry(target, instrument);
}
