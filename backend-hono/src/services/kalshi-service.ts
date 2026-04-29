// [claude-code 2026-03-20] 8b: Kalshi prediction market service — positions, market data, execution
import type {
  KalshiRawTrade,
  KalshiRawMarket,
  KalshiRawEvent,
  KalshiMarket,
  KalshiTrade,
  WhaleAlert,
  KalshiMarketsResponse,
  KalshiWhaleResponse,
} from "../types/kalshi.js";

const KALSHI_API_BASE =
  process.env.KALSHI_API_URL || "https://trading-api.kalshi.com/trade-api/v2";
const WHALE_THRESHOLD_CONTRACTS = 100;
const WHALE_THRESHOLD_NOTIONAL = 5000; // USD
const CLUSTER_WINDOW_MS = 60_000;

// [claude-code 2026-04-28] S48-T2: Econ & Politics category filter for RiskFlow pipe.
const ECON_POLITICS_CATS = new Set([
  "economics",
  "politics",
  "monetary-policy",
  "fiscal",
  "federal-reserve",
  "interest-rates",
  "inflation",
  "employment",
  "trade-policy",
  "tariffs",
  "regulation",
  "geopolitical",
  "election",
  "treasury",
  "tax",
  "budget",
  "deficit",
  "energy",
  "oil",
]);
const EXCLUDED_CATS = new Set([
  "weather",
  "crypto",
  "cryptocurrency",
  "entertainment",
  "sports",
  "memes",
  "celebrity",
  "music",
  "tv",
  "movie",
  "gaming",
]);

interface KalshiCredentials {
  email: string;
  password: string;
  token?: string;
  tokenExpiresAt?: number;
}

let credentials: KalshiCredentials | null = null;

function getCredentials(): KalshiCredentials | null {
  if (credentials) return credentials;
  const email = process.env.KALSHI_EMAIL;
  const password = process.env.KALSHI_PASSWORD;
  if (email && password) {
    credentials = { email, password };
    return credentials;
  }
  return null;
}

async function getAuthToken(): Promise<string | null> {
  const creds = getCredentials();
  if (!creds) return null;

  // Return cached token if still valid (with 5min buffer)
  if (
    creds.token &&
    creds.tokenExpiresAt &&
    Date.now() < creds.tokenExpiresAt - 300_000
  ) {
    return creds.token;
  }

  try {
    const res = await fetch(`${KALSHI_API_BASE}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: creds.email, password: creds.password }),
    });
    if (!res.ok) {
      console.error(`[Kalshi] Auth failed: ${res.status}`);
      return null;
    }
    const data = (await res.json()) as { token: string; member_id: string };
    creds.token = data.token;
    creds.tokenExpiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24h
    return data.token;
  } catch (err) {
    console.error("[Kalshi] Auth error:", err);
    return null;
  }
}

async function kalshiFetch<T>(
  path: string,
  options?: RequestInit,
): Promise<T | null> {
  const token = await getAuthToken();
  if (!token) return null;

  try {
    const res = await fetch(`${KALSHI_API_BASE}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...options?.headers,
      },
    });
    if (!res.ok) {
      console.error(`[Kalshi] ${path} failed: ${res.status}`);
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    console.error(`[Kalshi] ${path} error:`, err);
    return null;
  }
}

function normalizeMarket(raw: KalshiRawMarket): KalshiMarket {
  return {
    ticker: raw.ticker,
    eventTicker: raw.event_ticker,
    title: raw.title,
    category: raw.market_type,
    status: raw.status as "open" | "closed" | "settled",
    lastPrice: parseFloat(raw.last_price_dollars),
    volume24h: parseFloat(raw.volume_24h_fp),
    openInterest: parseFloat(raw.open_interest_fp),
    closeTime: raw.close_time,
    url: `https://kalshi.com/markets/${raw.ticker}`,
  };
}

function normalizeTrade(raw: KalshiRawTrade): KalshiTrade {
  const contracts = Math.round(parseFloat(raw.count_fp));
  const yesPrice = parseFloat(raw.yes_price_dollars);
  const noPrice = parseFloat(raw.no_price_dollars);
  const takerPrice = raw.taker_side === "yes" ? yesPrice : noPrice;

  return {
    tradeId: raw.trade_id,
    ticker: raw.ticker,
    contracts,
    yesPrice,
    noPrice,
    takerSide: raw.taker_side,
    notionalUsd: contracts * takerPrice,
    createdAt: raw.created_time,
  };
}

