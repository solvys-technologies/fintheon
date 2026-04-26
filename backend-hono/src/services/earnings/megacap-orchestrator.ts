// [claude-code 2026-04-26] S45.5/F1: replaces the deleted megacap-fmp.ts.
// Calendar refresh now flows through the free-stack chain (TradingView →
// browser-harness → FinancialDatasets MCP). Public surface preserved:
// refreshMegacapEarnings, enrichEarningsActual, MEGACAP_TICKERS,
// HARDCODED_NEXT_EARNINGS — so cron + route handler imports flip with a
// single path swap.

import { getSupabaseClient } from "../../config/supabase.js";
import { createLogger } from "../../lib/logger.js";
import { MEGACAP_TICKERS, MEGACAP_TICKER_SET } from "./megacap-tickers.js";
import { runEarningsChain, type TVCalendarRow } from "./sources/index.js";

const log = createLogger("MegacapOrchestrator");

export interface RefreshResult {
  ok: boolean;
  upserted: number;
  windowFrom: string;
  windowTo: string;
  source: "tradingview" | "browser-harness" | "financial-datasets-mcp" | "none";
  reason?: string;
}

function isoDateOffset(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function refreshMegacapEarnings(opts?: {
  daysAhead?: number;
}): Promise<RefreshResult> {
  const daysAhead = opts?.daysAhead ?? 90;
  const from = isoDateOffset(0);
  const to = isoDateOffset(daysAhead);

  const { rows, source } = await runEarningsChain();

  const filtered = rows.filter(
    (r) =>
      MEGACAP_TICKER_SET.has(r.symbol) &&
      r.report_date >= from &&
      r.report_date <= to,
  );

  if (filtered.length === 0) {
    return {
      ok: source !== "none",
      upserted: 0,
      windowFrom: from,
      windowTo: to,
      source,
      reason: source === "none" ? "all_sources_empty" : undefined,
    };
  }

  const sb = getSupabaseClient();
  if (!sb) {
    return {
      ok: false,
      upserted: 0,
      windowFrom: from,
      windowTo: to,
      source,
      reason: "supabase_unavailable",
    };
  }

  const upserts = filtered.map((r: TVCalendarRow) => ({
    symbol: r.symbol,
    report_date: r.report_date,
    report_time: r.report_time ?? "TBD",
    forecast_eps: r.forecast_eps,
    market_cap_usd: r.market_cap_usd,
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
      source,
      reason: `upsert_error:${error.message}`,
    };
  }

  log.info("megacap earnings refreshed", {
    upserted: count ?? upserts.length,
    source,
    windowFrom: from,
    windowTo: to,
  });
  return {
    ok: true,
    upserted: count ?? upserts.length,
    windowFrom: from,
    windowTo: to,
    source,
  };
}

/**
 * Post-print actual EPS enrichment. Previously hit FMP /historical/earning_calendar;
 * the free stack doesn't expose actuals on demand, so this is a stub that returns
 * `actual_unavailable` until the FinancialDatasets MCP path is wired (which DOES
 * expose actuals) or until TP greenlights an alternative source. The cron that
 * calls this still runs and degrades gracefully — the megacap analyst dispatch
 * is gated on `result.ok` so nothing fires while we're stubbed.
 */
export async function enrichEarningsActual(
  _symbol: string,
  _reportDate: string,
): Promise<{ ok: boolean; reason?: string }> {
  return {
    ok: false,
    reason:
      "actual_enrichment_stubbed_until_fd_mcp_or_tp_greenlight_alternative",
  };
}

export const HARDCODED_NEXT_EARNINGS: ReadonlyArray<{
  symbol: string;
  report_date: string;
  report_time: string;
}> = [];

export { MEGACAP_TICKERS };
