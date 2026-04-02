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

export interface RiskFlowItem {
  id: string | number;
  title: string;
  content?: string;
  summary?: string;
  source: string;
  url?: string;
  publishedAt: Date | string;
  sentiment?: 'positive' | 'negative' | 'neutral' | 'bullish' | 'bearish';
  ivImpact?: number;
  ivScore?: number;
  pointRange?: number | null;
  direction?: 'Bullish' | 'Bearish' | 'Neutral' | null;
  impact?: 'high' | 'medium' | 'low';
  symbols?: string[];
  isBreaking?: boolean;
  category?: string;
  macroLevel?: 1 | 2 | 3 | 4;
  priceBrainScore?: PriceBrainScore;
  authorHandle?: string;
  polymarketUpdate?: PolymarketUpdate;
  // [claude-code 2026-03-23] Browser Use Phase 2
  proposal?: {
    id: string;
    ticker: string;
    direction: 'long' | 'short';
    entry: number;
    stopLoss: number;
    takeProfit: number[];
    status: 'pending' | 'approved' | 'rejected' | 'executed' | 'expired';
    screenshotUrl?: string;
  };
  // [claude-code 2026-03-26] T1: Rich scoring data threaded from backend
  subScores?: { eventWeight: number; timing: number; deviation: number; momentum: number; vixContext: number; vixMultiplier: number } | null;
  riskType?: string | null;
  agentNote?: string | null;
  agentNoteGeneratedAt?: string | null;
  econData?: { actual?: number | null; forecast?: number | null; previous?: number | null; beatMiss?: 'beat' | 'miss' | 'inline' | null; surprisePercent?: number | null } | null;
}

// Alias for backward compatibility
export type NewsItem = RiskFlowItem;

export interface Account {
  id: string | number | null;
  accountId?: string | number | null;
  accountName?: string | null;
  accountType?: string | null;
  userId?: string;
  balance: number;
  equity?: number;
  marginUsed?: number;
  buyingPower?: number;
  dailyPnl?: number;
  dailyTarget?: number;
  dailyLossLimit?: number;
  tier?: 'free' | 'fintheon' | 'fintheon_plus' | 'fintheon_pro';
  tradingEnabled?: boolean;
  autoTrade?: boolean;
  riskManagement?: boolean;
  provider?: string;
  isPaper?: boolean;
  lastSyncedAt?: Date | string | null;
  algoEnabled?: boolean;
}

export interface Position {
  id: string | number;
  accountId?: number;
  contractId?: string;
  symbol?: string;
  quantity?: number;
  size?: number;
  entryPrice?: number;
  exitPrice?: number;
  currentPrice?: number;
  pnl?: number;
  pnlPercentage?: number;
  side: string;
  openedAt: Date | string;
  closedAt?: Date | string | null;
  status?: string;
}

export interface ChatResponse {
  message: string;
  conversationId: string;
  tiltWarning?: {
    detected: boolean;
    message?: string;
  };
}

export interface MDBReport {
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
  provider?: string;
  isPaper?: boolean;
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

export interface BrokerAccount {
  accountId: string;
  accountName: string;
  balance?: number;
  provider?: string;
  isPaper?: boolean;
}
