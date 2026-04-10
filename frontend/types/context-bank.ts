// [claude-code 2026-03-11] Frontend mirror of backend context-bank types

export type VixRegime = "low" | "normal" | "elevated" | "crisis";
export type DeskId =
  | "fundamentals"
  | "futures"
  | "pma-merged"
  | "news-sentiment";
export type AgentName =
  | "Harper-Opus"
  | "Oracle"
  | "Feucht"
  | "Consul"
  | "Herald";

export interface ContextBankSnapshot {
  version: number;
  generatedAt: string;
  ageSeconds: number;
  ivScores: Record<string, InstrumentIVContext>;
  vix: VIXContext;
  systemic: SystemicContext;
  breakingHeadlines: BreakingHeadline[];
  econCalendar: EconCalendarContext;
  tradeIdeas: TradeIdeasContext;
  fred: FredContext;
  polymarket: PolymarketContext;
  kalshi: KalshiContext;
  deskReports: DeskReportSummary[];
}

export interface InstrumentIVContext {
  instrument: string;
  score: number;
  vixComponent: number;
  headlineComponent: number;
  points: {
    scaledPoints: number;
    scaledTicks: number;
    scaledDollarRisk: number;
    urgency: string;
  };
  systemic?: { overlay: number; activeChains: number };
  computedAt: string;
}

export interface VIXContext {
  level: number;
  percentChange: number;
  isSpike: boolean;
  spikeDirection: "up" | "down" | "none";
  regime: VixRegime;
  staleMinutes: number;
}

export interface SystemicContext {
  score: number;
  ivOverlay: number;
  activeChains: number;
  rhymeMatches: number;
  creditSignals: number;
  topRhyme?: { crisisName: string; crisisYear: number; matchScore: number };
  rationale: string[];
  timestamp: string;
}

export interface BreakingHeadline {
  id: string;
  headline: string;
  source: string;
  macroLevel: number;
  ivScore: number;
  publishedAt: string;
  symbols: string[];
}

export interface EconCalendarContext {
  events: EconEventSummary[];
  surprises: EconSurprise[];
}

export interface EconEventSummary {
  name: string;
  time?: string;
  importance: number;
  forecast?: string;
  previous?: string;
  actual?: string;
}

export interface EconSurprise {
  name: string;
  actual: string;
  forecast: string;
  direction: "beat" | "miss";
}

export interface TradeIdeasContext {
  active: TradeIdeaSummary[];
  pnlSummary: { todayPnl?: number; winRate?: number; tradesCount?: number };
}

export interface TradeIdeaSummary {
  id: string;
  title: string;
  ticker: string;
  direction: "long" | "short" | "neutral";
  confidence?: string;
  entry?: number;
  sourceAgent?: string;
}

export interface FredContext {
  hyOasSpread?: number;
  yieldCurve2s10s?: number;
  yieldCurve3m10y?: number;
  tedSpread?: number;
  fedFundsRate?: number;
  fetchedAt?: string;
}

export interface PolymarketContext {
  markets: PolymarketMarketSummary[];
  fetchedAt: string;
}

export interface PolymarketMarketSummary {
  id: string;
  title: string;
  probability: number;
  outcome: string;
  closeTime?: string;
}

export interface KalshiContext {
  topMarkets: KalshiMarketSummary[];
  recentWhales: WhaleAlertSummary[];
  fetchedAt: string;
}

export interface KalshiMarketSummary {
  ticker: string;
  title: string;
  lastPrice: number;
  volume24h: number;
  closeTime?: string;
}

export interface WhaleAlertSummary {
  id: string;
  ticker: string;
  marketTitle: string;
  contracts: number;
  notionalUsd: number;
  takerSide: "yes" | "no";
  alertTypes: string[];
  createdAt: string;
}

export interface DeskReportSummary {
  desk: DeskId;
  agent: AgentName;
  snapshotVersion: number;
  timestamp: string;
  summary: string;
  alertCount: number;
  confidence: number;
}

export interface DeskAlert {
  severity: "info" | "warning" | "critical";
  title: string;
  detail: string;
  instruments?: string[];
  timestamp: string;
}

export interface DeskTradeIdea {
  instrument: string;
  direction: "long" | "short";
  entry?: number;
  stop?: number;
  target?: number;
  thesis: string;
  conviction: "low" | "medium" | "high" | "max";
  timeframe?: string;
}

export interface DeskRiskFlag {
  type: "correlation" | "concentration" | "regime" | "exposure" | "drawdown";
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  affectedInstruments: string[];
}

export interface DeskReport {
  id: string;
  desk: DeskId;
  agent: AgentName;
  snapshotVersion: number;
  timestamp: string;
  summary: string;
  alerts: DeskAlert[];
  tradeIdeas?: DeskTradeIdea[];
  riskFlags?: DeskRiskFlag[];
  confidence: number;
}

export interface ConsolidatedBrief {
  id: string;
  generatedAt: string;
  snapshotVersion: number;
  executiveSummary: string;
  topAlerts: DeskAlert[];
  topTradeIdeas: DeskTradeIdea[];
  riskMatrix: DeskRiskFlag[];
  approvalQueue: DeskTradeIdea[];
  deskReportIds: string[];
}

export interface ContextBankMeta {
  version: number;
  generatedAt: string | null;
  ageSeconds: number;
  deskReportCount: number;
}
