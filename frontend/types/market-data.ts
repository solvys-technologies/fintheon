// [claude-code 2026-03-10] Frontend mirror of backend market-data types
// [claude-code 2026-05-03] S57: IV prediction scenarios are deterministic canonical slots.

export type MarketDataProvider = "fmp" | "unusual-whales" | "yahoo-finance";

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

export interface GammaExposure {
  symbol: string;
  netGex: number;
  callGex: number;
  putGex: number;
  gexFlip: number;
  timestamp: string;
}

export interface OptionsWall {
  symbol: string;
  putWalls: Array<{
    strike: number;
    volume: number;
    oi: number;
    notional: number;
  }>;
  callWalls: Array<{
    strike: number;
    volume: number;
    oi: number;
    notional: number;
  }>;
  maxPain: number;
  timestamp: string;
}

export interface OptionsFlowItem {
  type: "call" | "put";
  strike: number;
  expiry: string;
  premium: number;
  volume: number;
  sentiment: "bullish" | "bearish" | "neutral";
  unusual: boolean;
}

export interface OptionsFlow {
  symbol: string;
  items: OptionsFlowItem[];
  netPremium: number;
  putCallRatio: number;
  timestamp: string;
}

export interface MarketContext {
  vix?: VixData;
  gex?: GammaExposure;
  walls?: OptionsWall;
  flow?: OptionsFlow;
  quote?: StockQuote;
  fetchedAt: string;
}

// Blended IV Score response from GET /api/market-data/iv-score
export interface IVScoreResponse {
  score: number;
  vixComponent: number;
  headlineComponent: number;
  agentDeskComponent: number;
  weights: { vix: number; headlines: number; agentDesk: number };
  vix: {
    level: number;
    percentChange: number;
    isSpike: boolean;
    spikeDirection: "up" | "down" | "none";
    staleMinutes: number;
  };
  eventCount: number;
  rationale: string[];
  timestamp: string;
  points: {
    scaledPoints: number;
    scaledTicks: number;
    scaledDollarRisk: number;
    urgency: "low" | "moderate" | "elevated" | "high" | "extreme";
    implied: {
      impliedPct: number;
      basePoints: number;
      adjustedPoints: number;
      adjustedTicks: number;
      tickValue: number;
      dollarRisk: number;
      instrument: string;
      beta: number;
    };
  };
  instrument: string;
  /** V4: AgentDesk / heuristic forward-looking prediction */
  prediction?: {
    nextSessionScore: number;
    confidence: number;
    regimeShiftProbability: number;
    /** Fixed order: Continuation, Risk-on rally, Escalation. Missing buckets return 0%. */
    scenarios: Array<{
      label: string;
      probability: number;
      projectedScore: number;
    }>;
    source: "agentDesk" | "heuristic";
    generatedAt: string;
  };
  /** V3: Systemic risk overlay data */
  systemic?: {
    score: number;
    overlay: number;
    activeChains: number;
    rhymeMatches: number;
    creditSignals: number;
    topRhyme?: {
      crisisName: string;
      crisisYear: number;
      matchScore: number;
      peakVix: number;
      maxDrawdown: number;
    };
    rationale: string[];
  };
}
