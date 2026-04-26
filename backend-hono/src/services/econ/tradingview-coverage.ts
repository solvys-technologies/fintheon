// [claude-code 2026-04-26] On-demand TradingView Economic Calendar fetch
// for Arbitrum chamber runs. When a deliberation needs historical econ
// context that the populator hasn't seeded yet (cold-boot, expanded window,
// new country code), the chamber calls `ensureEconCoverage` before reading
// from `economic_events` / `econ_prints`. The helper checks coverage of the
// requested window, hits the TV API for any gap, and upserts the result so
// the next read finds it.
//
// All upserts are idempotent (event_key = sha256(name|date|time|country)),
// so duplicate calls cost a network round-trip and nothing else. Historical
// `actual` values flow into `econ_prints` so the chamber's surprise/direction
// derivation lights up immediately.

import { createHash } from "node:crypto";
import {
  upsertEconEvent,
  writeEconPrint,
  type EconEventRecord,
} from "../supabase-service.js";
import {
  categorizeEvent,
  type EconCountryCode,
} from "../econ-calendar-service.js";
import { getSupabaseClient } from "../../config/supabase.js";
import { createLogger } from "../../lib/logger.js";

const log = createLogger("TVEconCoverage");

const TV_CALENDAR_URL = "https://economic-calendar.tradingview.com/events";
const TV_BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36";
const FETCH_TIMEOUT_MS = 20_000;

interface TVEvent {
  id?: string;
  title?: string;
  country?: string;
  indicator?: string;
  ticker?: string;
  actual?: number | null;
  previous?: number | null;
  forecast?: number | null;
  unit?: string | null;
  scale?: string | null;
  importance?: -1 | 0 | 1;
  date?: string;
}

const TV_TO_INTERNAL: Record<string, EconCountryCode> = {
  US: "US",
  EU: "EU",
  GB: "UK",
  UK: "UK",
  JP: "JP",
  NZ: "NZ",
  AU: "AU",
  CA: "CA",
};

const INTERNAL_TO_TV: Record<EconCountryCode, string> = {
  US: "US",
  EU: "EU",
  UK: "GB",
  JP: "JP",
  NZ: "NZ",
  AU: "AU",
  CA: "CA",
};

function tvImpactToImpact(
  importance: TVEvent["importance"],
): "low" | "medium" | "high" | undefined {
  if (importance === 1) return "high";
  if (importance === 0) return "medium";
  if (importance === -1) return "low";
  return undefined;
}

function eventKey(parts: {
  name: string;
  date: string;
  time: string;
  country: string;
}): string {
  return createHash("sha256")
    .update(
      `${parts.name.trim()}|${parts.date}|${parts.time}|${parts.country}`,
      "utf8",
    )
    .digest("hex");
}

// TV ships UTC; the existing populator stores ET-local date+time so the two
// feeds collapse on the same event_key. Mirror that here.
function splitDateTimeET(iso: string): { date: string; time: string } | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => fmt.find((p) => p.type === t)?.value ?? "";
  const date = `${get("year")}-${get("month")}-${get("day")}`;
  let hh = get("hour");
  if (hh === "24") hh = "00";
  const mm = get("minute");
  return { date, time: `${hh}:${mm}` };
}

