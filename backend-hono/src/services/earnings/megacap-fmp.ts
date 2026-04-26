// [claude-code 2026-04-25] S40-P8: megacap earnings ingestion via FMP.
// Pulls FMP /v3/earning_calendar?from=&to= and upserts into earnings_events.
// Filtered to MEGACAP_TICKERS (12 hand-curated NDX∩SPX>$300B names).
//
// On missing FMP_API_KEY: logs once, returns { upserted: 0 }, never throws.
// The system stays live with a hardcoded fallback in getUpcomingHardcoded().

import { getSupabaseClient } from "../../config/supabase.js";
import { createLogger } from "../../lib/logger.js";
import { MEGACAP_TICKERS, MEGACAP_TICKER_SET } from "./megacap-tickers.js";

const log = createLogger("MegacapFMP");

const FMP_BASE = "https://financialmodelingprep.com/api/v3";

interface FmpCalendarRow {
  date: string; // YYYY-MM-DD
  symbol: string;
  eps?: number | null;
  epsEstimated?: number | null;
  time?: string | null; // 'bmo' | 'amc' | timestamp
  fiscalDateEnding?: string | null;
}

interface FmpHistoricalRow {
  date: string;
  symbol: string;
  eps?: number | null;
  epsEstimated?: number | null;
  time?: string | null;
  revenue?: number | null;
  revenueEstimated?: number | null;
  fiscalDateEnding?: string | null;
}

export interface RefreshResult {
  ok: boolean;
  upserted: number;
  windowFrom: string;
  windowTo: string;
  reason?: string;
}

function fmpKey(): string | null {
  return process.env.FMP_API_KEY ?? null;
}

