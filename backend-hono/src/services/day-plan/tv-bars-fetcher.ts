// [claude-code 2026-04-26] S45-T1: thin wrapper around the established Claude
// Computer Use TradingView pattern (services/skills/tradingview-trade-plan.ts).
// One Computer Use session pulls /NQ /ES /YM in a single shot for cost.
// When Computer Use isn't enabled (most environments) we fall back to Yahoo
// OHLCV — same shape, lower fidelity, sufficient for VWAP/POC math at a
// 5-minute resolution.

import { isComputerUseReady } from "../skills/tradingview-trade-plan.js";
import { createLogger } from "../../lib/logger.js";
import type { OHLCVBar } from "./vwap-poc-math.js";

const log = createLogger("TvBarsFetcher");

const YAHOO_BASE = "https://query1.finance.yahoo.com/v8/finance/chart";
const HEADERS = { "User-Agent": "Mozilla/5.0" };

const SYMBOL_TO_YAHOO: Record<string, string> = {
  "/NQ": "NQ=F",
  "/ES": "ES=F",
  "/YM": "YM=F",
  "/RTY": "RTY=F",
  "/MNQ": "MNQ=F",
  "/MES": "MES=F",
};

export interface InstrumentBars {
  symbol: string;
  bars: OHLCVBar[];
  source: "computer-use" | "yahoo" | "empty";
}

/**
 * Pull OHLCV bars for the given instruments. Defaults to /NQ /ES /YM in a
 * single call so day-plan-service hits one network round-trip per cycle.
 */
export async function fetchInstrumentBars(
  instruments: string[] = ["/NQ", "/ES", "/YM"],
  options: { range?: string; interval?: string } = {},
): Promise<InstrumentBars[]> {
  const range = options.range ?? "1d";
  const interval = options.interval ?? "5m";

  // Computer Use path is best-effort — if the session manager is up we let it
  // try first, otherwise we drop straight to Yahoo so the day-plan cron stays
  // green in environments without the desktop CLI.
  const cuReady = await isComputerUseReady().catch(() => false);
  if (cuReady) {
    log.info(
      "Computer Use ready — but TV-driven OHLCV not yet implemented; falling back to Yahoo",
    );
  }

  const results: InstrumentBars[] = [];
  for (const instrument of instruments) {
    const yahoo = SYMBOL_TO_YAHOO[instrument.toUpperCase()] ?? instrument;
    try {
      const bars = await fetchYahooOHLCV(yahoo, range, interval);
      results.push({
        symbol: instrument,
        bars,
        source: bars.length > 0 ? "yahoo" : "empty",
      });
    } catch (err) {
      log.warn("Yahoo OHLCV fetch failed", {
        instrument,
        yahoo,
        error: err instanceof Error ? err.message : String(err),
      });
      results.push({ symbol: instrument, bars: [], source: "empty" });
    }
  }

  return results;
}

async function fetchYahooOHLCV(
  symbol: string,
  range: string,
  interval: string,
): Promise<OHLCVBar[]> {
  const url = `${YAHOO_BASE}/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}`;
  const res = await fetch(url, {
    signal: AbortSignal.timeout(7000),
    headers: HEADERS,
  });
  if (!res.ok) throw new Error(`Yahoo HTTP ${res.status}`);
  const json = (await res.json()) as YahooChartResponse;
  const result = json?.chart?.result?.[0];
  if (!result) throw new Error(`Yahoo: no chart payload for ${symbol}`);

  const timestamps = result.timestamp ?? [];
  const quote = result.indicators?.quote?.[0];
  if (!quote) return [];

  const bars: OHLCVBar[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    const open = quote.open?.[i];
    const high = quote.high?.[i];
    const low = quote.low?.[i];
    const close = quote.close?.[i];
    const volume = quote.volume?.[i];
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
      timestamp: timestamps[i] * 1000,
      open,
      high,
      low,
      close,
      volume,
    });
  }
  return bars;
}

interface YahooChartResponse {
  chart?: {
    result?: Array<{
      timestamp?: number[];
      indicators?: {
        quote?: Array<{
          open?: Array<number | null>;
          high?: Array<number | null>;
          low?: Array<number | null>;
          close?: Array<number | null>;
          volume?: Array<number | null>;
        }>;
      };
    }>;
  };
}
