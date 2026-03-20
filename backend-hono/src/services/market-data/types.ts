// [claude-code 2026-03-14] Market data unified type layer (Yahoo Finance + Unusual Whales)

export type MarketDataProvider = 'yahoo-finance' | 'unusual-whales';

export interface StockQuote {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap?: number;
  pe?: number;
  timestamp: string;
}

export interface VixData {
  value: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  previousClose: number;
  timestamp: string;
  stale?: boolean;
}

// Unusual Whales types
export interface GammaExposure {
  symbol: string;
  netGex: number;
  callGex: number;
  putGex: number;
  gexFlip: number; // price where GEX flips from positive to negative
  timestamp: string;
}

export interface OptionsWall {
  symbol: string;
  putWalls: Array<{ strike: number; volume: number; oi: number; notional: number }>;
  callWalls: Array<{ strike: number; volume: number; oi: number; notional: number }>;
  maxPain: number;
  timestamp: string;
}

export interface OptionsFlowItem {
  type: 'call' | 'put';
  strike: number;
  expiry: string;
  premium: number;
  volume: number;
  sentiment: 'bullish' | 'bearish' | 'neutral';
  unusual: boolean;
}

export interface OptionsFlow {
  symbol: string;
  items: OptionsFlowItem[];
  netPremium: number;
  putCallRatio: number;
  timestamp: string;
}

// Aggregated context for QuickPulse / Morning Brief
export interface MarketContext {
  vix?: VixData;
  gex?: GammaExposure;
  walls?: OptionsWall;
  flow?: OptionsFlow;
  quote?: StockQuote;
  fetchedAt: string;
}
