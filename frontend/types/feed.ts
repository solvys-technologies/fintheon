export interface IVIndicator {
  value: number;
  type: 'Bullish' | 'Bearish' | 'Neutral';
  classification: 'Cyclical' | 'Countercyclical' | 'Neutral';
}

// [claude-code 2026-03-23] Browser Use Phase 2 — proposal feed items
export interface ProposalData {
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

export interface FeedItem {
  id: string;
  time: Date;
  text: string;
  source: string;
  type: 'news' | 'market' | 'alert' | 'proposal';
  iv: IVIndicator;
  proposal?: ProposalData;
}

export type NewsSource = 'ZeroHedge' | 'Bloomberg' | 'Reuters' | 'WSJ' | 'CNBC' | 'FT';
