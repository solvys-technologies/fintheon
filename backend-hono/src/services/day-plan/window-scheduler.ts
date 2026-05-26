// [claude-code 2026-05-15] S66-T1: added planWeeks() for multi-week generation.
//   Removed categoriesSeen constraint in buildPlannedDay so each distinct
//   event category window produces a separate PlannedDay entry.
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
const ACTIONABLE_START_MIN = 8 * 60;
const ACTIONABLE_END_MIN = 16 * 60;
const FULL_SESSION_START_MIN = 0;
const FULL_SESSION_END_MIN = 23 * 60 + 59;

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

const OBSERVED_COUNTRIES = new Set([
  "US",
  "AU",
  "NZ",
  "JP",
  "KR",
  "CN",
  "HK",
  "SG",
  "TW",
  "EU",
  "GB",
  "UK",
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

  const result: PlannedDay[] = [];
  for (const iso of days) {
    const plans = buildPlannedDays(iso, eventsByDate.get(iso) ?? []);
    result.push(...plans);
  }
  return result;
}

/**
 * Generate plans for multiple weeks ahead. Returns an array of week arrays.
 * Each inner array contains the PlannedDay entries for that week.
 */
export async function planWeeks(
  ref: Date = new Date(),
  weekCount: number = 4,
): Promise<PlannedDay[][]> {
  const weeks: PlannedDay[][] = [];
  let cursor = new Date(ref);
  cursor.setUTCHours(12, 0, 0, 0);

  for (let w = 0; w < weekCount; w++) {
    const weekDays = collectWeekdays(cursor, 5);
    const fromIso = weekDays[0];
    const toIso = weekDays[weekDays.length - 1];

    let events: Awaited<ReturnType<typeof readEconEvents>> = [];
    try {
      events = await readEconEvents({ from: fromIso, to: toIso });
    } catch (err) {
      log.warn("planWeeks: readEconEvents failed", {
        week: w,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    const eventsByDate = new Map<string, typeof events>();
    for (const evt of events) {
      if (!evt.date) continue;
      if (!eventsByDate.has(evt.date)) eventsByDate.set(evt.date, []);
      eventsByDate.get(evt.date)!.push(evt);
    }

    const weekPlans: PlannedDay[] = [];
    for (const iso of weekDays) {
      const plans = buildPlannedDays(iso, eventsByDate.get(iso) ?? []);
      weekPlans.push(...plans);
    }
    weeks.push(weekPlans);

    // Advance cursor to next Monday
    cursor.setUTCDate(cursor.getUTCDate() + 7);
  }

  return weeks;
}

export function planDay(
  date: Date,
  events: Awaited<ReturnType<typeof readEconEvents>> = [],
): PlannedDay {
  const iso = date.toISOString().slice(0, 10);
  const plans = buildPlannedDays(iso, events);
  return (
    plans[0] ?? {
      date: iso,
      day: DAY_LABELS[date.getUTCDay()] ?? "?",
      windows: [
        {
          windowIndex: 0,
          startTime: "09:30",
          endTime: "11:00",
          eventName: null,
          ivScore: null,
        },
      ],
      dominantEvent: null,
      ivScore: null,
    }
  );
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

/**
 * Build a PlannedDay for every notable observed event on the date. Windows can
 * span the overnight session for Asia/cross-border prints and Fed speakers.
 */
function buildPlannedDays(
  iso: string,
  events: Awaited<ReturnType<typeof readEconEvents>>,
): PlannedDay[] {
  const dow = new Date(`${iso}T12:00:00Z`).getUTCDay();
  const dayLabel = DAY_LABELS[dow] ?? "?";

  const actionableEvents = filterActionableEvents(iso, events);
  const dominant = pickDominantEvent(actionableEvents);
  const sorted = sortDeskEvents(actionableEvents);
  const windows: PlannedWindow[] = [];

  for (const evt of sorted) {
    const cat = plannedWindowTypeForEvent(evt);
    if (cat === "holiday") continue;
    if (evt.time && evt.name) {
      const band = bandAroundPrint(evt.time, shouldAllowFullSession(evt));
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
  windows.sort((a, b) => a.startTime.localeCompare(b.startTime));
  windows.forEach((window, index) => {
    window.windowIndex = index;
  });

  // If no windows found, generate a single standing-window plan
  if (windows.length === 0) {
    const earningsTilt = actionableEvents.some((e) =>
      (e.category ?? "").toLowerCase().includes("earnings"),
    );
    const standing = earningsTilt ? STANDING_AFTERNOON : STANDING_MORNING;
    return [
      {
        date: iso,
        day: dayLabel,
        windows: [
          {
            windowIndex: 0,
            startTime: standing.startTime,
            endTime: standing.endTime,
            eventName: dominant?.name ?? null,
            ivScore: scoreForImpact(dominant?.impact),
          },
        ],
        dominantEvent: dominant?.name ?? null,
        ivScore: scoreForImpact(dominant?.impact),
      },
    ];
  }

  return [
    {
      date: iso,
      day: dayLabel,
      windows,
      dominantEvent: dominant?.name ?? windows[0]?.eventName ?? null,
      ivScore: scoreForImpact(dominant?.impact) ?? windows[0]?.ivScore ?? null,
    },
  ];
}

function pickDominantEvent(
  events: Awaited<ReturnType<typeof readEconEvents>>,
): (typeof events)[number] | null {
  if (events.length === 0) return null;
  return sortDeskEvents(events)[0] ?? null;
}

function sortDeskEvents(
  events: Awaited<ReturnType<typeof readEconEvents>>,
): Awaited<ReturnType<typeof readEconEvents>> {
  return [...events]
    .sort((a, b) => {
      const priorityDelta = deskPriority(b) - deskPriority(a);
      if (priorityDelta !== 0) return priorityDelta;
      return (a.time ?? "23:59").localeCompare(b.time ?? "23:59");
    })
    .slice(0, 18);
}

function filterActionableEvents(
  iso: string,
  events: Awaited<ReturnType<typeof readEconEvents>>,
): Awaited<ReturnType<typeof readEconEvents>> {
  const now = new Date();
  const ny = nowInNewYork(now);
  const todayIso = ny.dateIso;
  const nowMinutes = ny.minutes;
  return events.filter((event) => {
    if (!event.date || event.date !== iso) return false;
    if (!isObservedEvent(event)) return false;
    if (!isNotableEvent(event)) return false;
    if (isMultiDayEvent(event)) return true;
    if (!event.time) return true;
    const minutes = minutesFromHHMM(event.time);
    if (minutes == null) return false;
    if (
      !shouldAllowFullSession(event) &&
      (minutes < ACTIONABLE_START_MIN || minutes > ACTIONABLE_END_MIN)
    ) {
      return false;
    }
    if (iso === todayIso && minutes < nowMinutes - 15) return false;
    return true;
  });
}

function isObservedEvent(event: {
  country?: string | null;
  category?: string | null;
  name?: string | null;
  impact?: string | null;
}): boolean {
  const country = (event.country ?? "").toUpperCase().trim();
  if (OBSERVED_COUNTRIES.has(country)) return true;
  const type = plannedWindowTypeForEvent(event);
  if (type === "speech" || type === "pool_call" || type === "summit")
    return true;
  return isWatchlistEventName(event.name);
}

function isNotableEvent(event: {
  category?: string | null;
  name?: string | null;
  country?: string | null;
  impact?: string | null;
}): boolean {
  const type = plannedWindowTypeForEvent(event);
  if (type === "holiday") return false;
  if (type === "speech" || type === "pool_call" || type === "summit")
    return true;
  if (impactWeight(event.impact ?? "low") >= 2) return true;
  return isWatchlistEventName(event.name);
}

function isWatchlistEventName(name?: string | null): boolean {
  const text = (name ?? "").toLowerCase();
  return /\b(fed|fomc|powell|barr|waller|williams|cpi|ppi|pce|payrolls?|nfp|claims|gdp|pmi|ism|retail sales|consumer confidence|nvidia|nvda)\b/.test(
    text,
  );
}

function shouldAllowFullSession(event: {
  country?: string | null;
  category?: string | null;
  name?: string | null;
}): boolean {
  const type = plannedWindowTypeForEvent(event);
  if (type === "speech" || type === "pool_call" || type === "summit")
    return true;
  if (type === "cross_border_macro" || type === "earnings") return true;
  const country = (event.country ?? "").toUpperCase().trim();
  return OBSERVED_COUNTRIES.has(country) && country !== "US";
}

function deskPriority(event: {
  category?: string | null;
  name?: string | null;
  country?: string | null;
  impact?: string | null;
}): number {
  const type = plannedWindowTypeForEvent(event);
  const typeWeight = CATEGORY_PREFERENCE[type]?.priority ?? 0;
  const watchlistBoost = isWatchlistEventName(event.name) ? 1 : 0;
  return typeWeight * 10 + impactWeight(event.impact ?? "low") + watchlistBoost;
}

function isMultiDayEvent(event: {
  name?: string | null;
  category?: string | null;
}): boolean {
  const text = `${event.name ?? ""} ${event.category ?? ""}`.toLowerCase();
  return /\b(jackson hole|summit|symposium|forum|conference|meetings?)\b/.test(
    text,
  );
}

function nowInNewYork(date: Date): { dateIso: string; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .formatToParts(date)
    .reduce<Record<string, string>>((acc, part) => {
      if (part.type !== "literal") acc[part.type] = part.value;
      return acc;
    }, {});
  const hour = Number(parts.hour ?? "0");
  const minute = Number(parts.minute ?? "0");
  return {
    dateIso: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: hour * 60 + minute,
  };
}

function impactWeight(impact: string): number {
  const order: Record<string, number> = { high: 3, medium: 2, low: 1 };
  return order[impact] ?? 1;
}

function bandAroundPrint(
  timeHHMM: string,
  allowFullSession = false,
): { start: string; end: string } | null {
  const total = minutesFromHHMM(timeHHMM);
  if (total == null) return null;
  const startLimit = allowFullSession
    ? FULL_SESSION_START_MIN
    : ACTIONABLE_START_MIN;
  const endLimit = allowFullSession ? FULL_SESSION_END_MIN : ACTIONABLE_END_MIN;
  if (total < startLimit || total > endLimit) return null;

  const start = clampMinutes(total - PRINT_BAND_MIN, startLimit, endLimit - 30);
  const end = clampMinutes(total + PRINT_BAND_MIN, start + 30, endLimit);
  return { start: minutesToHHMM(start), end: minutesToHHMM(end) };
}

function minutesFromHHMM(timeHHMM: string): number | null {
  const match = timeHHMM.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
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
