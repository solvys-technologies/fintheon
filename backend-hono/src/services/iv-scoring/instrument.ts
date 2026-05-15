// [claude-code 2026-05-15] S66-T1: added /ZT, /BTC, /ETH, /6A, /6C, /6S instruments.
//   Expanded refreshPricesFromTV() defaults to include new additions.
// [claude-code 2026-05-13] S64-T1: removed hardcoded currentPrice from INSTRUMENT_BETAS;
//   replaced with fallbackPrice + live price cache refreshed via refreshPricesFromTV().
//   The TV scanner fetcher in tv-bars-fetcher provides real-time quotes; when
//   unreachable, the documented fallback values are used as static defaults.
// [claude-code 2026-04-16] S20-T9: Split from iv-scoring-v2.ts — instrument betas, implied points

import { fetchTvQuotes } from "../day-plan/tv-bars-fetcher.js";
import { createLogger } from "../../lib/logger.js";

const log = createLogger("Instrument");

// ============================================================================
// INSTRUMENT BETA TABLE
// Beta = correlation to SPX volatility (1.0 = moves with SPX, <1 = less volatile)
//
// fallbackPrice: documented static default used when the TV scanner is
//   unreachable. These are approximate mid-range values, not live quotes.
//   Live prices are fetched via refreshPricesFromTV() and cached.
// ============================================================================

interface InstrumentBetaEntry {
  beta: number;
  tickValue: number;
  tickSize: number;
  /** Static fallback when TV scanner is unavailable. */
  fallbackPrice: number;
  notes: string;
}

export const INSTRUMENT_BETAS: Record<string, InstrumentBetaEntry> = {
  // Equity Index Futures
  "/ES": {
    beta: 1.0,
    tickValue: 12.5,
    tickSize: 0.25,
    fallbackPrice: 6000,
    notes: "E-mini S&P 500 - Base reference",
  },
  "/MES": {
    beta: 1.0,
    tickValue: 1.25,
    tickSize: 0.25,
    fallbackPrice: 6000,
    notes: "Micro E-mini S&P 500",
  },
  "/NQ": {
    beta: 1.2,
    tickValue: 5.0,
    tickSize: 0.25,
    fallbackPrice: 21000,
    notes: "E-mini Nasdaq 100 - Tech-heavy",
  },
  "/MNQ": {
    beta: 1.2,
    tickValue: 0.5,
    tickSize: 0.25,
    fallbackPrice: 21000,
    notes: "Micro E-mini Nasdaq 100",
  },
  "/YM": {
    beta: 0.95,
    tickValue: 5.0,
    tickSize: 1.0,
    fallbackPrice: 44000,
    notes: "E-mini Dow Jones - Industrials",
  },
  "/MYM": {
    beta: 0.95,
    tickValue: 0.5,
    tickSize: 1.0,
    fallbackPrice: 44000,
    notes: "Micro E-mini Dow Jones",
  },
  "/RTY": {
    beta: 1.1,
    tickValue: 5.0,
    tickSize: 0.1,
    fallbackPrice: 2200,
    notes: "E-mini Russell 2000 - Small caps",
  },
  "/M2K": {
    beta: 1.1,
    tickValue: 0.5,
    tickSize: 0.1,
    fallbackPrice: 2200,
    notes: "Micro E-mini Russell 2000",
  },

  // Commodities
  "/CL": {
    beta: 0.6,
    tickValue: 10.0,
    tickSize: 0.01,
    fallbackPrice: 75,
    notes: "Crude Oil - Energy sector proxy",
  },
  "/MCL": {
    beta: 0.6,
    tickValue: 1.0,
    tickSize: 0.01,
    fallbackPrice: 75,
    notes: "Micro Crude Oil",
  },
  "/GC": {
    beta: 0.2,
    tickValue: 10.0,
    tickSize: 0.1,
    fallbackPrice: 2650,
    notes: "Gold - Safe-haven, inverse correlation",
  },
  "/MGC": {
    beta: 0.2,
    tickValue: 1.0,
    tickSize: 0.1,
    fallbackPrice: 2650,
    notes: "Micro Gold",
  },
  "/SI": {
    beta: 0.4,
    tickValue: 25.0,
    tickSize: 0.005,
    fallbackPrice: 30,
    notes: "Silver - Industrial/vol proxy",
  },
  "/SIL": {
    beta: 0.4,
    tickValue: 2.5,
    tickSize: 0.005,
    fallbackPrice: 30,
    notes: "Micro Silver",
  },
  "/NG": {
    beta: 0.5,
    tickValue: 10.0,
    tickSize: 0.001,
    fallbackPrice: 3.5,
    notes: "Natural Gas - High volatility",
  },

  // Currencies (low SPX correlation)
  "/6E": {
    beta: 0.3,
    tickValue: 12.5,
    tickSize: 0.00005,
    fallbackPrice: 1.08,
    notes: "Euro FX",
  },
  "/6J": {
    beta: 0.25,
    tickValue: 12.5,
    tickSize: 0.0000005,
    fallbackPrice: 0.0067,
    notes: "Japanese Yen",
  },
  "/6B": {
    beta: 0.35,
    tickValue: 6.25,
    tickSize: 0.0001,
    fallbackPrice: 1.27,
    notes: "British Pound",
  },

  // Bonds (inverse correlation during risk-off)
  "/ZB": {
    beta: -0.3,
    tickValue: 31.25,
    tickSize: 0.03125,
    fallbackPrice: 118,
    notes: "30-Year Treasury Bond",
  },
  "/ZN": {
    beta: -0.25,
    tickValue: 15.625,
    tickSize: 0.015625,
    fallbackPrice: 110,
    notes: "10-Year Treasury Note",
  },

  // Short-term Bonds
  "/ZT": {
    beta: -0.2,
    tickValue: 7.8125,
    tickSize: 0.0078125,
    fallbackPrice: 108,
    notes: "2-Year Treasury Note",
  },

  // Crypto Futures
  "/BTC": {
    beta: 0.15,
    tickValue: 5.0,
    tickSize: 5.0,
    fallbackPrice: 95000,
    notes: "BTC Futures — low SPX correlation",
  },
  "/ETH": {
    beta: 0.18,
    tickValue: 0.5,
    tickSize: 0.25,
    fallbackPrice: 3500,
    notes: "ETH Futures — low SPX correlation",
  },

  // Additional Currencies
  "/6A": {
    beta: 0.2,
    tickValue: 10.0,
    tickSize: 0.0001,
    fallbackPrice: 0.67,
    notes: "Australian Dollar",
  },
  "/6C": {
    beta: 0.25,
    tickValue: 10.0,
    tickSize: 0.00005,
    fallbackPrice: 0.74,
    notes: "Canadian Dollar",
  },
  "/6S": {
    beta: 0.15,
    tickValue: 12.5,
    tickSize: 0.00005,
    fallbackPrice: 1.1,
    notes: "Swiss Franc",
  },
};

