// [claude-code 2026-03-11] Unified Context Bank types — shared snapshot for all PIC agents
// All agents consume the same versioned snapshot to guarantee sync.

import type { VixRegime } from './volatility-taxonomy.js'

// ── Context Bank Snapshot ────────────────────────────────────────────────────

export interface ContextBankSnapshot {
  /** Incrementing version number */
  version: number
  /** ISO timestamp of snapshot generation */
  generatedAt: string
  /** Snapshot staleness in seconds (computed at serve time) */
  ageSeconds: number

  /** IV Score + Point Estimates per instrument (/ES, /NQ) */
  ivScores: Record<string, InstrumentIVContext>

  /** VIX state */
  vix: VIXContext

  /** Systemic risk assessment */
  systemic: SystemicContext

  /** Breaking headlines (last 2h, macro level 3+) */
  breakingHeadlines: BreakingHeadline[]

  /** Today's economic calendar + surprise prints */
  econCalendar: EconCalendarContext

  /** Active trade ideas + P&L summary */
  tradeIdeas: TradeIdeasContext

  /** FRED macro indicators */
  fred: FredContext

  /** Polymarket prediction market odds */
  polymarket: PolymarketContext

  /** Kalshi prediction market whale flow + macro odds */
  kalshi: KalshiContext

  /** Latest desk reports (one per desk, most recent) */
  deskReports: DeskReportSummary[]
}

export interface InstrumentIVContext {
  instrument: string
  /** Blended score 0-10 */
  score: number
  vixComponent: number
  headlineComponent: number
  points: {
    scaledPoints: number
    scaledTicks: number
    scaledDollarRisk: number
    urgency: string
  }
  systemic?: {
    overlay: number
    activeChains: number
  }
  computedAt: string
}

export interface VIXContext {
  level: number
  percentChange: number
  isSpike: boolean
  spikeDirection: 'up' | 'down' | 'none'
  regime: VixRegime
  staleMinutes: number
}

export interface SystemicContext {
  /** Overall systemic risk 0-10 */
  score: number
  /** IV overlay pts (0-2.5) */
  ivOverlay: number
  activeChains: number
  rhymeMatches: number
  creditSignals: number
  topRhyme?: {
    crisisName: string
    crisisYear: number
    matchScore: number
  }
  rationale: string[]
  timestamp: string
}

export interface BreakingHeadline {
  id: string
  headline: string
  source: string
  macroLevel: number
  ivScore: number
  publishedAt: string
  symbols: string[]
}

export interface EconCalendarContext {
  events: EconEventSummary[]
  surprises: EconSurprise[]
}

export interface EconEventSummary {
  name: string
  time?: string
  importance: number
  forecast?: string
  previous?: string
  actual?: string
}

export interface EconSurprise {
  name: string
  actual: string
  forecast: string
  direction: 'beat' | 'miss'
}

export interface TradeIdeasContext {
  active: TradeIdeaSummary[]
  pnlSummary: {
    todayPnl?: number
    winRate?: number
    tradesCount?: number
  }
}

export interface TradeIdeaSummary {
  id: string
  title: string
  ticker: string
  direction: 'long' | 'short' | 'neutral'
  confidence?: string
  entry?: number
  sourceAgent?: string
}

export interface FredContext {
  hyOasSpread?: number
  yieldCurve2s10s?: number
  yieldCurve3m10y?: number
  tedSpread?: number
  fedFundsRate?: number
  fetchedAt?: string
}

export interface PolymarketContext {
  markets: PolymarketMarketSummary[]
  fetchedAt: string
}

export interface PolymarketMarketSummary {
  id: string
  title: string
  probability: number
  outcome: string
  closeTime?: string
}

export interface KalshiContext {
  topMarkets: KalshiMarketSummary[]
  recentWhales: WhaleAlertSummary[]
  fetchedAt: string
}

export interface KalshiMarketSummary {
  ticker: string
  title: string
  lastPrice: number
  volume24h: number
  closeTime?: string
}

export interface WhaleAlertSummary {
  id: string
  ticker: string
  marketTitle: string
  contracts: number
  notionalUsd: number
  takerSide: 'yes' | 'no'
  alertTypes: string[]
  createdAt: string
}

// ── Desk Reports ─────────────────────────────────────────────────────────────

// [claude-code 2026-03-16] Agent backend v7.9: updated desk IDs and agent names
export type DeskId = 'fundamentals' | 'futures' | 'pma-merged' | 'news-sentiment'
export type AgentName = 'Harper-Opus' | 'Oracle' | 'Feucht' | 'Consul' | 'Herald'

export const VALID_DESKS: DeskId[] = ['fundamentals', 'futures', 'pma-merged', 'news-sentiment']
export const VALID_AGENTS: AgentName[] = ['Harper-Opus', 'Oracle', 'Feucht', 'Consul', 'Herald']

export interface DeskAlert {
  severity: 'info' | 'warning' | 'critical'
  title: string
  detail: string
  instruments?: string[]
  timestamp: string
}

export interface DeskTradeIdea {
  instrument: string
  direction: 'long' | 'short'
  entry?: number
  stop?: number
  target?: number
  thesis: string
  conviction: 'low' | 'medium' | 'high' | 'max'
  timeframe?: string
}

export interface DeskRiskFlag {
  type: 'correlation' | 'concentration' | 'regime' | 'exposure' | 'drawdown'
  severity: 'low' | 'medium' | 'high' | 'critical'
  description: string
  affectedInstruments: string[]
}

export interface DeskReport {
  id: string
  desk: DeskId
  agent: AgentName
  snapshotVersion: number
  timestamp: string
  summary: string
  alerts: DeskAlert[]
  tradeIdeas?: DeskTradeIdea[]
  riskFlags?: DeskRiskFlag[]
  confidence: number // 0-100
  metadata?: Record<string, unknown>
}

export interface DeskReportSummary {
  desk: DeskId
  agent: AgentName
  snapshotVersion: number
  timestamp: string
  summary: string
  alertCount: number
  confidence: number
}

// ── Consolidated Brief ───────────────────────────────────────────────────────

export interface ConsolidatedBrief {
  id: string
  generatedAt: string
  snapshotVersion: number
  executiveSummary: string
  topAlerts: DeskAlert[]
  topTradeIdeas: DeskTradeIdea[]
  riskMatrix: DeskRiskFlag[]
  approvalQueue: DeskTradeIdea[]
  deskReportIds: string[]
}
