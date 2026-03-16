// [claude-code 2026-03-16] Kalshi whale tracker service — RSA-PSS auth, market polling, whale detection
import crypto from 'node:crypto'
import type {
  KalshiRawTrade, KalshiRawMarket, KalshiRawEvent,
  KalshiMarket, KalshiTrade, WhaleAlert, WhaleAlertType,
  KalshiMarketsResponse, KalshiWhaleResponse,
} from '../types/kalshi.js'

const BASE_URL = 'https://api.elections.kalshi.com/trade-api/v2'

// ── Cache config ────────────────────────────────────────────────────────────
const MARKETS_CACHE_TTL = 5 * 60_000   // 5 minutes
const WHALE_CACHE_TTL = 90_000          // 90 seconds

// ── Whale thresholds ────────────────────────────────────────────────────────
const WHALE_MIN_CONTRACTS = 500
const WHALE_MIN_NOTIONAL = 500          // $500
const WHALE_OI_PERCENT = 0.05           // 5% of open interest
const CLUSTER_WINDOW_MS = 5 * 60_000    // 5-minute window
const CLUSTER_MIN_TRADES = 3

// ── Macro keyword filter (matches polymarket-service pattern) ───────────────
const MACRO_KEYWORDS = [
  'fed', 'fomc', 'inflation', 'cpi', 'ppi', 'election', 'recession', 'rate',
  'nfp', 'gdp', 'tariff', 'war', 'sanction', 'nato', 'china', 'russia',
  'iran', 'opec', 'debt ceiling', 'government shutdown', 'geopolitic',
  'treasury', 'unemployment', 'jobs', 'housing', 'pce', 'consumer',
  'trump', 'biden', 'congress', 'senate', 'scotus', 'impeach',
]

// ── Target categories ───────────────────────────────────────────────────────
const TARGET_CATEGORIES = ['Economics', 'Politics', 'Financials']

// ── Internal state ──────────────────────────────────────────────────────────
let marketsCache: { data: KalshiMarketsResponse; expires: number } | null = null
let whaleCache: { data: KalshiWhaleResponse; expires: number } | null = null
let lastTradePollTs: number = Date.now() - 10 * 60_000 // start 10min back

// ── RSA-PSS Signing ─────────────────────────────────────────────────────────

function getCredentials() {
  const apiKey = process.env.KALSHI_API_KEY
  const rawKey = process.env.KALSHI_RSA_PRIVATE_KEY
  if (!apiKey || !rawKey) throw new Error('KALSHI_API_KEY and KALSHI_RSA_PRIVATE_KEY required')
  const privateKey = rawKey.replace(/\\n/g, '\n')
  return { apiKey, privateKey }
}

function signRequest(method: string, path: string): Record<string, string> {
  const { apiKey, privateKey } = getCredentials()
  const ts = Date.now().toString()
  const message = ts + method.toUpperCase() + path

  const signature = crypto.sign('sha256', Buffer.from(message), {
    key: privateKey,
    padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
    saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST,
  }).toString('base64')

  return {
    'KALSHI-ACCESS-KEY': apiKey,
    'KALSHI-ACCESS-TIMESTAMP': ts,
    'KALSHI-ACCESS-SIGNATURE': signature,
    'Content-Type': 'application/json',
  }
}

async function kalshiFetch<T>(method: string, path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(BASE_URL + path)
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  const headers = signRequest(method, path)
  const resp = await fetch(url.toString(), { method, headers })
  if (!resp.ok) {
    const body = await resp.text().catch(() => '')
    throw new Error(`Kalshi ${method} ${path} failed: ${resp.status} ${body}`)
  }
  return resp.json() as Promise<T>
}

// ── Normalization ───────────────────────────────────────────────────────────

