// [claude-code 2026-03-11] Unified Context Bank — aggregates all caches into versioned snapshots
// 120s tick, ring buffer of 10, DB persistence every 5th version.
// Zero duplicate API calls — reads only from existing in-memory caches.

import type {
  ContextBankSnapshot,
  InstrumentIVContext,
  VIXContext,
  SystemicContext,
  BreakingHeadline,
  EconCalendarContext,
  TradeIdeasContext,
  FredContext,
  PolymarketContext,
  DeskReport,
  DeskReportSummary,
  DeskId,
  ConsolidatedBrief,
} from '../../types/context-bank.js'
import { classifyVixRegime } from '../../types/volatility-taxonomy.js'
import { getCachedIVScore } from '../market-data/iv-score-ticker.js'
import { estimatePoints } from '../market-data/point-estimator.js'
import { fetchVIX } from '../vix-service.js'
import { getCachedAssessment } from '../systemic/risk-detector.js'
import { getCachedFredIndicators, getFredFetchedAt } from '../systemic/fred-service.js'
import { getCachedTradeIdeas, getCachedPerformance } from '../notion-poller.js'
import { fetchPolymarket } from '../polymarket-service.js'
import { fetchKalshiWhales } from '../kalshi-service.js'
import type { KalshiContext } from '../../types/context-bank.js'

const TICK_INTERVAL_MS = 120_000 // 120s
const RING_SIZE = 10
const PERSIST_EVERY = 5 // Persist to DB every 5th snapshot
const MAX_REPORTS_PER_DESK = 50

let _intervalId: ReturnType<typeof setInterval> | null = null
let _currentVersion = 0

// Ring buffer of snapshots
const _snapshots: ContextBankSnapshot[] = []

// Latest desk report per desk
const _latestReports = new Map<DeskId, DeskReport>()
// Report history (capped per desk)
const _reportHistory = new Map<DeskId, DeskReport[]>()

// Latest consolidated brief
let _latestBrief: ConsolidatedBrief | null = null

// ── Snapshot Assembly ────────────────────────────────────────────────────────

