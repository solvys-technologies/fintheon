// [claude-code 2026-05-15] S66-T1: expanded SYMBOL_MAP for /ZT, /BTC, /ETH, /6A, /6C, /6S.
//   fetchTvQuotes now groups by market segment so crypto symbols use "crypto" market.
// [claude-code 2026-05-13] S64-T1: replaced Yahoo Finance UDF with TradingView
// scanner quotes() for live OHLCV snapshots + TV UDF history endpoint for bar
// data. The scanner gives us live close/open/high/low as a QuoteRow; the UDF
// history endpoint gives us the 5-minute bar series needed for VWAP/POC math.

import { quotes, rawScan } from "../tradingview/scanner.js";
import type { ScannerMarket } from "../tradingview/scanner.js";
import { createLogger } from "../../lib/logger.js";
import type { OHLCVBar } from "./vwap-poc-math.js";

const log = createLogger("TvBarsFetcher");

// ── TradingView UDF History endpoint ────────────────────────────────────────
// The same backend the TV chart widget uses. No auth, no quota documented.
const UDF_HISTORY_BASE = "https://tv-gw.dukascopy.com/tradingview/history";
const UDF_TIMEOUT_MS = 10_000;

// ── Symbol mapping ──────────────────────────────────────────────────────────

interface TvSymbolInfo {
  /** TV scanner symbol for quotes(). */
  scanSymbol: string;
  /** TV scanner market segment. */
  market: ScannerMarket;
  /** TV UDF history symbol (exchange:contract). */
  udfSymbol: string;
}

const SYMBOL_MAP: Record<string, TvSymbolInfo> = {
  "/NQ": {
    scanSymbol: "CME_MINI:NQ1!",
    market: "futures",
    udfSymbol: "NQ1!",
  },
  "/ES": {
    scanSymbol: "CME_MINI:ES1!",
    market: "futures",
    udfSymbol: "ES1!",
  },
  "/YM": {
    scanSymbol: "CBOT_MINI:YM1!",
    market: "futures",
    udfSymbol: "YM1!",
  },
  "/RTY": {
    scanSymbol: "CME_MINI:RTY1!",
    market: "futures",
    udfSymbol: "RTY1!",
  },
  "/CL": {
    scanSymbol: "NYMEX:CL1!",
    market: "futures",
    udfSymbol: "CL1!",
  },
  "/GC": {
    scanSymbol: "COMEX:GC1!",
    market: "futures",
    udfSymbol: "GC1!",
  },
  "/SI": {
    scanSymbol: "COMEX:SI1!",
    market: "futures",
    udfSymbol: "SI1!",
  },
  "/NG": {
    scanSymbol: "NYMEX:NG1!",
    market: "futures",
    udfSymbol: "NG1!",
  },
  "/6E": {
    scanSymbol: "CME:6E1!",
    market: "futures",
    udfSymbol: "6E1!",
  },
  "/6J": {
    scanSymbol: "CME:6J1!",
    market: "futures",
    udfSymbol: "6J1!",
  },
  "/6B": {
    scanSymbol: "CME:6B1!",
    market: "futures",
    udfSymbol: "6B1!",
  },
  "/ZB": {
    scanSymbol: "CBOT:ZB1!",
    market: "futures",
    udfSymbol: "ZB1!",
  },
  "/ZN": {
    scanSymbol: "CBOT:ZN1!",
    market: "futures",
    udfSymbol: "ZN1!",
  },
  "/ZT": {
    scanSymbol: "CBOT:ZT1!",
    market: "futures",
    udfSymbol: "ZT1!",
  },
  "/BTC": {
    scanSymbol: "COINBASE:BTCUSD",
    market: "crypto",
    udfSymbol: "COINBASE:BTCUSD",
  },
  "/ETH": {
    scanSymbol: "COINBASE:ETHUSD",
    market: "crypto",
    udfSymbol: "COINBASE:ETHUSD",
  },
  "/6A": {
    scanSymbol: "CME:6A1!",
    market: "futures",
    udfSymbol: "6A1!",
  },
  "/6C": {
    scanSymbol: "CME:6C1!",
    market: "futures",
    udfSymbol: "6C1!",
  },
  "/6S": {
    scanSymbol: "CME:6S1!",
    market: "futures",
    udfSymbol: "6S1!",
  },
};

// ── Public types ────────────────────────────────────────────────────────────

export interface InstrumentBars {
  symbol: string;
  bars: OHLCVBar[];
  source: "tv-udf" | "tv-quote" | "empty";
}

export interface TvQuoteSnapshot {
  symbol: string;
  close: number;
  open: number;
  high: number;
  low: number;
  volume: number;
}

// ── Main fetcher ────────────────────────────────────────────────────────────

/**
 * Pull OHLCV bars for the given instruments from the TradingView UDF history
 * endpoint. Defaults to /NQ /ES /YM in a single parallel call.
 */
export async function fetchInstrumentBars(
  instruments: string[] = ["/NQ", "/ES", "/YM"],
  options: { range?: string; interval?: string } = {},
): Promise<InstrumentBars[]> {
  const range = options.range ?? "1d";
  const interval = options.interval ?? "5m";

  const results: InstrumentBars[] = [];

  for (const instrument of instruments) {
    const info = SYMBOL_MAP[instrument.toUpperCase()];
    if (!info) {
      log.warn("No TV symbol mapping for", { instrument });
      results.push({ symbol: instrument, bars: [], source: "empty" });
      continue;
    }

    try {
      const bars = await fetchUdfHistory(info.udfSymbol, range, interval);
      results.push({
        symbol: instrument,
        bars,
        source: bars.length > 0 ? "tv-udf" : "empty",
      });
    } catch (err) {
      log.warn("TV UDF fetch failed — falling back to scanner quote snapshot", {
        instrument,
        udfSymbol: info.udfSymbol,
        error: err instanceof Error ? err.message : String(err),
      });
      // Fallback: use quotes() for a single snapshot bar
      try {
        const bars = await fetchQuoteAsBar(info);
        results.push({
          symbol: instrument,
          bars,
          source: bars.length > 0 ? "tv-quote" : "empty",
        });
      } catch (fallbackErr) {
        log.warn("TV quote snapshot fallback also failed", {
          instrument,
          error:
            fallbackErr instanceof Error
              ? fallbackErr.message
              : String(fallbackErr),
        });
        results.push({ symbol: instrument, bars: [], source: "empty" });
      }
    }
  }

  return results;
}