export async function fetchTradingViewRange(opts: {
  from: string; // YYYY-MM-DD or full ISO
  to: string;
  countries: readonly EconCountryCode[];
}): Promise<TVEvent[] | null> {
  const tvCountries = opts.countries
    .map((c) => INTERNAL_TO_TV[c] ?? c)
    .join(",");
  const params = new URLSearchParams({
    from: opts.from.includes("T") ? opts.from : `${opts.from}T00:00:00.000Z`,
    to: opts.to.includes("T") ? opts.to : `${opts.to}T23:59:59.999Z`,
    countries: tvCountries,
  });
  const url = `${TV_CALENDAR_URL}?${params.toString()}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9",
        Origin: "https://www.tradingview.com",
        Referer: "https://www.tradingview.com/",
        "User-Agent": TV_BROWSER_UA,
      },
    });
    if (!res.ok) {
      log.warn("TV fetch non-OK", { status: res.status });
      return null;
    }
    const json = (await res.json()) as { status?: string; result?: TVEvent[] };
    if (json.status !== "ok" || !Array.isArray(json.result)) {
      log.warn("TV non-ok payload", { status: json.status });
      return null;
    }
    return json.result;
  } catch (err) {
    log.error("TV fetch failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  } finally {
    clearTimeout(timer);
  }
}

interface UpsertResult {
  upserted: number;
  printsWritten: number;
  skipped: number;
}

export async function upsertTradingViewEvents(
  events: TVEvent[],
  opts?: { bridgeActualsToPrints?: boolean },
): Promise<UpsertResult> {
  const bridge = opts?.bridgeActualsToPrints ?? true;
  let upserted = 0;
  let printsWritten = 0;
  let skipped = 0;

  for (const tv of events) {
    if (!tv.title || !tv.country || !tv.date) {
      skipped++;
      continue;
    }
    const country = TV_TO_INTERNAL[tv.country.toUpperCase()];
    if (!country) {
      skipped++;
      continue;
    }
    const dt = splitDateTimeET(tv.date);
    if (!dt) {
      skipped++;
      continue;
    }
    const name = tv.title.trim();
    const category = categorizeEvent(name);
    const key = eventKey({
      name,
      date: dt.date,
      time: dt.time,
      country,
    });
    const record: Omit<EconEventRecord, "id" | "created_at" | "updated_at"> & {
      event_key: string;
    } = {
      name,
      date: dt.date,
      time: dt.time,
      country,
      category,
      forecast: tv.forecast == null ? undefined : String(tv.forecast),
      previous: tv.previous == null ? undefined : String(tv.previous),
      actual: tv.actual == null ? undefined : String(tv.actual),
      impact: tvImpactToImpact(tv.importance),
      event_key: key,
    };

    const written = await upsertEconEvent(record);
    if (!written) continue;
    upserted++;

    // Historical actuals → econ_prints so the Arbitrum surprise/direction
    // derivation has them. Skip if we don't have an actual yet.
    if (bridge && tv.actual != null) {
      try {
        await writeEconPrint({
          headline: `${name} | ${country}`,
          actual_value: String(tv.actual),
          forecast_value: tv.forecast == null ? undefined : String(tv.forecast),
          previous_value: tv.previous == null ? undefined : String(tv.previous),
          source: "tradingview",
        });
        printsWritten++;
      } catch (err) {
        log.warn("writeEconPrint failed", {
          name,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  return { upserted, printsWritten, skipped };
}

interface CoverageOpts {
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD
  countries: readonly EconCountryCode[];
  minRowsPerDay?: number; // default 1 — below this we treat as "gap"
  forceRefresh?: boolean;
}

interface CoverageResult {
  rangeDays: number;
  rowsBefore: number;
  rowsAfter: number;
  fetched: number;
  upserted: number;
  printsWritten: number;
  skipped: number;
  hitTV: boolean;
}

export async function ensureEconCoverage(
  opts: CoverageOpts,
): Promise<CoverageResult> {
  const sb = getSupabaseClient();
  const minRowsPerDay = opts.minRowsPerDay ?? 1;
  const days =
    Math.ceil(
      (Date.parse(`${opts.to}T00:00:00Z`) -
        Date.parse(`${opts.from}T00:00:00Z`)) /
        86_400_000,
    ) + 1;
  const minRows = Math.max(1, days * minRowsPerDay);

  let rowsBefore = 0;
  if (sb) {
    const { count } = await sb
      .from("economic_events")
      .select("id", { count: "exact", head: true })
      .gte("date", opts.from)
      .lte("date", opts.to)
      .in("country", [...opts.countries]);
    rowsBefore = count ?? 0;
  }

  if (!opts.forceRefresh && rowsBefore >= minRows) {
    return {
      rangeDays: days,
      rowsBefore,
      rowsAfter: rowsBefore,
      fetched: 0,
      upserted: 0,
      printsWritten: 0,
      skipped: 0,
      hitTV: false,
    };
  }

  const events = await fetchTradingViewRange({
    from: opts.from,
    to: opts.to,
    countries: opts.countries,
  });
  if (!events) {
    return {
      rangeDays: days,
      rowsBefore,
      rowsAfter: rowsBefore,
      fetched: 0,
      upserted: 0,
      printsWritten: 0,
      skipped: 0,
      hitTV: true,
    };
  }
  const { upserted, printsWritten, skipped } = await upsertTradingViewEvents(
    events,
  );

  let rowsAfter = rowsBefore + upserted;
  if (sb) {
    const { count } = await sb
      .from("economic_events")
      .select("id", { count: "exact", head: true })
      .gte("date", opts.from)
      .lte("date", opts.to)
      .in("country", [...opts.countries]);
    rowsAfter = count ?? rowsAfter;
  }

  return {
    rangeDays: days,
    rowsBefore,
    rowsAfter,
    fetched: events.length,
    upserted,
    printsWritten,
    skipped,
    hitTV: true,
  };
}