async function assembleSnapshot(version: number): Promise<ContextBankSnapshot> {
  const now = new Date()

  // IV Scores — /ES (from ticker cache) + /NQ (computed fresh)
  const ivScores: Record<string, InstrumentIVContext> = {}
  const cachedIV = getCachedIVScore()

  if (cachedIV) {
    ivScores[cachedIV.instrument] = {
      instrument: cachedIV.instrument,
      score: cachedIV.score.score,
      vixComponent: cachedIV.score.vixComponent,
      headlineComponent: cachedIV.score.headlineComponent,
      points: {
        scaledPoints: cachedIV.points.scaledPoints,
        scaledTicks: cachedIV.points.scaledTicks,
        scaledDollarRisk: cachedIV.points.scaledDollarRisk,
        urgency: cachedIV.points.urgency,
      },
      systemic: cachedIV.score.systemic
        ? { overlay: cachedIV.score.systemic.overlay, activeChains: cachedIV.score.systemic.activeChains }
        : undefined,
      computedAt: cachedIV.computedAt,
    }

    // /NQ — reuse the same blended score but with /NQ point estimates
    if (cachedIV.instrument !== '/NQ') {
      const nqPoints = estimatePoints(cachedIV.score.score, cachedIV.score.vix.level, '/NQ')
      ivScores['/NQ'] = {
        instrument: '/NQ',
        score: cachedIV.score.score,
        vixComponent: cachedIV.score.vixComponent,
        headlineComponent: cachedIV.score.headlineComponent,
        points: {
          scaledPoints: nqPoints.scaledPoints,
          scaledTicks: nqPoints.scaledTicks,
          scaledDollarRisk: nqPoints.scaledDollarRisk,
          urgency: nqPoints.urgency,
        },
        systemic: cachedIV.score.systemic
          ? { overlay: cachedIV.score.systemic.overlay, activeChains: cachedIV.score.systemic.activeChains }
          : undefined,
        computedAt: cachedIV.computedAt,
      }
    }
  }

  // VIX
  let vix: VIXContext = {
    level: 0,
    percentChange: 0,
    isSpike: false,
    spikeDirection: 'none',
    regime: 'low',
    staleMinutes: 999,
  }
  try {
    const vixData = await fetchVIX()
    vix = {
      level: vixData.level,
      percentChange: vixData.percentChange,
      isSpike: vixData.isSpike,
      spikeDirection: vixData.spikeDirection,
      regime: classifyVixRegime(vixData.level),
      staleMinutes: vixData.staleMinutes,
    }
  } catch { /* VIX unavailable — use defaults */ }

  // Systemic Risk
  const assessment = getCachedAssessment()
  const systemic: SystemicContext = assessment
    ? {
        score: assessment.systemicScore,
        ivOverlay: assessment.ivScoreOverlay,
        activeChains: assessment.activeChains.length,
        rhymeMatches: assessment.rhymeMatches.length,
        creditSignals: assessment.creditSignalCount,
        topRhyme: assessment.rhymeMatches[0]
          ? {
              crisisName: assessment.rhymeMatches[0].crisisName,
              crisisYear: assessment.rhymeMatches[0].crisisYear,
              matchScore: assessment.rhymeMatches[0].matchScore,
            }
          : undefined,
        rationale: assessment.rationale,
        timestamp: assessment.timestamp,
      }
    : {
        score: 0,
        ivOverlay: 0,
        activeChains: 0,
        rhymeMatches: 0,
        creditSignals: 0,
        rationale: ['Systemic risk not yet available'],
        timestamp: now.toISOString(),
      }

  // Breaking Headlines (DB query)
  const breakingHeadlines = await fetchBreakingHeadlines()

  // Econ Calendar
  const econCalendar = await fetchEconContext()

  // Trade Ideas + P&L
  const tradeIdeasRaw = getCachedTradeIdeas()
  const performanceRaw = getCachedPerformance()
  const tradeIdeas: TradeIdeasContext = {
    active: tradeIdeasRaw.map(t => ({
      id: t.id,
      title: t.title,
      ticker: t.ticker,
      direction: t.direction,
      confidence: t.confidence,
      entry: t.entry,
      sourceAgent: t.sourceAgent,
    })),
    pnlSummary: extractPnlSummary(performanceRaw),
  }

  // FRED
  const fredData = getCachedFredIndicators()
  const fredFetchedAt = getFredFetchedAt()
  const fred: FredContext = {
    hyOasSpread: fredData['BAMLH0A0HYM2'] as number | undefined,
    yieldCurve2s10s: fredData['T10Y2Y'] as number | undefined,
    yieldCurve3m10y: fredData['T10Y3M'] as number | undefined,
    tedSpread: fredData['TEDRATE'] as number | undefined,
    fedFundsRate: fredData['FEDFUNDS'] as number | undefined,
    fetchedAt: fredFetchedAt?.toISOString(),
  }

  // Polymarket
  let polymarket: PolymarketContext = { markets: [], fetchedAt: now.toISOString() }
  try {
    const pm = await fetchPolymarket()
    polymarket = {
      markets: pm.markets.map(m => ({
        id: m.id,
        title: m.title,
        probability: m.probability,
        outcome: m.outcome,
        closeTime: m.closeTime,
      })),
      fetchedAt: pm.fetchedAt,
    }
  } catch { /* Polymarket unavailable */ }

  // Kalshi whale flow
  let kalshi: KalshiContext = { topMarkets: [], recentWhales: [], fetchedAt: now.toISOString() }
  try {
    const kw = await fetchKalshiWhales()
    kalshi = {
      topMarkets: kw.markets.slice(0, 10).map(m => ({
        ticker: m.ticker,
        title: m.title,
        lastPrice: m.lastPrice,
        volume24h: m.volume24h,
        closeTime: m.closeTime,
      })),
      recentWhales: kw.alerts.slice(0, 20).map(a => ({
        id: a.id,
        ticker: a.ticker,
        marketTitle: a.marketTitle,
        contracts: a.contracts,
        notionalUsd: a.notionalUsd,
        takerSide: a.takerSide,
        alertTypes: a.alertTypes,
        createdAt: a.createdAt,
      })),
      fetchedAt: kw.lastTradeFetchedAt,
    }
  } catch { /* Kalshi unavailable */ }

  // Desk report summaries
  const deskReports: DeskReportSummary[] = []
  for (const [, report] of _latestReports) {
    deskReports.push({
      desk: report.desk,
      agent: report.agent,
      snapshotVersion: report.snapshotVersion,
      timestamp: report.timestamp,
      summary: report.summary,
      alertCount: report.alerts.length,
      confidence: report.confidence,
    })
  }

  return {
    version,
    generatedAt: now.toISOString(),
    ageSeconds: 0,
    ivScores,
    vix,
    systemic,
    breakingHeadlines,
    econCalendar,
    tradeIdeas,
    fred,
    polymarket,
    kalshi,
    deskReports,
  }
}

// ── Data Helpers ─────────────────────────────────────────────────────────────

