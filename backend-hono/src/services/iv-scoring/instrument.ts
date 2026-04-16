// [claude-code 2026-04-16] S20-T9: Split from iv-scoring-v2.ts — instrument betas, implied points

// ============================================================================
// INSTRUMENT BETA TABLE
// Beta = correlation to SPX volatility (1.0 = moves with SPX, <1 = less volatile)
// ============================================================================

export const INSTRUMENT_BETAS: Record<
  string,
  {
    beta: number;
    tickValue: number;
    tickSize: number;
    currentPrice: number;
    notes: string;
  }
> = {
  // Equity Index Futures
  "/ES": {
    beta: 1.0,
    tickValue: 12.5,
    tickSize: 0.25,
    currentPrice: 6000,
    notes: "E-mini S&P 500 - Base reference",
  },
  "/MES": {
    beta: 1.0,
    tickValue: 1.25,
    tickSize: 0.25,
    currentPrice: 6000,
    notes: "Micro E-mini S&P 500",
  },
  "/NQ": {
    beta: 1.2,
    tickValue: 5.0,
    tickSize: 0.25,
    currentPrice: 21000,
    notes: "E-mini Nasdaq 100 - Tech-heavy",
  },
  "/MNQ": {
    beta: 1.2,
    tickValue: 0.5,
    tickSize: 0.25,
    currentPrice: 21000,
    notes: "Micro E-mini Nasdaq 100",
  },
  "/YM": {
    beta: 0.95,
    tickValue: 5.0,
    tickSize: 1.0,
    currentPrice: 44000,
    notes: "E-mini Dow Jones - Industrials",
  },
  "/MYM": {
    beta: 0.95,
    tickValue: 0.5,
    tickSize: 1.0,
    currentPrice: 44000,
    notes: "Micro E-mini Dow Jones",
  },
  "/RTY": {
    beta: 1.1,
    tickValue: 5.0,
    tickSize: 0.1,
    currentPrice: 2200,
    notes: "E-mini Russell 2000 - Small caps",
  },
  "/M2K": {
    beta: 1.1,
    tickValue: 0.5,
    tickSize: 0.1,
    currentPrice: 2200,
    notes: "Micro E-mini Russell 2000",
  },

  // Commodities
  "/CL": {
    beta: 0.6,
    tickValue: 10.0,
    tickSize: 0.01,
    currentPrice: 75,
    notes: "Crude Oil - Energy sector proxy",
  },
  "/MCL": {
    beta: 0.6,
    tickValue: 1.0,
    tickSize: 0.01,
    currentPrice: 75,
    notes: "Micro Crude Oil",
  },
  "/GC": {
    beta: 0.2,
    tickValue: 10.0,
    tickSize: 0.1,
    currentPrice: 2650,
    notes: "Gold - Safe-haven, inverse correlation",
  },
  "/MGC": {
    beta: 0.2,
    tickValue: 1.0,
    tickSize: 0.1,
    currentPrice: 2650,
    notes: "Micro Gold",
  },
  "/SI": {
    beta: 0.4,
    tickValue: 25.0,
    tickSize: 0.005,
    currentPrice: 30,
    notes: "Silver - Industrial/vol proxy",
  },
  "/SIL": {
    beta: 0.4,
    tickValue: 2.5,
    tickSize: 0.005,
    currentPrice: 30,
    notes: "Micro Silver",
  },
  "/NG": {
    beta: 0.5,
    tickValue: 10.0,
    tickSize: 0.001,
    currentPrice: 3.5,
    notes: "Natural Gas - High volatility",
  },

  // Currencies (low SPX correlation)
  "/6E": {
    beta: 0.3,
    tickValue: 12.5,
    tickSize: 0.00005,
    currentPrice: 1.08,
    notes: "Euro FX",
  },
  "/6J": {
    beta: 0.25,
    tickValue: 12.5,
    tickSize: 0.0000005,
    currentPrice: 0.0067,
    notes: "Japanese Yen",
  },
  "/6B": {
    beta: 0.35,
    tickValue: 6.25,
    tickSize: 0.0001,
    currentPrice: 1.27,
    notes: "British Pound",
  },

  // Bonds (inverse correlation during risk-off)
  "/ZB": {
    beta: -0.3,
    tickValue: 31.25,
    tickSize: 0.03125,
    currentPrice: 118,
    notes: "30-Year Treasury Bond",
  },
  "/ZN": {
    beta: -0.25,
    tickValue: 15.625,
    tickSize: 0.015625,
    currentPrice: 110,
    notes: "10-Year Treasury Note",
  },
};

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
    currentPrice: 6000,
    notes: "Unknown instrument - using /ES defaults",
  };

  const price = currentPrice ?? instrumentConfig.currentPrice;

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
  return INSTRUMENT_BETAS[instrument] ?? null;
}

export function getSupportedInstruments(): string[] {
  return Object.keys(INSTRUMENT_BETAS);
}
