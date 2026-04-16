// [claude-code 2026-04-16] Economic Calendar service — Supabase-backed

import {
  readEconEvents,
  readEconPrints as readEconPrintRecords,
  writeEconPrint as writeEconPrintRecord,
  writeEconEvent,
  updateEconEventActual,
  type EconEventRecord,
  type EconPrintRecord,
} from "./supabase-service.js";

// ── Types (preserved for backward compatibility) ────────────────────────────

export interface EconEvent {
  id: string;
  name: string;
  date?: string;
  time?: string;
  country: string;
  importance: 1 | 2 | 3;
  forecast?: string;
  previous?: string;
  actual?: string;
  category?: string;
  definition?: string;
  aiTicker?: string;
}

export interface EconPrint {
  id: string;
  eventName: string;
  date: string;
  actual: number | null;
  forecast: number | null;
  previous: number | null;
  surprise: number | null;
  direction: "beat" | "miss" | "inline" | null;
  goodBeta: boolean;
}

// ── Fetch Economic Calendar Events ──────────────────────────────────────────

export async function fetchEconCalendar(opts?: {
  from?: string;
  to?: string;
}): Promise<EconEvent[]> {
  const records = await readEconEvents({
    from: opts?.from,
    to: opts?.to,
  });

  return records.map((r) => impactToEconEvent(r));
}

// ── Fetch Econ Prints (Historical Actuals) ──────────────────────────────────

export async function fetchEconPrints(
  eventName?: string,
): Promise<EconPrint[]> {
  const records = await readEconPrintRecords({ eventName });

  return records.map((r) => {
    const actual = r.actual_value != null ? parseFloat(r.actual_value) : null;
    const forecast =
      r.forecast_value != null ? parseFloat(r.forecast_value) : null;
    const previous =
      r.previous_value != null ? parseFloat(r.previous_value) : null;

    const surprise =
      actual !== null &&
      forecast !== null &&
      forecast !== 0 &&
      !isNaN(actual) &&
      !isNaN(forecast)
        ? Math.round(((actual - forecast) / Math.abs(forecast)) * 10000) / 100
        : null;

    const direction: EconPrint["direction"] =
      actual !== null && forecast !== null && !isNaN(actual) && !isNaN(forecast)
        ? actual > forecast
          ? "beat"
          : actual < forecast
            ? "miss"
            : "inline"
        : null;

    return {
      id: r.id!,
      eventName: r.headline.split("|")[0].trim() || eventName || "Unknown",
      date: r.printed_at
        ? new Date(r.printed_at).toISOString().slice(0, 10)
        : "",
      actual: isNaN(actual!) ? null : actual,
      forecast: isNaN(forecast!) ? null : forecast,
      previous: isNaN(previous!) ? null : previous,
      surprise,
      direction,
      goodBeta: false,
    };
  });
}

// ── Write Econ Print ────────────────────────────────────────────────────────

export async function writeEconPrint(print: {
  eventName: string;
  date: string;
  actual: number;
  forecast?: number;
  previous?: number;
}): Promise<{ id: string; url: string } | null> {
  const result = await writeEconPrintRecord({
    headline: print.eventName,
    actual_value: String(print.actual),
    forecast_value: print.forecast != null ? String(print.forecast) : undefined,
    previous_value: print.previous != null ? String(print.previous) : undefined,
  });

  if (!result) return null;
  return { id: result.id!, url: "" };
}

// ── Update actual on an existing Economic Events row ────────────────────────

export async function updateEventActual(
  eventId: string,
  actual: string,
): Promise<boolean> {
  return updateEconEventActual(eventId, actual);
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function impactToImportance(impact?: string): 1 | 2 | 3 {
  if (impact === "high") return 3;
  if (impact === "medium") return 2;
  return 1;
}

function impactToEconEvent(r: EconEventRecord): EconEvent {
  return {
    id: r.id!,
    name: r.name || "Untitled Event",
    date: r.date ?? undefined,
    time: r.time ?? undefined,
    country: "US",
    importance: impactToImportance(r.impact),
    forecast: r.forecast ?? undefined,
    previous: r.previous ?? undefined,
    actual: r.actual ?? undefined,
    category: undefined,
    definition: r.detail ?? undefined,
    aiTicker: undefined,
  };
}
