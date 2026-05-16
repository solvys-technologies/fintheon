// [claude-code 2026-03-27] S2-T1: Market regime classification system — 8 regimes with multiplier profiles
// [claude-code 2026-05-16] DEPRECATED — replaced by theme-tracker types (S68-T1). Preserved for migration reference.

export const MARKET_REGIMES = [
  "BULL_TREND",
  "BEAR_TREND",
  "CONSOLIDATION",
  "GEO_TENSIONS",
  "MACRO_ECON",
  "RISK_OFF",
  "EARNINGS_SEASON",
  "ILLIQUID_STUPIDITY",
] as const;

export type MarketRegime = (typeof MARKET_REGIMES)[number];

export interface RegimeState {
  id: string;
  regime: MarketRegime;
  detectedBy: "mdb_agent" | "manual" | "regime_detector";
  confidence: number; // 0-1
  notes?: string;
  active: boolean;
  createdAt: string;
}

export interface RegimeMultiplierProfile {
  regime: MarketRegime;
  label: string;
  description: string;
  sentimentMultipliers: {
    bullish: number;
    bearish: number;
    neutral: number;
  };
  eventTypeOverrides: Record<string, number>;
}

export const DEFAULT_REGIME_MULTIPLIERS: Record<
  MarketRegime,
  RegimeMultiplierProfile
> = {
  BULL_TREND: {
    regime: "BULL_TREND",
    label: "Bull Trend",
    description: "Bear news muted, bull news normal, geo = reversal threat",
    sentimentMultipliers: { bullish: 1.0, bearish: 0.5, neutral: 0.8 },
    eventTypeOverrides: { geopolitical: 1.3, conflict: 1.3 },
  },
  BEAR_TREND: {
    regime: "BEAR_TREND",
    label: "Bear Trend",
    description:
      "Bull news = MASSIVE squeeze potential, bear news continuation",
    sentimentMultipliers: { bullish: 3.0, bearish: 1.0, neutral: 0.8 },
    eventTypeOverrides: { geopolitical: 1.5, conflict: 1.5 },
  },
  CONSOLIDATION: {
    regime: "CONSOLIDATION",
    label: "Consolidation",
    description: "All news moderate, breakout catalysts elevated",
    sentimentMultipliers: { bullish: 0.8, bearish: 0.8, neutral: 0.7 },
    eventTypeOverrides: { technicalBreak: 1.5 },
  },
  GEO_TENSIONS: {
    regime: "GEO_TENSIONS",
    label: "Geopolitical Tensions Heightened",
    description: "War/sanctions/tariffs DOMINANT, econ data background noise",
    sentimentMultipliers: { bullish: 2.5, bearish: 1.5, neutral: 1.0 },
    eventTypeOverrides: {
      geopolitical: 1.5,
      tariffs: 1.5,
      conflict: 1.5,
      chinaTrade: 1.5,
      cpiPrint: 0.3,
      ppiPrint: 0.3,
      nfpPrint: 0.3,
      gdpPrint: 0.3,
      jobless: 0.3,
    },
  },
  MACRO_ECON: {
    regime: "MACRO_ECON",
    label: "Macro/Econ Driven",
    description: "Fed/CPI/jobs DOMINANT, everything else muted",
    sentimentMultipliers: { bullish: 1.2, bearish: 1.2, neutral: 1.0 },
    eventTypeOverrides: {
      fedDecision: 1.5,
      fomc: 1.5,
      powellSpeak: 1.5,
      cpiPrint: 1.5,
      nfpPrint: 1.5,
      pcePrint: 1.3,
      ppiPrint: 1.3,
      gdpPrint: 1.3,
      jolts: 1.2,
      geopolitical: 0.5,
      tariffs: 0.5,
      conflict: 0.5,
    },
  },
  RISK_OFF: {
    regime: "RISK_OFF",
    label: "Risk-Off Flight",
    description:
      "Safe haven bid, equities sell on any excuse, recovery signals explosive",
    sentimentMultipliers: { bullish: 2.0, bearish: 1.3, neutral: 0.9 },
    eventTypeOverrides: {
      liquidityStress: 1.5,
      bankStress: 1.5,
      creditSpreadWidening: 1.5,
    },
  },
  EARNINGS_SEASON: {
    regime: "EARNINGS_SEASON",
    label: "Earnings Season",
    description:
      "Individual names drive index, Mag7 = crisis-level, macro muted",
    sentimentMultipliers: { bullish: 1.0, bearish: 1.0, neutral: 0.8 },
    eventTypeOverrides: {
      earningsHighImpact: 2.0,
      earningsMidCap: 1.5,
      earnings: 1.5,
      cpiPrint: 0.5,
      nfpPrint: 0.5,
      fedDecision: 0.7,
    },
  },
  ILLIQUID_STUPIDITY: {
    regime: "ILLIQUID_STUPIDITY",
    label: "Illiquid Stupidity",
    description:
      "Almost a liquidity crisis. Repo/funding DOMINANT, everything correlates, Fed intervention = instant reversal",
    sentimentMultipliers: { bullish: 3.0, bearish: 2.0, neutral: 1.0 },
    eventTypeOverrides: {
      liquidityStress: 2.0,
      bankStress: 2.0,
      creditSpreadWidening: 1.8,
      fedDecision: 3.0,
      fomc: 2.5,
      powellSpeak: 2.5,
    },
  },
};
