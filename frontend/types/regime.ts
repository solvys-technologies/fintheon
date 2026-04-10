// [claude-code 2026-03-27] S2-T1: Frontend regime types for UI components

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

export const REGIME_LABELS: Record<MarketRegime, string> = {
  BULL_TREND: "Bull Trend",
  BEAR_TREND: "Bear Trend",
  CONSOLIDATION: "Consolidation",
  GEO_TENSIONS: "Geo Tensions Heightened",
  MACRO_ECON: "Macro/Econ Driven",
  RISK_OFF: "Risk-Off Flight",
  EARNINGS_SEASON: "Earnings Season",
  ILLIQUID_STUPIDITY: "Illiquid Stupidity",
};

export const REGIME_DESCRIPTIONS: Record<MarketRegime, string> = {
  BULL_TREND: "Bear news muted, bull news normal, geo = reversal threat",
  BEAR_TREND: "Bull news = MASSIVE squeeze, bear news continuation",
  CONSOLIDATION: "All news moderate, breakout catalysts elevated",
  GEO_TENSIONS: "War/sanctions DOMINANT, econ data = background noise",
  MACRO_ECON: "Fed/CPI/jobs DOMINANT, everything else muted",
  RISK_OFF: "Safe haven bid, recovery signals explosive",
  EARNINGS_SEASON: "Mag7 = crisis-level, macro muted",
  ILLIQUID_STUPIDITY: "Almost a liquidity crisis. Everything correlates.",
};