function detectWhales(
  trades: KalshiTrade[],
  markets: KalshiMarket[],
): WhaleAlert[] {
  const alerts: WhaleAlert[] = [];
  const marketMap = new Map(markets.map((m) => [m.ticker, m]));

  for (const trade of trades) {
    const alertTypes: WhaleAlert["alertTypes"] = [];

    if (trade.contracts >= WHALE_THRESHOLD_CONTRACTS)
      alertTypes.push("absolute");
    if (trade.notionalUsd >= WHALE_THRESHOLD_NOTIONAL)
      alertTypes.push("notional");

    if (alertTypes.length === 0) continue;

    const market = marketMap.get(trade.ticker);
    alerts.push({
      id: `whale-${trade.tradeId}`,
      ticker: trade.ticker,
      marketTitle: market?.title ?? trade.ticker,
      category: market?.category ?? "unknown",
      contracts: trade.contracts,
      notionalUsd: trade.notionalUsd,
      takerSide: trade.takerSide,
      lastPrice: market?.lastPrice ?? 0,
      alertTypes,
      openInterest: market?.openInterest,
      createdAt: trade.createdAt,
      detectedAt: new Date().toISOString(),
    });
  }

  return alerts;
}

export function createKalshiService() {
  return {
    async getMarkets(category?: string): Promise<KalshiMarketsResponse> {
      const params = new URLSearchParams({ limit: "50", status: "open" });
      if (category) params.set("series_ticker", category);

      const data = await kalshiFetch<{ markets: KalshiRawMarket[] }>(
        `/markets?${params}`,
      );
      return {
        markets: data?.markets?.map(normalizeMarket) ?? [],
        fetchedAt: new Date().toISOString(),
      };
    },

    async getRecentTrades(ticker?: string): Promise<KalshiTrade[]> {
      const params = new URLSearchParams({ limit: "100" });
      if (ticker) params.set("ticker", ticker);

      const data = await kalshiFetch<{ trades: KalshiRawTrade[] }>(
        `/markets/trades?${params}`,
      );
      return data?.trades?.map(normalizeTrade) ?? [];
    },

    async getWhaleAlerts(): Promise<KalshiWhaleResponse> {
      const [marketsRes, trades] = await Promise.all([
        this.getMarkets(),
        this.getRecentTrades(),
      ]);

      const alerts = detectWhales(trades, marketsRes.markets);
      return {
        alerts,
        markets: marketsRes.markets,
        lastTradeFetchedAt: new Date().toISOString(),
      };
    },

    async getEconPoliticsWhaleAlerts(): Promise<KalshiWhaleResponse> {
      const { alerts, markets, lastTradeFetchedAt } =
        await this.getWhaleAlerts();

      const filtered = alerts.filter((a) => {
        const cat = a.category?.toLowerCase();
        if (!cat) return false;
        if (EXCLUDED_CATS.has(cat)) return false;
        if (ECON_POLITICS_CATS.has(cat)) return true;
        for (const kw of ECON_POLITICS_CATS) {
          if (cat.includes(kw)) return true;
        }
        return false;
      });

      return { alerts: filtered, markets, lastTradeFetchedAt };
    },

    /** Place an order (agentic mode). Returns order ID or null on failure. */
    async placeOrder(params: {
      ticker: string;
      side: "yes" | "no";
      contracts: number;
      limitPrice?: number;
    }): Promise<{ orderId: string } | null> {
      const body: Record<string, unknown> = {
        ticker: params.ticker,
        action: "buy",
        side: params.side,
        count: params.contracts,
        type: params.limitPrice ? "limit" : "market",
      };
      if (params.limitPrice)
        body.yes_price = Math.round(params.limitPrice * 100);

      const data = await kalshiFetch<{ order: { order_id: string } }>(
        "/portfolio/orders",
        {
          method: "POST",
          body: JSON.stringify(body),
        },
      );
      return data?.order ? { orderId: data.order.order_id } : null;
    },

    /** Get current positions */
    async getPositions(): Promise<
      Array<{
        ticker: string;
        side: "yes" | "no";
        contracts: number;
        avgPrice: number;
        marketTitle?: string;
      }>
    > {
      const data = await kalshiFetch<{
        market_positions: Array<{
          ticker: string;
          position: number;
          market_exposure: number;
          realized_pnl: number;
        }>;
      }>("/portfolio/positions");

      if (!data?.market_positions) return [];

      return data.market_positions
        .filter((p) => p.position !== 0)
        .map((p) => ({
          ticker: p.ticker,
          side: p.position > 0 ? ("yes" as const) : ("no" as const),
          contracts: Math.abs(p.position),
          avgPrice: p.market_exposure / Math.abs(p.position) || 0,
        }));
    },

    isConfigured(): boolean {
      return !!(process.env.KALSHI_EMAIL && process.env.KALSHI_PASSWORD);
    },
  };
}