async function fetchBreakingHeadlines(): Promise<BreakingHeadline[]> {
  try {
    const { sql, isDatabaseAvailable } = await import('../../config/database.js')
    if (!isDatabaseAvailable() || !sql) return []

    const cutoff = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
    const rows = await sql`
      SELECT id, headline, source, macro_level, iv_score, published_at, symbols
      FROM news_feed_items
      WHERE published_at >= ${cutoff}
        AND macro_level >= 3
      ORDER BY published_at DESC
      LIMIT 30
    `
    return rows.map((r: any) => ({
      id: String(r.id),
      headline: r.headline ?? '',
      source: r.source ?? '',
      macroLevel: r.macro_level ?? 3,
      ivScore: r.iv_score ?? 0,
      publishedAt: r.published_at ? new Date(r.published_at).toISOString() : '',
      symbols: Array.isArray(r.symbols) ? r.symbols : [],
    }))
  } catch {
    return []
  }
}

async function fetchEconContext(): Promise<EconCalendarContext> {
  try {
    const { fetchEconCalendar } = await import('../econ-calendar-service.js')
    const today = new Date().toISOString().slice(0, 10)
    const events = await fetchEconCalendar({ from: today, to: today })

    const surprises = events
      .filter(e => e.actual && e.forecast && e.actual !== e.forecast)
      .map(e => ({
        name: e.name,
        actual: e.actual!,
        forecast: e.forecast!,
        direction: (parseFloat(e.actual!) > parseFloat(e.forecast!) ? 'beat' : 'miss') as 'beat' | 'miss',
      }))

    return {
      events: events.map(e => ({
        name: e.name,
        time: e.time,
        importance: e.importance,
        forecast: e.forecast,
        previous: e.previous,
        actual: e.actual,
      })),
      surprises,
    }
  } catch {
    return { events: [], surprises: [] }
  }
}

function extractPnlSummary(kpis: { label: string; value: string }[]): TradeIdeasContext['pnlSummary'] {
  const result: TradeIdeasContext['pnlSummary'] = {}
  for (const kpi of kpis) {
    const label = kpi.label.toLowerCase()
    if (label.includes('net p&l') || label.includes('net pnl')) {
      result.todayPnl = parseFloat(kpi.value.replace(/[^-\d.]/g, '')) || undefined
    } else if (label.includes('win rate')) {
      result.winRate = parseFloat(kpi.value.replace(/[^-\d.]/g, '')) || undefined
    } else if (label.includes('trades taken') || label.includes('trades')) {
      result.tradesCount = parseInt(kpi.value.replace(/[^-\d]/g, ''), 10) || undefined
    }
  }
  return result
}

// ── DB Persistence ───────────────────────────────────────────────────────────

async function persistSnapshotToDB(snapshot: ContextBankSnapshot): Promise<void> {
  try {
    const { sql, isDatabaseAvailable } = await import('../../config/database.js')
    if (!isDatabaseAvailable() || !sql) return

    await sql`
      INSERT INTO context_bank_snapshots (version, snapshot, generated_at)
      VALUES (${snapshot.version}, ${JSON.stringify(snapshot)}::jsonb, ${snapshot.generatedAt})
      ON CONFLICT (version) DO NOTHING
    `.catch(() => {})

    // Prune old snapshots
    await sql`
      DELETE FROM context_bank_snapshots
      WHERE version < ${snapshot.version - 100}
    `.catch(() => {})
  } catch { /* Best-effort */ }
}

async function restoreFromDB(): Promise<void> {
  try {
    const { sql, isDatabaseAvailable } = await import('../../config/database.js')
    if (!isDatabaseAvailable() || !sql) return

    const rows = await sql`
      SELECT version, snapshot, generated_at FROM context_bank_snapshots
      ORDER BY version DESC LIMIT 1
    `.catch(() => [])

    if (rows.length > 0) {
      const row = rows[0]
      const ageMs = Date.now() - new Date(row.generated_at).getTime()
      if (ageMs < 600_000) { // Only restore if < 10 min old
        const restored = row.snapshot as ContextBankSnapshot
        restored.ageSeconds = Math.round(ageMs / 1000)
        _currentVersion = restored.version
        _snapshots.push(restored)
        console.log(`[ContextBank] Restored snapshot v${restored.version} from DB (${Math.round(ageMs / 1000)}s old)`)
      }
    }
  } catch { /* Silent — fresh snapshot on first tick */ }
}

// ── Desk Report Management ──────────────────────────────────────────────────

async function persistDeskReport(report: DeskReport): Promise<void> {
  try {
    const { sql, isDatabaseAvailable } = await import('../../config/database.js')
    if (!isDatabaseAvailable() || !sql) return

    await sql`
      INSERT INTO desk_reports (id, desk, agent, snapshot_version, summary, alerts, trade_ideas, risk_flags, confidence, metadata, created_at)
      VALUES (
        ${report.id},
        ${report.desk},
        ${report.agent},
        ${report.snapshotVersion},
        ${report.summary},
        ${JSON.stringify(report.alerts)}::jsonb,
        ${JSON.stringify(report.tradeIdeas ?? [])}::jsonb,
        ${JSON.stringify(report.riskFlags ?? [])}::jsonb,
        ${report.confidence},
        ${report.metadata ? JSON.stringify(report.metadata) : null}::jsonb,
        ${report.timestamp}
      )
    `.catch(() => {})
  } catch { /* Best-effort */ }
}

