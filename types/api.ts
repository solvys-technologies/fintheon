/**
 * API Type Definitions
 * 
 * These types match the expected API responses from your Hono backend.
 * Update these to match your actual backend response types.
 */

export interface PriceBrainScore {
  sentiment: 'Bullish' | 'Bearish' | 'Neutral';
  classification: 'Cyclical' | 'Counter-cyclical' | 'Neutral';
  impliedPoints: number | null;
  instrument: string | null;
}

export type PolymarketMarketType = 
  | 'rate_cut' 
  | 'cpi' 
  | 'nfp' 
  | 'interest_rate'
  | 'jerome_powell'
  | 'donald_trump_tariffs'
  | 'politics'
  | 'gdp'
  | 'interest_rate_futures';

export interface PolymarketOdds {
  marketId: string;
  marketType: PolymarketMarketType;
  question?: string;
  yesOdds: number;
  noOdds: number;
  timestamp: string;
}

export interface PolymarketUpdate {
  id: string;
  marketType: PolymarketMarketType;
  previousOdds: number;
  currentOdds: number;
  changePercentage: number;
  triggeredByNewsId?: string;
  timestamp: string;
}

export interface NewsItem {
  id: string;
  title: string;
  content: string;
  summary?: string;
  source: string;
  url?: string;
  publishedAt: Date | string;
  impact?: 'high' | 'medium' | 'low';
  symbols?: string[];
  macroLevel?: 1 | 2 | 3 | 4;
  priceBrainScore?: PriceBrainScore;
  authorHandle?: string;
  isBreaking?: boolean;
  sentiment?: 'positive' | 'negative' | 'neutral' | 'bullish' | 'bearish';
  ivImpact?: number;
  ivScore?: number;
  polymarketUpdate?: PolymarketUpdate;
}

export interface Account {
  id: string;
  userId: string;
  balance: number;
  dailyPnl: number;
  dailyTarget?: number;
  dailyLossLimit?: number;
  tier?: 'free' | 'pulse' | 'pulse_plus' | 'pulse_pro';
  tradingEnabled?: boolean;
  autoTrade?: boolean;
  riskManagement?: boolean;
}

export interface Position {
  id: string;
  symbol: string;
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  pnl: number;
  side: 'long' | 'short';
}

export interface ChatResponse {
  message: string;
  conversationId: string;
  tiltWarning?: {
    detected: boolean;
    message?: string;
  };
}

export interface NTNReport {
  report: {
    content: string;
    reportType?: string;
    generatedAt?: string;
  };
  metadata?: Record<string, unknown> | null;
  model?: string | null;
}

export interface ProjectXAccount {
  accountId: string;
  accountName: string;
  balance?: number;
}

export interface PsychScores {
  executions: number;
  emotionalControl: number;
  planAdherence: number;
  riskSizing: number;
  adaptability: number;
}

export interface PsychProfile {
  blindSpots: string[];
  goal: string | null;
  orientationComplete: boolean;
  psychScores: PsychScores;
  lastAssessmentAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}
