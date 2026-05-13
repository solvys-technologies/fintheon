// [claude-code 2026-05-13] S64-T1: extended for speech/summit/pool_call/cross_border_macro event
//   types. Added isCrossBorderMacro() classifier for AU/NZ/JP/KR/CN/EU/UK data
//   with USD sensitivity. Supports generating multiple windows per day.
// [claude-code 2026-04-26] S45-T1: weekly trading-window pre-population pass.
// Reads next-5-weekday econ events + earnings catalysts and decides where the
// dominant window for each day should sit. Output is consumed by
// day-plan-service to lay down the per-day window times before bars/math.
//
// Heuristic (no ML):
//   - If a high-impact econ event lands in the regular session, anchor the
//     window to a 90-min block surrounding the print.
//   - Otherwise fall back to the standing morning window 09:30-11:00 ET.
//   - Earnings cluster days nudge the window toward the close (14:30-16:00).
//   - S64-T1: additional windows for speeches, summits, pool calls, and
//     cross-border macro prints with USD sensitivity.

import { readEconEvents } from "../supabase-service.js";
import { createLogger } from "../../lib/logger.js";

const log = createLogger("WindowScheduler");

const STANDING_MORNING = { startTime: "09:30", endTime: "11:00" } as const;
const STANDING_AFTERNOON = { startTime: "14:30", endTime: "16:00" } as const;
const PRINT_BAND_MIN = 45;

export interface PlannedWindow {
  windowIndex: number;
  startTime: string;
  endTime: string;
  eventName: string | null;
  ivScore: number | null;
}

