// [claude-code 2026-03-23] Yahoo Finance market data client — replaces FMP
// [claude-code 2026-03-14] Original implementation
// No API key needed. Uses Yahoo Finance v8 chart API.
import type { StockQuote, VixData } from "./types.js";

const YAHOO_BASE = "https://query1.finance.yahoo.com/v8/finance/chart";
const HEADERS = { "User-Agent": "Mozilla/5.0" };

async function yahooFetch(symbol: string): Promise<any> {
  // Yahoo blocked 1m interval — 2m still works, meta.regularMarketPrice is real-time
  const url = `${YAHOO_BASE}/${encodeURIComponent(symbol)}?range=1d&interval=2m`;
  const res = await fetch(url, {
    signal: AbortSignal.timeout(5000),
    headers: HEADERS,
  });
  if (!res.ok) throw new Error(`Yahoo HTTP ${res.status}`);
  const json = await res.json();
  const result = json?.chart?.result?.[0];
  if (!result) throw new Error(`No Yahoo data for ${symbol}`);
  return result;
}

export async function getQuote(symbol: string): Promise<StockQuote> {
  const result = await yahooFetch(symbol);
  const meta = result.meta;
  const price = meta?.regularMarketPrice ?? 0;
  const prevClose = meta?.chartPreviousClose ?? meta?.previousClose ?? price;
  const change = price - prevClose;
  const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;

  return {
    symbol: meta?.symbol ?? symbol,
    price,
    change: Number(change.toFixed(2)),
    changePercent: Number(changePercent.toFixed(2)),
    volume: meta?.regularMarketVolume ?? 0,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Fetch intraday bars for a symbol (used by autoresearch price-resolver).
 * Returns array of { timestamp, close } sorted by time ascending.
 */
export async function getIntradayBars(
  symbol: string,
  range: string = "1d",
  interval: string = "2m",
): Promise<Array<{ timestamp: number; close: number }>> {
  const url = `${YAHOO_BASE}/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}`;
  const res = await fetch(url, {
    signal: AbortSignal.timeout(5000),
    headers: HEADERS,
  });
  if (!res.ok) throw new Error(`Yahoo HTTP ${res.status}`);
  const json = await res.json();
  const result = json?.chart?.result?.[0];
  if (!result) throw new Error(`No Yahoo data for ${symbol}`);

  const timestamps: number[] = result.timestamp ?? [];
  const closes: number[] = result.indicators?.quote?.[0]?.close ?? [];

  const bars: Array<{ timestamp: number; close: number }> = [];
  for (let i = 0; i < timestamps.length; i++) {
    if (closes[i] != null) {
      bars.push({ timestamp: timestamps[i] * 1000, close: closes[i] });
    }
  }
  return bars;
}

/**
 * Get the price nearest to a specific timestamp using intraday bars.
 * Returns null if no bars are available.
 */
export async function getPriceNear(
  symbol: string,
  targetTime: Date,
): Promise<number | null> {
  try {
    const bars = await getIntradayBars(symbol, "5d", "5m");
    if (bars.length === 0) return null;

    const targetMs = targetTime.getTime();
    let closest = bars[0];
    let closestDiff = Math.abs(bars[0].timestamp - targetMs);

    for (const bar of bars) {
      const diff = Math.abs(bar.timestamp - targetMs);
      if (diff < closestDiff) {
        closest = bar;
        closestDiff = diff;
      }
    }

    return closest.close;
  } catch {
    return null;
  }
}

export async function getVix(): Promise<VixData> {
  const result = await yahooFetch("^VIX");
  const meta = result.meta;
  const value = meta?.regularMarketPrice;
  if (value == null) throw new Error("VIX quote missing price");

  const prevClose = meta?.chartPreviousClose ?? meta?.previousClose ?? value;
  const change = value - prevClose;
  const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;

  return {
    value,
    change: Number(change.toFixed(2)),
    changePercent: Number(changePercent.toFixed(2)),
    high: meta?.regularMarketDayHigh ?? value,
    low: meta?.regularMarketDayLow ?? value,
    previousClose: prevClose,
    timestamp: new Date().toISOString(),
    stale: false,
  };
}
