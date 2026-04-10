// [claude-code 2026-03-29] Add narrative lifecycle fields (promotedAt, narrativeThreads, category, status)
// [claude-code 2026-03-24] VIX-weighted item scoring + SubScoreBreakdown
/**
 * RiskFlow Types
 * Type definitions for RiskFlow news feed
 */

export type NewsSource =
  | "FinancialJuice"
  | "OSINTSources"
  | "EconomicCalendar"
  | "TrendSpider"
  | "Barchart"
  | "Polymarket"
  | "Kalshi"
  | "TwitterCli"
  | "DeItaOne"
  | "Custom"
  | "Hermes";
export type UrgencyLevel = "immediate" | "high" | "normal";
export type SentimentDirection = "bullish" | "bearish" | "neutral";
export type RiskType =
  | "Macro"
  | "Geopolitical"
  | "Earnings"
  | "Technical"
  | "Credit"
  | "Liquidity"
  | "Commentary";

export type MacroLevel = 1 | 2 | 3 | 4;

/** Per-item scoring breakdown showing how each factor contributed */
export interface SubScoreBreakdown {
  eventWeight: number; // 0-10, from calibration table or EVENT_WEIGHTS fallback
  timing: number; // 0-3, session + time window effect
  deviation: number; // 0-3, actual vs forecast
  momentum: number; // 0-2, breaking + urgency + reaction
  vixContext: number; // 0-10, continuous VIX curve score
  vixMultiplier: number; // the multiplier applied (e.g. 1.15)
  regimeMultiplier?: number; // regime × sentiment scaling
  regimeName?: string; // current market regime label
  commentatorMultiplier?: number; // speaker tier scaling
  speaker?: string | null; // extracted speaker name
}

export interface FeedItem {
  id: string;
  source: NewsSource;
  headline: string;
  body?: string;
  /** Source URL for linking back to original article/tweet */
  url?: string;
  symbols: string[];
  tags: string[];
  isBreaking: boolean;
  urgency: UrgencyLevel;
  sentiment?: SentimentDirection;
  ivScore?: number;
  macroLevel?: MacroLevel;
  publishedAt: string;
  analyzedAt?: string;
  /** Author handle for X/Twitter attribution */
  authorHandle?: string;
  /** Per-item sub-score breakdown (VIX-weighted) */
  subScores?: SubScoreBreakdown;
  /** Risk classification category */
  riskType?: RiskType | null;
  /** Agent-generated analytical note */
  agentNote?: string | null;
  /** Timestamp when agentNote was generated */
  agentNoteGeneratedAt?: string | null;
  /** Structured economic data for econ prints */
  econData?: {
    actual?: number | null;
    forecast?: number | null;
    previous?: number | null;
    beatMiss?: "beat" | "miss" | "inline" | null;
    surprisePercent?: number | null;
  } | null;
  /** Point estimation from IV score × VIX */
  priceBrainScore?: {
    sentiment: "Bullish" | "Bearish" | "Neutral";
    classification: "Cyclical" | "Counter-cyclical" | "Neutral";
    impliedPoints: number | null;
    instrument: string | null;
  };
  /** Narrative lifecycle — populated after catalyst promotion */
  promotedAt?: string | null;
  narrativeThreads?: string[];
  category?: string | null;
  status?: "active" | "monitoring" | "resolved" | null;
  /** Daily close market impact (populated ~24h after event) */
  marketImpact?: {
    nq?: { points: number; percent: number } | null;
    es?: { points: number; percent: number } | null;
    ym?: { points: number; percent: number } | null;
    asOf?: string;
  } | null;
}

export interface FeedResponse {
  items: FeedItem[];
  total: number;
  hasMore: boolean;
  nextCursor?: string;
  fetchedAt: string;
}

export interface FeedFilters {
  sources?: NewsSource[];
  symbols?: string[];
  tags?: string[];
  breakingOnly?: boolean;
  minIvScore?: number;
  minMacroLevel?: MacroLevel;
  limit?: number;
  offset?: number;
  cursor?: string;
}

export interface Watchlist {
  userId: string;
  symbols: string[];
  tags: string[];
  sources: NewsSource[];
  updatedAt: string;
}

export interface WatchlistUpdateRequest {
  symbols?: string[];
  tags?: string[];
  sources?: NewsSource[];
}

export interface WatchlistResponse {
  watchlist: Watchlist;
  success: boolean;
}

// [claude-code 2026-03-23] Browser Use Phase 2 — proposal feed items
export interface ProposalFeedData {
  id: string;
  ticker: string;
  direction: "long" | "short";
  entry: number;
  stopLoss: number;
  takeProfit: number[];
  strategy?: string;
  confidence?: number;
  rationale?: string;
  screenshotUrl?: string;
  status: "pending" | "approved" | "rejected" | "executed" | "expired";
}

export interface ProposalFeedItem extends FeedItem {
  proposal: ProposalFeedData;
}