/**
 * Fetch just the live snapshot quotes (one row per symbol, latest price).
 * Useful for instrument.ts currentPrice refresh.
 */
export async function fetchTvQuotes(
  instruments: string[] = ["/NQ", "/ES", "/YM"],
): Promise<TvQuoteSnapshot[]> {
  const byMarket = new Map<
    ScannerMarket,
    { scanSymbol: string; inst: string }[]
  >();
  for (const inst of instruments) {
    const info = SYMBOL_MAP[inst.toUpperCase()];
    if (info) {
      const group = byMarket.get(info.market) ?? [];
      group.push({ scanSymbol: info.scanSymbol, inst });
      byMarket.set(info.market, group);
    }
  }
  if (byMarket.size === 0) return [];

  const results: TvQuoteSnapshot[] = [];

  for (const [market, symbols] of byMarket) {
    try {
      const scanSymbols = symbols.map((s) => s.scanSymbol);
      const rows = await quotes(scanSymbols, market);
      const lookup = new Map(
        symbols.map((s) => [s.scanSymbol, s.inst] as const),
      );
      for (const r of rows) {
        const inst = lookup.get(r.symbol) ?? r.symbol;
        results.push({
          symbol: inst,
          close: r.close,
          open: r.open,
          high: r.high,
          low: r.low,
          volume: r.volume,
        });
      }
    } catch (err) {
      log.warn("fetchTvQuotes failed for market segment", {
        market,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return results;
}

// ── Internals ───────────────────────────────────────────────────────────────

interface UdfResponse {
  s: "ok" | "no_data" | "error";
  t: number[];
  o: number[];
  h: number[];
  l: number[];
  c: number[];
  v: number[];
  nextTime?: number;
}

async function fetchUdfHistory(
  symbol: string,
  range: string,
  interval: string,
): Promise<OHLCVBar[]> {
  const resolution = intervalToResolution(interval);
  const { from, to } = rangeToFromTo(range);

  const url = `${UDF_HISTORY_BASE}?symbol=${encodeURIComponent(symbol)}&resolution=${resolution}&from=${from}&to=${to}`;
  const res = await fetch(url, {
    signal: AbortSignal.timeout(UDF_TIMEOUT_MS),
    headers: {
      Accept: "application/json",
      Referer: "https://www.tradingview.com/",
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36",
    },
  });
  if (!res.ok) throw new Error(`TV UDF HTTP ${res.status}`);

  const json = (await res.json()) as UdfResponse;
  if (json.s === "error") throw new Error("TV UDF error status");
  if (json.s === "no_data" || !json.t?.length) return [];

  const bars: OHLCVBar[] = [];
  for (let i = 0; i < json.t.length; i++) {
    const open = json.o[i];
    const high = json.h[i];
    const low = json.l[i];
    const close = json.c[i];
    const volume = json.v[i];
    if (
      open == null ||
      high == null ||
      low == null ||
      close == null ||
      volume == null
    ) {
      continue;
    }
    bars.push({
      timestamp: json.t[i] * 1000,
      open,
      high,
      low,
      close,
      volume,
    });
  }
  return bars;
}

/** Fallback: fetch a single live "bar" from the scanner quotes endpoint. */
async function fetchQuoteAsBar(info: TvSymbolInfo): Promise<OHLCVBar[]> {
  // Use rawScan with non-equity columns to get a live row
  const cols = ["name", "close", "open", "high", "low", "volume"];
  const res = await rawScan(info.market, {
    columns: cols,
    symbols: { tickers: [info.scanSymbol] },
    range: [0, 1],
  });
  if (!res.data?.[0]) return [];

  const f = res.data[0].fields;
  const close = Number(f.close);
  const open = Number(f.open);
  const high = Number(f.high);
  const low = Number(f.low);
  const volume = Number(f.volume);

  if (
    !Number.isFinite(close) ||
    !Number.isFinite(open) ||
    !Number.isFinite(high) ||
    !Number.isFinite(low)
  ) {
    return [];
  }

  return [
    {
      timestamp: Date.now(),
      open,
      high,
      low,
      close,
      volume: Number.isFinite(volume) ? volume : 0,
    },
  ];
}

function intervalToResolution(interval: string): string {
  // "5m" → "5", "1d" → "1D", "1h" → "60"
  const match = interval.match(/^(\d+)([mhdw])$/);
  if (!match) return "5";
  const val = parseInt(match[1], 10);
  const unit = match[2];
  if (unit === "m") return String(val);
  if (unit === "h") return String(val * 60);
  if (unit === "d") return val <= 1 ? "1D" : `${val}D`;
  if (unit === "w") return "1W";
  return "5";
}

function rangeToFromTo(range: string): { from: number; to: number } {
  const now = Math.floor(Date.now() / 1000);
  let from = now - 86400; // default 1d
  if (range === "5d") from = now - 5 * 86400;
  else if (range === "1w") from = now - 7 * 86400;
  else if (range === "1m") from = now - 30 * 86400;
  else if (range === "1d") from = now - 86400;
  return { from, to: now };
}
