// [claude-code 2026-04-26] S45.5/F1: TradingView Calendar source. POSTs the
// public scanner endpoint with the 12 megacap tickers and pulls upcoming
// earnings dates + EPS forecast + market cap. No auth, no key, free per the
// "no new paid services" policy.

import { createLogger } from "../../../lib/logger.js";
import { MEGACAP_TICKERS } from "../megacap-tickers.js";

const log = createLogger("TradingViewCalendar");

const SCANNER_URL = "https://scanner.tradingview.com/america/scan";

export interface TVCalendarRow {
  symbol: string;
  /** ISO YYYY-MM-DD; the scanner returns a unix epoch in seconds. */
  report_date: string;
  /** May be null when TV hasn't tagged a session bucket yet. */
  report_time: string | null;
  forecast_eps: number | null;
  ttm_eps: number | null;
  market_cap_usd: number | null;
}

interface ScannerResponse {
  totalCount: number;
  data: Array<{
    s: string; // "NASDAQ:AAPL"
    d: Array<string | number | null>;
  }>;
}

const COLUMNS = [
  "name",
  "market_cap_basic",
  "earnings_release_next_date",
  "earnings_per_share_forecast_next_fq",
  "earnings_per_share_basic_ttm",
];

/**
 * Fetch upcoming earnings rows for the megacap watchlist from TradingView's
 * public scanner endpoint. Returns at most one row per ticker (the next
 * upcoming print). Empty array on any non-200 / parse-fail; never throws.
 */
export async function fetchTradingViewEarnings(): Promise<TVCalendarRow[]> {
  const tickers = MEGACAP_TICKERS.map((t) => `NASDAQ:${t}`);
  const body = {
    filter: [{ left: "name", operation: "in_range", right: MEGACAP_TICKERS }],
    options: { lang: "en" },
    markets: ["america"],
    symbols: { tickers, query: { types: [] } },
    columns: COLUMNS,
    sort: {
      sortBy: "earnings_release_next_date",
      sortOrder: "asc",
    },
    range: [0, MEGACAP_TICKERS.length],
  };

  let res: Response;
  try {
    res = await fetch(SCANNER_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8_000),
    });
  } catch (err) {
    log.warn("scanner fetch threw", {
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }

  if (!res.ok) {
    log.warn("scanner non-200", { status: res.status });
    return [];
  }

  let json: ScannerResponse;
  try {
    json = (await res.json()) as ScannerResponse;
  } catch (err) {
    log.warn("scanner parse failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }

  const rows: TVCalendarRow[] = [];
  for (const entry of json.data ?? []) {
    const symbol = (entry.d?.[0] as string | undefined) ?? null;
    if (!symbol) continue;
    const market_cap_usd = numeric(entry.d?.[1]);
    const epoch = numeric(entry.d?.[2]);
    if (epoch === null) continue;
    const report_date = new Date(epoch * 1_000).toISOString().slice(0, 10);
    rows.push({
      symbol,
      report_date,
      report_time: null,
      forecast_eps: numeric(entry.d?.[3]),
      ttm_eps: numeric(entry.d?.[4]),
      market_cap_usd,
    });
  }
  return rows;
}

function numeric(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}
