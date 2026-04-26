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

  if (dominant && dominant.time) {
    const band = bandAroundPrint(dominant.time);
    if (band) {
      windows.push({
        windowIndex: 0,
        startTime: band.start,
        endTime: band.end,
        eventName: dominant.name,
        ivScore: scoreForImpact(dominant.impact),
      });
    }
  }

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
  const order: Record<string, number> = { high: 3, medium: 2, low: 1 };
  return [...events].sort(
    (a, b) => (order[b.impact ?? "low"] ?? 0) - (order[a.impact ?? "low"] ?? 0),
  )[0];
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
  // Anchor pre-print to capture the inventory build, post-print to capture move
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
