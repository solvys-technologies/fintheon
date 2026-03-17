// [claude-code 2026-03-16] Kalshi prediction market types — whale tracker integration

// ── Raw API response shapes (snake_case from wire) ──────────────────────────

export interface KalshiRawTrade {
  trade_id: string
  ticker: string
  count_fp: string          // string decimal e.g. "750.00"
  yes_price_dollars: string // e.g. "0.62"
  no_price_dollars: string
  taker_side: 'yes' | 'no'
  created_time: string      // ISO
}

export interface KalshiRawMarket {
  ticker: string
  event_ticker: string
  market_type: string
  status: string
  title: string
  last_price_dollars: string
  volume_fp: string
  volume_24h_fp: string
  open_interest_fp: string
  close_time: string
}

export interface KalshiRawEvent {
  event_ticker: string
  series_ticker: string
  title: string
  sub_title: string
  category: string
  mutually_exclusive: boolean
  markets?: KalshiRawMarket[]
}

// ── Normalized domain types ─────────────────────────────────────────────────

export interface KalshiMarket {
  ticker: string
  eventTicker: string
  title: string
  category: string
  status: 'open' | 'closed' | 'settled'
  lastPrice: number       // YES price 0-1
  volume24h: number
  openInterest: number
  closeTime?: string
  url: string
}

export interface KalshiTrade {
  tradeId: string
  ticker: string
  contracts: number
  yesPrice: number
  noPrice: number
  takerSide: 'yes' | 'no'
  notionalUsd: number     // contracts × price of taker side
  createdAt: string
}

// ── Whale detection ─────────────────────────────────────────────────────────

export type WhaleAlertType = 'absolute' | 'notional' | 'relative' | 'cluster'

export interface WhaleAlert {
  id: string
  ticker: string
  marketTitle: string
  category: string
  contracts: number
  notionalUsd: number
  takerSide: 'yes' | 'no'
  lastPrice: number
  alertTypes: WhaleAlertType[]
  openInterest?: number
  clusterSize?: number
  createdAt: string
  detectedAt: string
}

// ── Response types ──────────────────────────────────────────────────────────

export interface KalshiMarketsResponse {
  markets: KalshiMarket[]
  fetchedAt: string
}

export interface KalshiWhaleResponse {
  alerts: WhaleAlert[]
  markets: KalshiMarket[]
  lastTradeFetchedAt: string
}
