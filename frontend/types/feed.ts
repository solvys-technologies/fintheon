export interface IVIndicator {
  value: number;
  type: 'Bullish' | 'Bearish' | 'Neutral';
  classification: 'Cyclical' | 'Countercyclical' | 'Neutral';
}

export interface FeedItem {
  id: string;
  time: Date;
  text: string;
  source: string;
  type: 'news' | 'market' | 'alert';
  iv: IVIndicator;
}

export type NewsSource = 'ZeroHedge' | 'Bloomberg' | 'Reuters' | 'WSJ' | 'CNBC' | 'FT';