export interface PlannedDay {
  /** ISO "YYYY-MM-DD" */
  date: string;
  /** "Mon" / "Tue" / ... */
  day: string;
  windows: PlannedWindow[];
  /** Most-load-bearing event for the day, if any. */
  dominantEvent: string | null;
  ivScore: number | null;
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// ── Cross-border macro classifier ───────────────────────────────────────────

/** Countries/regions whose economic data releases can move USD pairs. */
const CROSS_BORDER_COUNTRIES = new Set([
  "AU", // Australia — RBA, CPI, employment
  "NZ", // New Zealand — RBNZ
  "JP", // Japan — BoJ, CPI, Tankan
  "KR", // South Korea — BoK, CPI
  "CN", // China — PBOC, GDP, PMI, CPI
  "EU", // Eurozone — ECB, CPI, GDP
  "GB", // UK — BoE, CPI, employment
  "UK", // UK alias
]);

/**
 * Classify an event as cross-border macro based on its country and name.
 * Returns true when the event is economic data from AU/NZ/JP/KR/CN/EU/UK
 * that has USD sensitivity (FX pairs, rate expectations, capital flows).
 */
export function isCrossBorderMacro(event: {
  country?: string | null;
  category?: string | null;
  name?: string | null;
}): boolean {
  const country = (event.country ?? "").toUpperCase().trim();
  if (!CROSS_BORDER_COUNTRIES.has(country)) return false;

  // Only economic data releases are cross-border macro — not
  // holidays, not general news, not earnings.
  const category = (event.category ?? "").toLowerCase();
  if (category === "speaker") return false;
  if (category === "holiday") return false;
  if (category === "earnings") return false;

  // If no category, infer from name keywords
  const name = (event.name ?? "").toLowerCase();
  const macroKeywords = [
    "cpi",
    "inflation",
    "gdp",
    "employment",
    "unemployment",
    "payrolls",
    "trade",
    "retail sales",
    "industrial production",
    "manufacturing",
    "services pmi",
    "composite pmi",
    "pmi",
    "consumer confidence",
    "business confidence",
    "interest rate",
    "rate decision",
    "monetary policy",
    "current account",
    "budget",
    "obo", // open market operations
    "m2",
    "loan growth",
  ];
  const isMacroName = macroKeywords.some((kw) => name.includes(kw));
  return isMacroName;
}

/**
 * Classify an event into a window-scheduler category.
 */
export function plannedWindowTypeForEvent(event: {
  category?: string | null;
  name?: string | null;
  country?: string | null;
  impact?: string | null;
}): EconWindowCategory {
  const cat = (event.category ?? "").toLowerCase();
  const name = (event.name ?? "").toLowerCase();
  const impact = (event.impact ?? "").toLowerCase();

  // Pool call: Speaker category, PoolCall speaker (populated by wh-pool-call)
  const isPoolCall =
    cat === "speaker" &&
    (name.includes("poolcall") ||
      name.includes("pool call") ||
      name.includes("pool report") ||
      name.includes("gaggle") ||
      name.includes("briefing") ||
      name.includes("pool_log"));

  if (isPoolCall) return "pool_call";

  // Speech: Speaker category with speech/remarks/testimony keywords
  if (cat === "speaker") {
    const speechKeywords =
      /\b(speech|speaks?|speaking|remarks|testimony|testifies|testifying|press conference|briefing|statement)\b/i;
    if (speechKeywords.test(name)) return "speech";
    return "speech"; // Treat all Speaker events as speech windows
  }

  // Summit: category includes "summit" or name includes "summit" or "meeting"
  if (
    cat.includes("summit") ||
    name.includes("summit") ||
    (cat === "meeting" && impact !== "low")
  ) {
    return "summit";
  }

  // Cross-border macro: economic data from AU/NZ/JP/KR/CN/EU/UK
  if (isCrossBorderMacro(event)) return "cross_border_macro";

  // Standard econ print
  if (
    cat === "economic" ||
    cat === "" ||
    cat === "data" ||
    name.includes("cpi") ||
    name.includes("gdp") ||
    name.includes("employment") ||
    name.includes("pmi")
  ) {
    return "economic";
  }

  if (cat === "earnings") return "earnings";
  if (cat === "holiday") return "holiday";

  return "economic";
}

type EconWindowCategory =
  | "economic"
  | "speech"
  | "summit"
  | "pool_call"
  | "cross_border_macro"
  | "earnings"
  | "holiday";

// ── Window preference map ───────────────────────────────────────────────────

const CATEGORY_PREFERENCE: Record<
  EconWindowCategory,
  { default: "morning" | "afternoon"; priority: number }
> = {
  speech: { default: "morning", priority: 6 },
  summit: { default: "morning", priority: 5 },
  pool_call: { default: "morning", priority: 4 },
  cross_border_macro: { default: "morning", priority: 3 },
  economic: { default: "morning", priority: 2 },
  earnings: { default: "afternoon", priority: 1 },
  holiday: { default: "morning", priority: 0 },
};

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Build the next 5 weekday plans (Mon–Fri including today if today is a weekday).
 */
export async function planWeek(
  referenceDate: Date = new Date(),
): Promise<PlannedDay[]> {
  const days = collectWeekdays(referenceDate, 5);
  const fromIso = days[0];
  const toIso = days[days.length - 1];

  let events: Awaited<ReturnType<typeof readEconEvents>> = [];
  try {
    events = await readEconEvents({ from: fromIso, to: toIso });
  } catch (err) {
    log.warn("readEconEvents failed — defaulting to standing windows", {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  const eventsByDate = new Map<string, typeof events>();
  for (const evt of events) {
    if (!evt.date) continue;
    if (!eventsByDate.has(evt.date)) eventsByDate.set(evt.date, []);
    eventsByDate.get(evt.date)!.push(evt);
  }

  return days.map((iso) => buildPlannedDay(iso, eventsByDate.get(iso) ?? []));
}

export function planDay(
  date: Date,
  events: Awaited<ReturnType<typeof readEconEvents>> = [],
): PlannedDay {
  const iso = date.toISOString().slice(0, 10);
  return buildPlannedDay(iso, events);
}

// ── Internals ───────────────────────────────────────────────────────────────

function collectWeekdays(reference: Date, count: number): string[] {
  const out: string[] = [];
  const cursor = new Date(reference);
  cursor.setUTCHours(12, 0, 0, 0);
  while (out.length < count) {
    const dow = cursor.getUTCDay();
    if (dow >= 1 && dow <= 5) {
      out.push(cursor.toISOString().slice(0, 10));
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}

function buildPlannedDay(
  iso: string,
  events: Awaited<ReturnType<typeof readEconEvents>>,
): PlannedDay {
  const dow = new Date(`${iso}T12:00:00Z`).getUTCDay();
  const dayLabel = DAY_LABELS[dow] ?? "?";

  const dominant = pickDominantEvent(events);
  const windows: PlannedWindow[] = [];

  // Group events by category, generate a window for each non-holiday category
  const categoriesSeen = new Set<EconWindowCategory>();

  // Sort events by impact to give priority to high-impact windows
  const sorted = [...events].sort(
    (a, b) =>
      (impactWeight(b.impact ?? "low") ?? 0) -
      (impactWeight(a.impact ?? "low") ?? 0),
  );

  for (const evt of sorted) {
    const cat = plannedWindowTypeForEvent(evt);
    if (cat === "holiday") continue;
    if (categoriesSeen.has(cat)) continue;
    categoriesSeen.add(cat);

    if (evt.time && evt.name) {
      const band = bandAroundPrint(evt.time);
      if (band) {
        windows.push({
          windowIndex: windows.length,
          startTime: band.start,
          endTime: band.end,
          eventName: evt.name,
          ivScore: scoreForImpact(evt.impact),
        });
      }
    }
  }

  // Ensure at least one window exists (standing default)
  if (windows.length === 0) {
    const earningsTilt = events.some((e) =>
      (e.category ?? "").toLowerCase().includes("earnings"),
    );
    const standing = earningsTilt ? STANDING_AFTERNOON : STANDING_MORNING;
    windows.push({
      windowIndex: 0,
      startTime: standing.startTime,
      endTime: standing.endTime,
      eventName: dominant?.name ?? null,
      ivScore: scoreForImpact(dominant?.impact),
    });
  }

  return {
    date: iso,
    day: dayLabel,
    windows,
    dominantEvent: dominant?.name ?? null,
    ivScore: scoreForImpact(dominant?.impact),
  };
}

function pickDominantEvent(
  events: Awaited<ReturnType<typeof readEconEvents>>,
): (typeof events)[number] | null {
  if (events.length === 0) return null;
  return [...events].sort(
    (a, b) =>
      (impactWeight(b.impact ?? "low") ?? 0) -
      (impactWeight(a.impact ?? "low") ?? 0),
  )[0];
}

function impactWeight(impact: string): number {
  const order: Record<string, number> = { high: 3, medium: 2, low: 1 };
  return order[impact] ?? 1;
}

function bandAroundPrint(
  timeHHMM: string,
): { start: string; end: string } | null {
  const match = timeHHMM.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;

  const total = hours * 60 + minutes;
  const start = clampMinutes(total - PRINT_BAND_MIN, 8 * 60, 16 * 60 - 30);
  const end = clampMinutes(total + PRINT_BAND_MIN, start + 30, 16 * 60);
  return { start: minutesToHHMM(start), end: minutesToHHMM(end) };
}

function clampMinutes(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function minutesToHHMM(total: number): string {
  const h = Math.floor(total / 60)
    .toString()
    .padStart(2, "0");
  const m = (total % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

function scoreForImpact(impact?: string): number | null {
  if (!impact) return null;
  if (impact === "high") return 8;
  if (impact === "medium") return 5;
  if (impact === "low") return 2;
  return null;
}
