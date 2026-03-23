/**
 * RiskFlow Types
 * Type definitions for RiskFlow news feed
 */

export type NewsSource = 'FinancialJuice' | 'InsiderWire' | 'EconomicCalendar' | 'TrendSpider' | 'Barchart' | 'Polymarket' | 'Kalshi' | 'TwitterCli' | 'Custom' | 'Hermes';
export type UrgencyLevel = 'immediate' | 'high' | 'normal';
export type SentimentDirection = 'bullish' | 'bearish' | 'neutral';

export type MacroLevel = 1 | 2 | 3 | 4;

export interface FeedItem {
  id: string;
  source: NewsSource;
  headline: string;
  body?: string;
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
  /** Point estimation from IV score × VIX */
  priceBrainScore?: {
    sentiment: 'Bullish' | 'Bearish' | 'Neutral';
    classification: 'Cyclical' | 'Counter-cyclical' | 'Neutral';
    impliedPoints: number | null;
    instrument: string | null;
  };
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
  direction: 'long' | 'short';
  entry: number;
  stopLoss: number;
  takeProfit: number[];
  strategy?: string;
  confidence?: number;
  rationale?: string;
  screenshotUrl?: string;
  status: 'pending' | 'approved' | 'rejected' | 'executed' | 'expired';
}

export interface ProposalFeedItem extends FeedItem {
  proposal: ProposalFeedData;
}
