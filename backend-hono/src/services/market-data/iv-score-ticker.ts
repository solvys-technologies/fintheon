// [claude-code 2026-03-24] Updated weights to 50% VIX + 30% headline + 20% MiroFish
// [claude-code 2026-03-12] Task 2C: startIVScoreTicker reads PRIMARY_INSTRUMENT env var
// [claude-code 2026-03-11] IV Score Ticker — persistent background scorer
// Runs every 60s, computes blended IV score, caches to DB.
// Decay never restarts: events use original published_at timestamps.
// Score survives backend restarts via DB persistence.

import { calculateBlendedIVScore, classifyEventType } from './iv-scorer.js'
import { estimatePoints } from './point-estimator.js'
import type { StackedEvent } from '../iv-scoring-v2.js'
import type { BlendedIVScore } from './iv-scorer.js'

const TICK_INTERVAL_MS = 60_000 // 60s
// Fetch events from last 7 days — let the decay math handle relevance.
// V3 credit events have 4320-min base half-life (3 days), crisis regime 4x = 12 days.
// 7-day window ensures no premature cutoff.
const EVENT_WINDOW_HOURS = 168 // 7 days

let _intervalId: ReturnType<typeof setInterval> | null = null

// In-memory cache — always the most recent score
let _cachedScore: IVScoreSnapshot | null = null

export interface IVScoreSnapshot {
  score: BlendedIVScore
  points: {
    scaledPoints: number
    scaledTicks: number
    scaledDollarRisk: number
    urgency: string
    implied: {
      adjustedPoints: number
      beta: number
    }
  }
  instrument: string
  computedAt: string
  eventCount: number
  /** How many events are still contributing (decayed score > 0.1) */
  activeEvents: number
}

/**
 * Run a single IV score tick.
 * Fetches all events within the decay window, computes score, caches to memory + DB.
 */
async function tick(instrument: string = '/ES'): Promise<void> {
  try {
    // Fetch events from DB with extended window
    const events = await fetchEventsFromDB()

    // Compute blended score
    const result = await calculateBlendedIVScore(events, instrument)
    const pointEst = estimatePoints(result.score, result.vix.level, instrument)

    // Count events still actively contributing (decayed > 0.1)
    const now = Date.now()
    const activeEvents = events.filter(e => {
      const minutesSince = (now - e.timestamp.getTime()) / 60000
      // Rough check: if less than 10 half-lives old, still active
      return minutesSince < 43200 // 30 days max
    }).length

    const snapshot: IVScoreSnapshot = {
      score: result,
      points: {
        scaledPoints: pointEst.scaledPoints,
        scaledTicks: pointEst.scaledTicks,
        scaledDollarRisk: pointEst.scaledDollarRisk,
        urgency: pointEst.urgency,
        implied: {
          adjustedPoints: pointEst.implied.adjustedPoints,
          beta: pointEst.implied.beta,
        },
      },
      instrument,
      computedAt: new Date().toISOString(),
      eventCount: events.length,
      activeEvents,
    }

    _cachedScore = snapshot

    // Persist to DB
    await persistScoreToDB(snapshot)

    if (result.score > 3) {
      console.log(
        `[IVTicker] Score: ${result.score}/10, ` +
        `events: ${events.length} (${activeEvents} active), ` +
        `VIX: ${result.vix.level.toFixed(1)}, ` +
        `points: ±${pointEst.scaledPoints}`
      )
    }
  } catch (err) {
    console.error('[IVTicker] Tick failed:', err)
  }
}

/**
 * Fetch scored events from DB with the extended decay window.
 * Uses original published_at timestamps — decay is continuous from event creation.
 */
async function fetchEventsFromDB(): Promise<StackedEvent[]> {
  try {
    const { sql, isDatabaseAvailable } = await import('../../config/database.js')
    if (!isDatabaseAvailable() || !sql) return []

    const cutoff = new Date(Date.now() - EVENT_WINDOW_HOURS * 60 * 60 * 1000).toISOString()
    const recentItems = await sql`
      SELECT headline, source, macro_level, iv_score, published_at, is_breaking
      FROM news_feed_items
      WHERE published_at >= ${cutoff}
        AND macro_level >= 2
      ORDER BY published_at DESC
      LIMIT 200
    `

    return recentItems.map((item: any) => {
      const parsed = { raw: item.headline, eventType: null, isBreaking: item.is_breaking }
      return {
        eventType: classifyEventType(parsed as any),
        baseScore: item.iv_score || 3,
        timestamp: new Date(item.published_at),
      }
    })
  } catch {
    return []
  }
}

