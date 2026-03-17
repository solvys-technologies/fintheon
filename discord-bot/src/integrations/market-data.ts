import { logger } from '../utils/logger';
import { config } from '../config';

export interface MarketSnapshot {
  vix: number;
  vixChange: number;
  nqLevel: number;
  nqImpliedMove: number;
  riskAssessment: 'LOW' | 'ELEVATED' | 'HIGH' | 'EXTREME';
  timestamp: Date;
}

let lastSnapshot: MarketSnapshot | null = null;

/**
 * Fetch current market data snapshot.
 * Uses Yahoo Finance v8 API (no key required) for VIX and NQ futures.
 */
export async function fetchMarketSnapshot(): Promise<MarketSnapshot | null> {
  try {
    const [vixData, nqData] = await Promise.all([
      fetchQuote('^VIX'),
      fetchQuote('NQ=F'),
    ]);

    if (!vixData || !nqData) return lastSnapshot;

    const vixChange = lastSnapshot
      ? ((vixData.price - lastSnapshot.vix) / lastSnapshot.vix) * 100
      : 0;

    const nqImpliedMove = lastSnapshot
      ? Math.abs(nqData.price - lastSnapshot.nqLevel)
      : 0;

    const snapshot: MarketSnapshot = {
      vix: vixData.price,
      vixChange,
      nqLevel: nqData.price,
      nqImpliedMove,
      riskAssessment: assessRisk(vixData.price, vixChange, nqImpliedMove),
      timestamp: new Date(),
    };

    lastSnapshot = snapshot;
    return snapshot;
  } catch (error) {
    logger.error('Failed to fetch market data', { error });
    return lastSnapshot;
  }
}

/** Check if we're in US market hours (9:30 AM - 4:00 PM ET, weekdays) */
export function isMarketHours(): boolean {
  const now = new Date();
  const et = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const day = et.getDay();
  const hours = et.getHours();
  const minutes = et.getMinutes();
  const timeMinutes = hours * 60 + minutes;

  // Weekdays only (Mon=1 through Fri=5)
  if (day === 0 || day === 6) return false;

  // 9:30 AM (570 min) to 4:00 PM (960 min) ET
  return timeMinutes >= 570 && timeMinutes <= 960;
}

/** Check if current snapshot warrants an alert */
export function shouldAlert(snapshot: MarketSnapshot): boolean {
  const vixSpike = Math.abs(snapshot.vixChange) >= config.market.volatilityAlertThreshold;
  const nqMove = snapshot.nqImpliedMove >= config.market.nqPointThreshold;
  return vixSpike || nqMove;
}

function assessRisk(vix: number, vixChange: number, nqMove: number): MarketSnapshot['riskAssessment'] {
  if (vix > 30 || Math.abs(vixChange) > 5 || nqMove > 200) return 'EXTREME';
  if (vix > 25 || Math.abs(vixChange) > 3 || nqMove > 150) return 'HIGH';
  if (vix > 20 || Math.abs(vixChange) > 1.5 || nqMove > 75) return 'ELEVATED';
  return 'LOW';
}

async function fetchQuote(symbol: string): Promise<{ price: number } | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1m&range=1d`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Harper-Perp/1.0' },
    });

    if (!res.ok) {
      logger.warn(`Yahoo Finance returned ${res.status} for ${symbol}`);
      return null;
    }

    const data: any = await res.json();
    const meta = data?.chart?.result?.[0]?.meta;
    if (!meta?.regularMarketPrice) return null;

    return { price: meta.regularMarketPrice };
  } catch (error) {
    logger.warn(`Failed to fetch quote for ${symbol}`, { error });
    return null;
  }
}