function isoDateOffset(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function normalizeReportTime(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const v = raw.trim().toLowerCase();
  if (v === "bmo") return "BMO";
  if (v === "amc") return "AMC";
  if (v === "tbd" || v === "") return "TBD";
  // FMP sometimes returns ISO timestamps; pass through if HH:MM-shaped.
  if (/^\d{2}:\d{2}/.test(v)) return v;
  return "TBD";
}

export async function refreshMegacapEarnings(opts?: {
  daysAhead?: number;
}): Promise<RefreshResult> {
  const daysAhead = opts?.daysAhead ?? 90;
  const from = isoDateOffset(0);
  const to = isoDateOffset(daysAhead);

  const key = fmpKey();
  if (!key) {
    log.warn("FMP_API_KEY missing — skipping refresh, hardcoded fallback only");
    return {
      ok: false,
      upserted: 0,
      windowFrom: from,
      windowTo: to,
      reason: "missing_fmp_api_key",
    };
  }

  const url = `${FMP_BASE}/earning_calendar?from=${from}&to=${to}&apikey=${encodeURIComponent(key)}`;
  let rows: FmpCalendarRow[] = [];
  try {
    const res = await fetch(url);
    if (!res.ok) {
      log.warn("FMP earnings calendar request failed", { status: res.status });
      return {
        ok: false,
        upserted: 0,
        windowFrom: from,
        windowTo: to,
        reason: `fmp_http_${res.status}`,
      };
    }
    rows = (await res.json()) as FmpCalendarRow[];
  } catch (err) {
    log.warn("FMP fetch threw", {
      error: err instanceof Error ? err.message : String(err),
    });
    return {
      ok: false,
      upserted: 0,
      windowFrom: from,
      windowTo: to,
      reason: "fmp_fetch_threw",
    };
  }

  const filtered = rows.filter((r) => MEGACAP_TICKER_SET.has(r.symbol));
  if (filtered.length === 0) {
    return { ok: true, upserted: 0, windowFrom: from, windowTo: to };
  }

  const sb = getSupabaseClient();
  if (!sb) {
    return {
      ok: false,
      upserted: 0,
      windowFrom: from,
      windowTo: to,
      reason: "supabase_unavailable",
    };
  }

  // [S40-P8] Pull market_cap_usd alongside the calendar so the eligibility
  // join + Time-To-Print widget can show "$3.4T market cap" without a second
  // round-trip per row. FMP /v3/profile/<symbols> handles batched lookup.
  const profileMap = await fetchMarketCaps(filtered.map((r) => r.symbol), key);

  const upserts = filtered.map((r) => ({
    symbol: r.symbol,
    report_date: r.date,
    report_time: normalizeReportTime(r.time),
    fiscal_quarter: r.fiscalDateEnding ?? null,
    forecast_eps: r.epsEstimated ?? null,
    market_cap_usd: profileMap.get(r.symbol) ?? null,
    in_ndx: true,
    in_spx: true,
    updated_at: new Date().toISOString(),
  }));

  const { error, count } = await sb
    .from("earnings_events")
    .upsert(upserts, { onConflict: "symbol,report_date", count: "exact" });

  if (error) {
    log.warn("earnings_events upsert failed", { error: error.message });
    return {
      ok: false,
      upserted: 0,
      windowFrom: from,
      windowTo: to,
      reason: `upsert_error:${error.message}`,
    };
  }

  log.info("Refreshed megacap earnings", {
    upserted: count ?? upserts.length,
    windowFrom: from,
    windowTo: to,
  });
  return {
    ok: true,
    upserted: count ?? upserts.length,
    windowFrom: from,
    windowTo: to,
  };
}

interface FmpProfileRow {
  symbol: string;
  mktCap?: number | null;
}

async function fetchMarketCaps(
  symbols: string[],
  key: string,
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (symbols.length === 0) return map;
  const unique = Array.from(new Set(symbols));
  const url = `${FMP_BASE}/profile/${encodeURIComponent(unique.join(","))}?apikey=${encodeURIComponent(key)}`;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      log.warn("FMP profile request failed", { status: res.status });
      return map;
    }
    const rows = (await res.json()) as FmpProfileRow[];
    for (const r of rows) {
      if (r.mktCap != null && Number.isFinite(r.mktCap)) {
        map.set(r.symbol, Math.round(r.mktCap));
      }
    }
  } catch (err) {
    log.warn("FMP profile fetch threw", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
  return map;
}

// Post-print beat/miss enrichment. Polled at T+5min after report_time —
// fetches actual EPS from FMP /v3/historical/earning_calendar/<symbol>.
export async function enrichEarningsActual(
  symbol: string,
  reportDate: string,
): Promise<{ ok: boolean; reason?: string }> {
  const key = fmpKey();
  if (!key) return { ok: false, reason: "missing_fmp_api_key" };

  const url = `${FMP_BASE}/historical/earning_calendar/${encodeURIComponent(symbol)}?limit=12&apikey=${encodeURIComponent(key)}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return { ok: false, reason: `fmp_http_${res.status}` };
    const rows = (await res.json()) as FmpHistoricalRow[];
    const match = rows.find((r) => r.date === reportDate);
    if (!match || match.eps == null || match.epsEstimated == null) {
      return { ok: false, reason: "actual_unavailable" };
    }

    const surprisePct =
      ((match.eps - match.epsEstimated) /
        Math.abs(match.epsEstimated || 1)) *
      100;
    const beatMiss =
      Math.abs(surprisePct) < 0.1
        ? "inline"
        : surprisePct > 0
          ? "beat"
          : "miss";

    const sb = getSupabaseClient();
    if (!sb) return { ok: false, reason: "supabase_unavailable" };

    const { error } = await sb
      .from("earnings_events")
      .update({
        actual_eps: match.eps,
        forecast_eps: match.epsEstimated,
        beat_miss: beatMiss,
        surprise_percent: surprisePct,
        updated_at: new Date().toISOString(),
      })
      .eq("symbol", symbol)
      .eq("report_date", reportDate);

    if (error) return { ok: false, reason: `update_error:${error.message}` };
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : String(err),
    };
  }
}

// Hardcoded fallback for when FMP is unavailable. Used by Pillar 6 widget so
// the eligibility list never fully empties. Updated quarterly per memory.
// Empty by default — TP can override via FMP or hand-edit this list during
// outage windows; not throwing here lets the UI render the "no upcoming" state
// gracefully.
export const HARDCODED_NEXT_EARNINGS: ReadonlyArray<{
  symbol: string;
  report_date: string;
  report_time: string;
}> = [];

export { MEGACAP_TICKERS };