function normalizeMarket(raw: KalshiRawMarket, category: string): KalshiMarket {
  return {
    ticker: raw.ticker,
    eventTicker: raw.event_ticker,
    title: raw.title || raw.ticker,
    category,
    status: raw.status as KalshiMarket['status'],
    lastPrice: parseFloat(raw.last_price_dollars) || 0,
    volume24h: parseFloat(raw.volume_24h_fp) || 0,
    openInterest: parseFloat(raw.open_interest_fp) || 0,
    closeTime: raw.close_time || undefined,
    url: `https://kalshi.com/markets/${raw.ticker}`,
  }
}

function normalizeTrade(raw: KalshiRawTrade): KalshiTrade {
  const contracts = parseFloat(raw.count_fp) || 0
  const yesPrice = parseFloat(raw.yes_price_dollars) || 0
  const noPrice = parseFloat(raw.no_price_dollars) || 0
  const takerPrice = raw.taker_side === 'yes' ? yesPrice : noPrice
  return {
    tradeId: raw.trade_id,
    ticker: raw.ticker,
    contracts,
    yesPrice,
    noPrice,
    takerSide: raw.taker_side,
    notionalUsd: contracts * takerPrice,
    createdAt: raw.created_time,
  }
}

// ── Market Fetching ─────────────────────────────────────────────────────────

async function fetchMarketsForCategory(category: string): Promise<KalshiMarket[]> {
  const resp = await kalshiFetch<{ events: KalshiRawEvent[] }>('GET', '/events', {
    category,
    status: 'open',
    with_nested_markets: 'true',
    limit: '200',
  })
  const markets: KalshiMarket[] = []
  for (const event of resp.events || []) {
    for (const m of event.markets || []) {
      if (m.status === 'open') {
        markets.push(normalizeMarket(m, event.category || category))
      }
    }
  }
  return markets
}

export async function fetchKalshiMarkets(): Promise<KalshiMarketsResponse> {
  if (marketsCache && Date.now() < marketsCache.expires) return marketsCache.data

  const batches = await Promise.all(
    TARGET_CATEGORIES.map(cat => fetchMarketsForCategory(cat).catch(() => [] as KalshiMarket[]))
  )
  let markets = batches.flat()

  // For Politics category, further filter to macro-relevant titles
  markets = markets.filter(m => {
    if (m.category === 'Economics' || m.category === 'Financials') return true
    const lower = m.title.toLowerCase()
    return MACRO_KEYWORDS.some(kw => lower.includes(kw))
  })

  // Sort by 24h volume descending
  markets.sort((a, b) => b.volume24h - a.volume24h)

  const data: KalshiMarketsResponse = { markets, fetchedAt: new Date().toISOString() }
  marketsCache = { data, expires: Date.now() + MARKETS_CACHE_TTL }
  return data
}

// ── Trade Fetching + Whale Detection ────────────────────────────────────────

