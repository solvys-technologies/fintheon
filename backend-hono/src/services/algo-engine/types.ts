// [claude-code 2026-03-26] S1-T1: Algo engine foundation — core types for the entire engine

/** Raw tick from market data feed */
export interface Tick {
  timestamp: number;
  price: number;
  volume: number;
  instrument: "MNQ" | "ES";
  bid: number;
  ask: number;
}

/** Aggregated bar from tick consolidation */
export interface Bar {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timestamp: number;
  duration: number;
  tickCount: number;
}

/** Alias for bars built from tick consolidation */
export type TickBar = Bar;

/** Active position state */
export interface Position {
  instrument: "MNQ" | "ES";
  direction: "long" | "short";
  entryPrice: number;
  contracts: number;
  stopPrice: number;
  targetPrice: number;
  entryTime: number;
}

/**
 * Trailing stop phases (from video corrections):
 * 1. engulfing-anchor — initial stop below butt of entry engulfing candle
 * 2. break-even — after EMA retest holds, move stop to break-even
 * 3. ema-defense — trail to butt of each new engulfing candle that respects EMA
 * 4. ema-100-trail — when ATR > 17 on 3-candle lookback, trail below 100 EMA
 */
export type TrailingPhase =
  | "engulfing-anchor"
  | "break-even"
  | "ema-defense"
  | "ema-100-trail";

/**
 * Fib zone — the area BETWEEN two adjacent fib levels.
 * Zone classification determines conviction/sizing, NOT eligibility.
 */
export interface FibZone {
  highLevel: number;
  lowLevel: number;
  highPrice: number;
  lowPrice: number;
  classification: "ripper" | "strong" | "weak";
}

/**
 * Antilag signal: ATR spike + engulfing candle at fib/EMA level.
 * Primary on NQ 1000T; ES provides directional bias only.
 */
export interface AntilagSignal {
  timestamp: number;
  instrument: "MNQ" | "ES";
  atrSpike: number;
  isEngulfing: boolean;
  barRange: number;
  averageRange: number;
  nearFibZone: boolean;
  nearEma: boolean;
  direction: "long" | "short";
}

/** Core strategy models — only these 3 are active */
export type StrategyModel = "40-40-club" | "flush" | "ripper";

/** Trading session window definition */
export interface SessionWindow {
  name: string;
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
  timezone: string;
}

/** Market regime classification */
export type RegimeType =
  | "TRENDING"
  | "RANGE_BOUND"
  | "BINARY_EVENT"
  | "RISK_OFF"
  | "UNKNOWN";

/** Day type determines profit target behavior */
export type DayType = "base-hit" | "home-run";

/**
 * 15-point confluence scoring system.
 * Each dimension scored independently; total determines entry conviction.
 */
export interface ConfluenceScore {
  fibZone: number;
  antilagStrength: number;
  emaProximity: number;
  rsiExtremity: number;
  esConfirmation: number;
  vwapConfluence: number;
  total: number;
}

/** Access Denied pattern — first bearish candle(s) in bullish impulse = retest, not reversal */
export interface AccessDeniedSignal {
  timestamp: number;
  candleCount: number;
  retestLevel: number;
  emaDefended: boolean;
  confirmed: boolean;
}