// ── TV Live Price Cache ─────────────────────────────────────────────────────

/** Module-level cache of live prices from the TV scanner. */
const livePriceCache = new Map<string, number>();

/**
 * Refresh live prices from the TradingView scanner for the given instruments.
 * Falls back to fallbackPrice when the scanner is unreachable. Cache is
 * overwritten on each successful call — no TTL beyond the caller's refresh
 * cadence.
 */
export async function refreshPricesFromTV(
  instruments?: string[],
): Promise<Map<string, number>> {
  const targets = instruments ?? [
    "/ES",
    "/NQ",
    "/YM",
    "/RTY",
    "/CL",
    "/GC",
    "/SI",
    "/NG",
    "/6E",
    "/6J",
    "/6B",
    "/ZN",
    "/ZT",
    "/BTC",
    "/ETH",
    "/6A",
    "/6C",
    "/6S",
  ];

  try {
    const quotes = await fetchTvQuotes(targets);
    let updatedCount = 0;
    for (const q of quotes) {
      if (Number.isFinite(q.close) && q.close > 0) {
        livePriceCache.set(q.symbol, q.close);
        updatedCount++;
      }
    }
    if (updatedCount > 0) {
      log.info("TV prices refreshed", {
        requested: targets.length,
        updated: updatedCount,
      });
    }
  } catch (err) {
    log.warn("refreshPricesFromTV failed — keeping previous cache", {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return livePriceCache;
}

/**
 * Get the best available price for an instrument: live TV quote > fallback.
 */
export function getLivePrice(instrument: string, requestHint?: number): number {
  const cached = livePriceCache.get(instrument);
  if (cached != null && Number.isFinite(cached) && cached > 0) return cached;

  // Caller may supply a spot price (e.g. from bars) as a dynamic hint
  if (requestHint != null && Number.isFinite(requestHint) && requestHint > 0) {
    return requestHint;
  }

  const config = INSTRUMENT_BETAS[instrument];
  return config?.fallbackPrice ?? 6000;
}

// ============================================================================
// IMPLIED POINTS CALCULATION (Rule of 16)
// Formula: Daily Expected Move = Price × (VIX / 16) / 100 × Beta
// ============================================================================

export interface ImpliedPoints {
  impliedPct: number;
  basePoints: number;
  adjustedPoints: number;
  adjustedTicks: number;
  tickValue: number;
  dollarRisk: number;
  instrument: string;
  beta: number;
}

export function calculateImpliedPoints(
  vixLevel: number,
  currentPrice: number | undefined,
  instrument: string,
): ImpliedPoints {
  const instrumentConfig = INSTRUMENT_BETAS[instrument] ?? {
    beta: 1.0,
    tickValue: 1.0,
    tickSize: 0.25,
    fallbackPrice: 6000,
    notes: "Unknown instrument - using /ES defaults",
  };

  const price = currentPrice ?? getLivePrice(instrument);

  const impliedPct = vixLevel / 16;
  const basePoints = price * (impliedPct / 100);
  const adjustedPoints = basePoints * Math.abs(instrumentConfig.beta);
  const adjustedTicks = adjustedPoints / instrumentConfig.tickSize;
  const dollarRisk = adjustedTicks * instrumentConfig.tickValue;

  return {
    impliedPct: Number(impliedPct.toFixed(2)),
    basePoints: Number(basePoints.toFixed(1)),
    adjustedPoints: Number(adjustedPoints.toFixed(1)),
    adjustedTicks: Math.round(adjustedTicks),
    tickValue: instrumentConfig.tickValue,
    dollarRisk: Number(dollarRisk.toFixed(2)),
    instrument,
    beta: instrumentConfig.beta,
  };
}

export function getInstrumentConfig(instrument: string) {
  const entry = INSTRUMENT_BETAS[instrument];
  if (!entry) return null;
  const livePrice = getLivePrice(instrument);
  return {
    ...entry,
    currentPrice: livePrice,
  };
}

export function getSupportedInstruments(): string[] {
  return Object.keys(INSTRUMENT_BETAS);
}
