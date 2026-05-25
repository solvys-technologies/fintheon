// [claude-code 2026-04-25] S35-cleanup: bridge populated economic_events.actual
// rows into econ_prints so the ArbitrumChamber event-card / /api/econ/synthesize path
// has print history to render. Idempotent: dedupes on (headline ILIKE event-name,
// printed_at::date) so re-running it after another orchestrator drain is safe.

import { getSupabaseClient } from "../../config/supabase.js";
import { createLogger } from "../../lib/logger.js";

const log = createLogger("EconBridgeActuals");

interface EventRow {
  name: string;
  date: string;
  time: string | null;
  country: string | null;
  actual: string | null;
  forecast: string | null;
  previous: string | null;
}

interface ExistingPrintKey {
  headline: string;
  printed_at: string | null;
}

export interface BridgeResult {
  windowDays: number;
  scanned: number;
  inserted: number;
  skippedExisting: number;
  skippedNoActual: number;
}

function eventToPrintedAt(date: string, time: string | null): string {
  // ET wall-clock (HH:MM) → ET-anchored ISO. Falls back to noon ET if absent.
  const t = time && /^\d{2}:\d{2}$/.test(time) ? time : "12:00";
  // Build ET-anchored timestamp; -04:00 is ET DST. Close enough for binning by date.
  return `${date}T${t}:00-04:00`;
}

function normalizeKey(headline: string, printedAt: string | null): string {
  const day = printedAt ? printedAt.slice(0, 10) : "—";
  return `${headline.trim().toLowerCase()}|${day}`;
}

export async function bridgeRecentActualsToEconPrints(opts: {
  windowDays: number;
}): Promise<BridgeResult> {
  const sb = getSupabaseClient();
  const result: BridgeResult = {
    windowDays: opts.windowDays,
    scanned: 0,
    inserted: 0,
    skippedExisting: 0,
    skippedNoActual: 0,
  };
  if (!sb) return result;

  const since = new Date(Date.now() - opts.windowDays * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const { data: events, error: eventsErr } = await sb
    .from("economic_events")
    .select("name, date, time, country, actual, forecast, previous")
    .gte("date", since)
    .order("date", { ascending: true })
    .limit(2000);

  if (eventsErr) {
    log.warn("economic_events read failed", { error: eventsErr.message });
    return result;
  }

  const rows = (events ?? []) as EventRow[];
  result.scanned = rows.length;

  // Read existing econ_prints headlines+dates within the window so we can skip
  // already-bridged rows. We dedupe on (lowercased headline, printed_at::date).
  const sinceISO = `${since}T00:00:00Z`;
  const { data: existing, error: existingErr } = await sb
    .from("econ_prints")
    .select("headline, printed_at")
    .gte("printed_at", sinceISO)
    .limit(5000);

  if (existingErr) {
    log.warn("econ_prints read failed — continuing without dedupe", {
      error: existingErr.message,
    });
  }
  const existingKeys = new Set<string>(
    ((existing ?? []) as ExistingPrintKey[]).map((p) =>
      normalizeKey(p.headline, p.printed_at),
    ),
  );

  const toInsert: Array<{
    headline: string;
    actual_value: string;
    forecast_value: string | null;
    previous_value: string | null;
    source: string;
    printed_at: string;
  }> = [];

  for (const ev of rows) {
    if (!ev.actual || ev.actual.trim().length === 0) {
      result.skippedNoActual++;
      continue;
    }
    const printedAt = eventToPrintedAt(ev.date, ev.time);
    const headline = ev.country
      ? `${ev.country} ${ev.name}`.trim()
      : ev.name.trim();
    const key = normalizeKey(headline, printedAt);
    if (existingKeys.has(key)) {
      result.skippedExisting++;
      continue;
    }
    existingKeys.add(key);
    toInsert.push({
      headline,
      actual_value: ev.actual.trim(),
      forecast_value: ev.forecast?.trim() || null,
      previous_value: ev.previous?.trim() || null,
      source: "econ-bridge",
      printed_at: printedAt,
    });
  }

  if (toInsert.length === 0) {
    log.info("Bridge: nothing to insert", { ...result });
    return result;
  }

  // Insert in chunks of 100 to keep payload small.
  const CHUNK = 100;
  for (let i = 0; i < toInsert.length; i += CHUNK) {
    const slice = toInsert.slice(i, i + CHUNK);
    const { error: insertErr } = await sb.from("econ_prints").insert(slice);
    if (insertErr) {
      log.warn("Bridge insert chunk failed", {
        error: insertErr.message,
        chunkStart: i,
        chunkSize: slice.length,
      });
      continue;
    }
    result.inserted += slice.length;
  }

  log.info("Bridge complete", { ...result });
  return result;
}
