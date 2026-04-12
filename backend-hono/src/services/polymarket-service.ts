// [claude-code 2026-04-12] S15-T2: Polymarket read-only service — public API data for research/signal enrichment
import type {
  GammaRawEvent,
  GammaRawMarket,
  DataApiRawTrade,
  PolymarketMarket,
  PolymarketTrade,
  PolymarketWhaleAlert,
  PolymarketMarketsResponse,
  PolymarketWhaleResponse,
} from "../types/polymarket.js";

const GAMMA_API = "https://gamma-api.polymarket.com";
const DATA_API = "https://data-api.polymarket.com";

const WHALE_THRESHOLD_SIZE = 5000; // USDC

// ── Fetch helper (no auth needed) ───────────────────────────────────────────

async function polyFetch<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      console.error(`[Polymarket] ${url} failed: ${res.status}`);
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    console.error(`[Polymarket] ${url} error:`, err);
    return null;
  }
}

// ── Normalize helpers ───────────────────────────────────────────────────────

function normalizeMarket(raw: GammaRawMarket): PolymarketMarket {
  // These fields are double-encoded JSON strings inside the JSON response
  const prices = JSON.parse(raw.outcomePrices) as string[];
  const tokenIds = JSON.parse(raw.clobTokenIds) as string[];

  return {
    conditionId: raw.conditionId,
    slug: raw.slug,
    question: raw.question,
    category: raw.category || "unknown",
    status: raw.closed ? "closed" : "active",
    yesPrice: parseFloat(prices[0]),
    noPrice: parseFloat(prices[1]),
    volume: parseFloat(raw.volume),
    liquidity: parseFloat(raw.liquidity),
    closeTime: raw.end_date_iso,
    clobTokenIds: [tokenIds[0], tokenIds[1]],
    url: `https://polymarket.com/event/${raw.slug}`,
  };
}

function normalizeTrade(raw: DataApiRawTrade): PolymarketTrade {
  return {
    id: raw.id,
    conditionId: raw.market,
    side: raw.side === "SELL" ? "NO" : "YES",
    size: parseFloat(raw.size),
    price: parseFloat(raw.price),
    createdAt: raw.created_at,
  };
}

// ── Service methods ─────────────────────────────────────────────────────────

async function getMarkets(
  category?: string,
  limit: number = 20,
): Promise<PolymarketMarketsResponse> {
  let url = `${GAMMA_API}/events?closed=false&limit=${limit}&active=true`;
  if (category) url += `&tag=${encodeURIComponent(category)}`;

  const events = await polyFetch<GammaRawEvent[]>(url);
  if (!events) return { markets: [], fetchedAt: new Date().toISOString() };

  const markets: PolymarketMarket[] = [];
  for (const event of events) {
    if (!event.markets) continue;
    for (const raw of event.markets) {
      try {
        markets.push(normalizeMarket(raw));
      } catch {
        // Skip markets with malformed JSON fields
      }
    }
  }

  // Sort by volume descending
  markets.sort((a, b) => b.volume - a.volume);

  return { markets, fetchedAt: new Date().toISOString() };
}

async function getMarketBySlug(slug: string): Promise<PolymarketMarket | null> {
  const data = await polyFetch<GammaRawMarket[]>(
    `${GAMMA_API}/markets?slug=${encodeURIComponent(slug)}`,
  );
  if (!data || data.length === 0) return null;

  try {
    return normalizeMarket(data[0]);
  } catch {
    return null;
  }
}

async function searchMarkets(
  query: string,
  limit: number = 20,
): Promise<PolymarketMarket[]> {
  const url = `${GAMMA_API}/markets?_q=${encodeURIComponent(query)}&closed=false&limit=${limit}`;
  const data = await polyFetch<GammaRawMarket[]>(url);
  if (!data) return [];

  const markets: PolymarketMarket[] = [];
  for (const raw of data) {
    try {
      markets.push(normalizeMarket(raw));
    } catch {
      // Skip malformed
    }
  }
  return markets;
}

async function getRecentTrades(
  conditionId: string,
  limit: number = 100,
): Promise<PolymarketTrade[]> {
  const url = `${DATA_API}/trades?market=${encodeURIComponent(conditionId)}&limit=${limit}`;
  const data = await polyFetch<DataApiRawTrade[]>(url);
  if (!data) return [];
  return data.map(normalizeTrade);
}

async function getWhaleAlerts(): Promise<PolymarketWhaleResponse> {
  // Fetch top markets, then scan their recent trades for whale activity
  const marketsRes = await getMarkets(undefined, 10);
  if (marketsRes.markets.length === 0) {
    return { alerts: [], fetchedAt: new Date().toISOString() };
  }

  const alerts: PolymarketWhaleAlert[] = [];
  const marketMap = new Map(marketsRes.markets.map((m) => [m.conditionId, m]));

  // Fetch trades for top markets in parallel
  const tradeResults = await Promise.all(
    marketsRes.markets
      .slice(0, 5)
      .map((m) => getRecentTrades(m.conditionId, 50)),
  );

  for (const trades of tradeResults) {
    for (const trade of trades) {
      if (trade.size < WHALE_THRESHOLD_SIZE) continue;

      const market = marketMap.get(trade.conditionId);
      alerts.push({
        id: `whale-poly-${trade.id}`,
        conditionId: trade.conditionId,
        marketQuestion: market?.question ?? trade.conditionId,
        category: market?.category ?? "unknown",
        side: trade.side,
        size: trade.size,
        price: trade.price,
        alertType: trade.size >= WHALE_THRESHOLD_SIZE ? "absolute" : "notional",
        detectedAt: new Date().toISOString(),
      });
    }
  }

  return { alerts, fetchedAt: new Date().toISOString() };
}

// ── Factory export ──────────────────────────────────────────────────────────

export function createPolymarketService() {
  return {
    getMarkets,
    getMarketBySlug,
    searchMarkets,
    getRecentTrades,
    getWhaleAlerts,
  };
}