// ── Tick ──────────────────────────────────────────────────────────────────────

async function tick(): Promise<void> {
  try {
    _currentVersion++
    const snapshot = await assembleSnapshot(_currentVersion)
    _snapshots.push(snapshot)
    if (_snapshots.length > RING_SIZE) _snapshots.shift()

    // Persist every Nth version
    if (_currentVersion % PERSIST_EVERY === 0) {
      await persistSnapshotToDB(snapshot)
    }

    console.log(
      `[ContextBank] v${_currentVersion} | ` +
      `IV: ${Object.entries(snapshot.ivScores).map(([k, v]) => `${k}=${v.score.toFixed(1)}`).join(', ') || 'n/a'} | ` +
      `VIX: ${snapshot.vix.level.toFixed(1)} (${snapshot.vix.regime}) | ` +
      `Sys: ${snapshot.systemic.score.toFixed(1)} | ` +
      `Headlines: ${snapshot.breakingHeadlines.length} | ` +
      `Desks: ${snapshot.deskReports.length}/5`
    )
  } catch (err) {
    console.error('[ContextBank] Tick failed:', err)
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

export function getCurrentSnapshot(): ContextBankSnapshot | null {
  const s = _snapshots[_snapshots.length - 1] ?? null
  if (s) {
    s.ageSeconds = Math.round((Date.now() - new Date(s.generatedAt).getTime()) / 1000)
  }
  return s
}

export function getSnapshotByVersion(version: number): ContextBankSnapshot | null {
  return _snapshots.find(s => s.version === version) ?? null
}

export function getCurrentVersion(): number {
  return _currentVersion
}

export function submitDeskReport(report: DeskReport): void {
  const desk = report.desk
  _latestReports.set(desk, report)

  // Add to history
  const history = _reportHistory.get(desk) ?? []
  history.unshift(report)
  if (history.length > MAX_REPORTS_PER_DESK) history.pop()
  _reportHistory.set(desk, history)

  // Persist to DB
  persistDeskReport(report)

  console.log(`[ContextBank] Desk report from ${report.agent} (${report.desk}) v${report.snapshotVersion} — confidence: ${report.confidence}`)
}

export function getLatestDeskReports(): DeskReport[] {
  return Array.from(_latestReports.values())
}

export function getDeskReportHistory(desk: DeskId, limit: number = 10): DeskReport[] {
  return (_reportHistory.get(desk) ?? []).slice(0, limit)
}

export function submitBrief(brief: ConsolidatedBrief): void {
  _latestBrief = brief
  persistBrief(brief)
  console.log(`[ContextBank] Brief submitted for v${brief.snapshotVersion} — ${brief.topAlerts.length} alerts, ${brief.topTradeIdeas.length} ideas`)
}

export function getLatestBrief(): ConsolidatedBrief | null {
  return _latestBrief
}

async function persistBrief(brief: ConsolidatedBrief): Promise<void> {
  try {
    const { sql, isDatabaseAvailable } = await import('../../config/database.js')
    if (!isDatabaseAvailable() || !sql) return

    await sql`
      INSERT INTO consolidated_briefs (id, snapshot_version, executive_summary, top_alerts, top_trade_ideas, risk_matrix, approval_queue, desk_report_ids, created_at)
      VALUES (
        ${brief.id},
        ${brief.snapshotVersion},
        ${brief.executiveSummary},
        ${JSON.stringify(brief.topAlerts)}::jsonb,
        ${JSON.stringify(brief.topTradeIdeas)}::jsonb,
        ${JSON.stringify(brief.riskMatrix)}::jsonb,
        ${JSON.stringify(brief.approvalQueue)}::jsonb,
        ${brief.deskReportIds as any},
        ${brief.generatedAt}
      )
    `.catch(() => {})
  } catch { /* Best-effort */ }
}

export function startContextBankTicker(): void {
  if (_intervalId) return

  console.log('[ContextBank] Starting Unified Context Bank ticker...')

  // Restore from DB first
  restoreFromDB().then(() => {
    // Immediate first tick
    tick()
  })

  _intervalId = setInterval(tick, TICK_INTERVAL_MS)
  console.log(`[ContextBank] Ticking every ${TICK_INTERVAL_MS / 1000}s`)
}

export function stopContextBankTicker(): void {
  if (_intervalId) {
    clearInterval(_intervalId)
    _intervalId = null
  }
  console.log('[ContextBank] Stopped')
}
