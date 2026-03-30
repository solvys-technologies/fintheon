// [claude-code 2026-03-28] Yahoo Finance daily close fetcher for market impact enrichment

import { createLogger } from '../../lib/logger.js';

const log = createLogger('DailyClose');

const YAHOO_BASE = 'https://query1.finance.yahoo.com/v8/finance/chart';
const HEADERS = { 'User-Agent': 'Mozilla/5.0' };

const FUTURES_SYMBOLS = ['NQ=F', 'ES=F', 'YM=F'] as const;
type FuturesKey = 'nq' | 'es' | 'ym';
const SYMBOL_KEY_MAP: Record<string, FuturesKey> = {
  'NQ=F': 'nq',
  'ES=F': 'es',
  'YM=F': 'ym',
};

export interface DailyClose {
  symbol: string;
  date: string;
  close: number;
  prevClose: number;
  change: number;
  changePercent: number;
}

export type DailyCloseResult = Record<FuturesKey, DailyClose | null>;

/**
 * Fetch daily close data for NQ, ES, YM futures on a specific date.
 * Uses Yahoo Finance chart API with 1d interval.
 * Returns null per symbol if no data for that date (weekend/holiday).
 */
export async function fetchDailyClose(date: string): Promise<DailyCloseResult> {
  const result: DailyCloseResult = { nq: null, es: null, ym: null };

  // Convert date to unix timestamps (start of day → end of day)
  const startOfDay = Math.floor(new Date(`${date}T00:00:00Z`).getTime() / 1000);
  const endOfDay = startOfDay + 86400;

  for (const symbol of FUTURES_SYMBOLS) {
    try {
      const url = `${YAHOO_BASE}/${encodeURIComponent(symbol)}?period1=${startOfDay}&period2=${endOfDay}&interval=1d`;
      const res = await fetch(url, {
        signal: AbortSignal.timeout(8000),
        headers: HEADERS,
      });

      if (!res.ok) {
        log.warn(`Yahoo HTTP ${res.status} for ${symbol}`, { date });
        continue;
      }

      const json = await res.json();
      const chartResult = json?.chart?.result?.[0];
      if (!chartResult) {
        log.warn(`No chart data for ${symbol}`, { date });
        continue;
      }

      const closes: number[] = chartResult.indicators?.quote?.[0]?.close ?? [];
      const meta = chartResult.meta;

      if (closes.length === 0 || closes[0] == null) {
        // No trading data for this date (weekend/holiday)
        continue;
      }

      const close = closes[0];
      const prevClose = meta?.chartPreviousClose ?? meta?.previousClose ?? close;
      const change = close - prevClose;
      const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;

      const key = SYMBOL_KEY_MAP[symbol];
      result[key] = {
        symbol,
        date,
        close: Number(close.toFixed(2)),
        prevClose: Number(prevClose.toFixed(2)),
        change: Number(change.toFixed(2)),
        changePercent: Number(changePercent.toFixed(2)),
      };

      // Rate limiting: 1 request per second
      await new Promise((r) => setTimeout(r, 1000));
    } catch (err) {
      log.error(`Failed to fetch ${symbol}`, { date, error: String(err) });
    }
  }

  return result;
}