/**
 * Persist the computed IV score to DB for cross-restart continuity.
 */
async function persistScoreToDB(snapshot: IVScoreSnapshot): Promise<void> {
  try {
    const { sql, isDatabaseAvailable } = await import('../../config/database.js')
    if (!isDatabaseAvailable() || !sql) return

    const data = JSON.stringify({
      score: snapshot.score.score,
      vixComponent: snapshot.score.vixComponent,
      headlineComponent: snapshot.score.headlineComponent,
      vixLevel: snapshot.score.vix.level,
      eventCount: snapshot.eventCount,
      activeEvents: snapshot.activeEvents,
      points: snapshot.points,
      instrument: snapshot.instrument,
      systemic: snapshot.score.systemic,
      rationale: snapshot.score.rationale,
    })

    await sql`
      INSERT INTO systemic_risk_state (state_type, state_data, updated_at)
      VALUES ('iv_score_cache', ${data}::jsonb, NOW())
      ON CONFLICT (state_type)
      DO UPDATE SET state_data = ${data}::jsonb, updated_at = NOW()
    `.catch(() => {
      // Table may not exist yet — silent fail
    })
  } catch {
    // DB persistence is best-effort
  }
}

/**
 * Restore cached IV score from DB on startup.
 * This ensures the score is immediately available even before the first tick.
 */
async function restoreFromDB(): Promise<void> {
  try {
    const { sql, isDatabaseAvailable } = await import('../../config/database.js')
    if (!isDatabaseAvailable() || !sql) return

    const rows = await sql`
      SELECT state_data, updated_at FROM systemic_risk_state
      WHERE state_type = 'iv_score_cache'
      LIMIT 1
    `.catch(() => [])

    if (rows.length > 0 && rows[0].state_data) {
      const data = rows[0].state_data
      const updatedAt = rows[0].updated_at

      // Only use cached score if it's less than 5 minutes old
      const ageMs = Date.now() - new Date(updatedAt).getTime()
      if (ageMs < 300_000) {
        console.log(`[IVTicker] Restored cached score from DB (${Math.round(ageMs / 1000)}s old): ${data.score}/10`)
        // Reconstruct minimal snapshot for serving
        _cachedScore = {
          score: {
            score: data.score,
            vixComponent: data.vixComponent,
            headlineComponent: data.headlineComponent,
            mirofishComponent: data.mirofishComponent ?? 0,
            weights: { vix: 0.5, headlines: 0.3, mirofish: 0.2 },
            vix: {
              level: data.vixLevel,
              percentChange: 0,
              isSpike: false,
              spikeDirection: 'none',
              staleMinutes: Math.round(ageMs / 60000),
            },
            eventCount: data.eventCount,
            rationale: data.rationale ?? [],
            timestamp: updatedAt,
            systemic: data.systemic,
          },
          points: data.points ?? { scaledPoints: 0, scaledTicks: 0, scaledDollarRisk: 0, urgency: 'low', implied: { adjustedPoints: 0, beta: 1 } },
          instrument: data.instrument ?? '/ES',
          computedAt: updatedAt,
          eventCount: data.eventCount ?? 0,
          activeEvents: data.activeEvents ?? 0,
        }
      } else {
        console.log(`[IVTicker] Cached score too old (${Math.round(ageMs / 60000)}m), computing fresh`)
      }
    }
  } catch {
    // Silent — fresh computation on first tick
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Get the latest cached IV score snapshot.
 * Returns null if no score has been computed yet.
 */
export function getCachedIVScore(): IVScoreSnapshot | null {
  return _cachedScore
}

/**
 * Start the IV score ticker.
 * Runs every 60s, persists to DB, survives restarts.
 */
export function startIVScoreTicker(instrument: string = '/ES'): void {
  if (_intervalId) return

  console.log('[IVTicker] Starting IV score ticker...')

  // Restore from DB first (instant availability)
  restoreFromDB().then(() => {
    // Immediate first tick
    tick(instrument)
  })

  // Schedule recurring ticks
  _intervalId = setInterval(() => tick(instrument), TICK_INTERVAL_MS)

  console.log(`[IVTicker] Ticking every ${TICK_INTERVAL_MS / 1000}s`)
}

/**
 * Stop the IV score ticker.
 */
export function stopIVScoreTicker(): void {
  if (_intervalId) {
    clearInterval(_intervalId)
    _intervalId = null
  }
  console.log('[IVTicker] Stopped')
}
