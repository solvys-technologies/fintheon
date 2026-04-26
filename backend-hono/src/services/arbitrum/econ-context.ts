// [claude-code 2026-04-25] S35-cleanup: shared econ-context loader for Arbitrum chamber runs.
// Pulls last-N-days econ_prints + next-N-days economic_events and shapes them
// into the ArbitrumEconContext consumed by seats.ts buildUserPrompt /
// buildDistillPrompt. Failures degrade to null so the chamber still runs.

import {
  readRecentEconPrintStats,
  readUpcomingEconEvents,
} from "../supabase-service.js";
import type { ArbitrumEconContext, ArbitrumEconPrintLine } from "./types.js";

// [claude-code 2026-04-26] S35-T13: Window bumped to 30d back / 5d forward
// per TP — chamber must reason against the full 30-day macro tape and project
// 5 days out. Forward window matches the seat output schema's forward_5d field.
const DEFAULT_WINDOW_DAYS = 30;
const DEFAULT_UPCOMING_DAYS = 5;

function parseNumeric(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = String(v).replace(/[%, ]/g, "");
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

function deriveDirection(
  actual: number | null,
  forecast: number | null,
): { direction: "beat" | "miss" | "inline" | null; surprise: number | null } {
  if (actual == null || forecast == null || forecast === 0) {
    return { direction: null, surprise: null };
  }
  const surprise = ((actual - forecast) / Math.abs(forecast)) * 100;
  if (Math.abs(surprise) < 2) {
    return { direction: "inline", surprise };
  }
  return { direction: surprise > 0 ? "beat" : "miss", surprise };
}

export async function loadArbitrumEconContext(opts?: {
  windowDays?: number;
  upcomingDays?: number;
}): Promise<ArbitrumEconContext | null> {
  const windowDays = opts?.windowDays ?? DEFAULT_WINDOW_DAYS;
  const upcomingDays = opts?.upcomingDays ?? DEFAULT_UPCOMING_DAYS;

  const [printRecords, upcomingRecords] = await Promise.all([
    readRecentEconPrintStats(windowDays * 24),
    readUpcomingEconEvents({ daysAhead: upcomingDays }),
  ]);

  const prints: ArbitrumEconPrintLine[] = printRecords.map((p) => {
    const actual = parseNumeric(p.actual_value);
    const forecast = parseNumeric(p.forecast_value);
    const previous = parseNumeric(p.previous_value);
    const { direction, surprise } = deriveDirection(actual, forecast);
    return {
      date: p.printed_at
        ? new Date(p.printed_at).toISOString().slice(0, 10)
        : null,
      name: (p.headline ?? "").split("|")[0].trim() || "Econ print",
      actual,
      forecast,
      previous,
      surprise: surprise != null ? Math.round(surprise * 100) / 100 : null,
      direction,
    };
  });

  const upcoming = upcomingRecords.map((e) => ({
    date: e.date,
    time: e.time ?? null,
    name: e.name ?? "Econ release",
    country: e.country ?? null,
  }));

  if (prints.length === 0 && upcoming.length === 0) return null;
  return { windowDays, prints, upcoming };
}
