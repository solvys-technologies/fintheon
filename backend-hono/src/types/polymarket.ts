// [claude-code 2026-04-12] S15-T2: Polymarket read-only service — public API data for research/signal enrichment

// ── Raw API response shapes (Gamma API) ─────────────────────────────────────

export interface GammaRawEvent {
  id: string;
  slug: string;
  title: string;
  description: string;
  markets: GammaRawMarket[];
  start_date: string;
  end_date: string;
  created_at: string;
  active: boolean;
  closed: boolean;
  liquidity: string;
  volume: string;
  competitive: string;
}

export interface GammaRawMarket {
  id: string;
  question: string;
  slug: string;
  conditionId: string;
  outcomes: string; // JSON-encoded: '["Yes","No"]'
  outcomePrices: string; // JSON-encoded: '["0.65","0.35"]'
  clobTokenIds: string; // JSON-encoded: '["token1","token2"]'
  volume: string;
  liquidity: string;
  active: boolean;
  closed: boolean;
  end_date_iso: string;
  created_at: string;
  category: string;
}

// ── Raw trade shape (Data API) ──────────────────────────────────────────────

export interface DataApiRawTrade {
  id: string;
  market: string; // conditionId
  side: string; // "BUY" or "SELL" — mapped to YES/NO via asset_id
  size: string; // numeric string (USDC)
  price: string; // numeric string 0-1
  created_at: string; // ISO timestamp
  asset_id?: string;
}

// ── Normalized domain types ─────────────────────────────────────────────────

export interface PolymarketMarket {
  conditionId: string;
  slug: string;
  question: string;
  category: string;
  status: "active" | "closed";
  yesPrice: number;
  noPrice: number;
  volume: number;
  liquidity: number;
  closeTime: string;
  clobTokenIds: [string, string];
  url: string;
}

export interface PolymarketTrade {
  id: string;
  conditionId: string;
  side: "YES" | "NO";
  size: number;
  price: number;
  createdAt: string;
}

export interface PolymarketWhaleAlert {
  id: string;
  conditionId: string;
  marketQuestion: string;
  category: string;
  side: "YES" | "NO";
  size: number;
  price: number;
  alertType: "absolute" | "notional";
  detectedAt: string;
}

// ── Response types ──────────────────────────────────────────────────────────

export interface PolymarketMarketsResponse {
  markets: PolymarketMarket[];
  fetchedAt: string;
}

export interface PolymarketWhaleResponse {
  alerts: PolymarketWhaleAlert[];
  fetchedAt: string;
}