function runWhaleDetection(trades: KalshiTrade[], marketsMap: Map<string, KalshiMarket>): WhaleAlert[] {
  const alerts: WhaleAlert[] = []
  const clusterAccum = new Map<string, { trades: KalshiTrade[]; windowStart: number }>()
  const now = new Date().toISOString()

  for (const trade of trades) {
    const market = marketsMap.get(trade.ticker)
    const alertTypes: WhaleAlertType[] = []

    // Absolute threshold
    if (trade.contracts >= WHALE_MIN_CONTRACTS) alertTypes.push('absolute')
    // Notional threshold
    if (trade.notionalUsd >= WHALE_MIN_NOTIONAL) alertTypes.push('notional')
    // Relative to OI
    if (market && market.openInterest > 0 && trade.contracts / market.openInterest >= WHALE_OI_PERCENT) {
      alertTypes.push('relative')
    }

    const isLarge = alertTypes.length > 0

    // Cluster accumulation
    if (isLarge) {
      const tradeTs = new Date(trade.createdAt).getTime()
      const existing = clusterAccum.get(trade.ticker)
      if (existing && tradeTs - existing.windowStart <= CLUSTER_WINDOW_MS) {
        existing.trades.push(trade)
      } else {
        clusterAccum.set(trade.ticker, { trades: [trade], windowStart: tradeTs })
      }
    }

    if (isLarge) {
      alerts.push({
        id: `whale-${trade.tradeId}`,
        ticker: trade.ticker,
        marketTitle: market?.title || trade.ticker,
        category: market?.category || 'Unknown',
        contracts: trade.contracts,
        notionalUsd: trade.notionalUsd,
        takerSide: trade.takerSide,
        lastPrice: market?.lastPrice || trade.yesPrice,
        alertTypes,
        openInterest: market?.openInterest,
        createdAt: trade.createdAt,
        detectedAt: now,
      })
    }
  }

  // Emit cluster alerts
  for (const [ticker, { trades: clusterTrades, windowStart }] of clusterAccum) {
    if (clusterTrades.length >= CLUSTER_MIN_TRADES) {
      const market = marketsMap.get(ticker)
      const totalContracts = clusterTrades.reduce((s, t) => s + t.contracts, 0)
      const totalNotional = clusterTrades.reduce((s, t) => s + t.notionalUsd, 0)
      const dominantSide = clusterTrades.filter(t => t.takerSide === 'yes').length >= clusterTrades.length / 2 ? 'yes' : 'no'
      alerts.push({
        id: `whale-cluster-${ticker}-${windowStart}`,
        ticker,
        marketTitle: market?.title || ticker,
        category: market?.category || 'Unknown',
        contracts: totalContracts,
        notionalUsd: totalNotional,
        takerSide: dominantSide,
        lastPrice: market?.lastPrice || 0,
        alertTypes: ['cluster'],
        openInterest: market?.openInterest,
        clusterSize: clusterTrades.length,
        createdAt: new Date(windowStart).toISOString(),
        detectedAt: now,
      })
    }
  }

  // Sort by notional descending
  alerts.sort((a, b) => b.notionalUsd - a.notionalUsd)
  return alerts
}

export async function fetchKalshiWhales(): Promise<KalshiWhaleResponse> {
  if (whaleCache && Date.now() < whaleCache.expires) return whaleCache.data

  const marketsResp = await fetchKalshiMarkets()
  const marketsMap = new Map(marketsResp.markets.map(m => [m.ticker, m]))
  const targetTickers = new Set(marketsResp.markets.map(m => m.ticker))

  // Fetch recent trades
  const minTs = Math.floor(lastTradePollTs / 1000) // Kalshi uses seconds for min_ts
  let allTrades: KalshiTrade[] = []
  let cursor: string | undefined

  // Paginate through trades (max 3 pages to avoid rate limits)
  for (let page = 0; page < 3; page++) {
    const params: Record<string, string> = { min_ts: minTs.toString(), limit: '1000' }
    if (cursor) params.cursor = cursor

    const resp = await kalshiFetch<{ trades: KalshiRawTrade[]; cursor?: string }>(
      'GET', '/markets/trades', params
    )
    const trades = (resp.trades || []).map(normalizeTrade)
    // Filter to our target macro markets
    const relevant = trades.filter(t => targetTickers.has(t.ticker))
    allTrades.push(...relevant)

    cursor = resp.cursor
    if (!cursor || (resp.trades || []).length < 1000) break
  }

  lastTradePollTs = Date.now()
  const whaleAlerts = runWhaleDetection(allTrades, marketsMap)

  const data: KalshiWhaleResponse = {
    alerts: whaleAlerts,
    markets: marketsResp.markets,
    lastTradeFetchedAt: new Date().toISOString(),
  }
  whaleCache = { data, expires: Date.now() + WHALE_CACHE_TTL }
  return data
}

/** Get whale alerts since a given timestamp (for incremental feed polling) */
export function getWhaleAlertsSince(isoTimestamp: string): WhaleAlert[] {
  if (!whaleCache) return []
  const cutoff = new Date(isoTimestamp).getTime()
  return whaleCache.data.alerts.filter(a => new Date(a.detectedAt).getTime() > cutoff)
}

/** Force cache clear for sync endpoint */
export function clearKalshiCache(): void {
  marketsCache = null
  whaleCache = null
}
