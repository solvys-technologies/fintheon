// [claude-code 2026-03-24] VIX-weighted scoring: continuousVIXMultiplier, SubScoreBreakdown, finer EVENT_WEIGHTS, macro threshold adjustment
/**
 * IV Scorer Service
 * Calculate Implied Volatility impact scores for news events
 * Day 16 - Phase 5 Implementation
 */

import type { ParsedHeadline, HotPrint, IVScoreResult } from '../../types/news-analysis.js'
import type { SubScoreBreakdown } from '../../types/riskflow.js'
import type { VIXData } from '../vix-service.js'
import { hasLevel4Emoji, MAJOR_MACRO_PRINTS } from '../headline-parser.js'
import { INSTRUMENT_BETAS, continuousVIXMultiplier } from '../iv-scoring-v2.js'

// [claude-code 2026-03-24] Synced with iv-scoring-v2 finer granularity (half-point steps, 2.0-10.0 range)
// Base impact weights by event type — must stay in sync with iv-scoring-v2.ts EVENT_WEIGHTS
const EVENT_WEIGHTS: Record<string, number> = {
  // Black Swan (10)
  blackSwan: 10,
  majorCrisis: 10,
  datacenterHalt: 10,
  governmentShutdown: 10,
  // Systemic stress (9-9.5)
  liquidityStress: 9.5,
  bankStress: 9,
  bankingCrisis: 9,
  // Fed/Policy + Geopolitical (8-8.5)
  geopolitical: 8.5,
  fedDecision: 8.5,
  fomc: 8,
  powellSpeak: 8,
  tariffs: 8,
  tariffEscalation: 8,
  chinaTrade: 8,
  conflict: 8,
  // Credit/Inflation/Employment (7-7.5)
  creditSpreadWidening: 7.5,
  cpiPrint: 7.5,
  nfpPrint: 7.5,
  ppiPrint: 7,
  pcePrint: 7,
  jolts: 7,
  earningsHighImpact: 7,
  ismPrint: 7,
  ism: 7,
  // Yield/GDP/Political (5.5-6.5)
  yieldCurveSignal: 6.5,
  gdpPrint: 6,
  leverageWarning: 6,
  politicalCommentary: 5.5,
  // Mid-tier (5)
  earningsMidCap: 5,
  earnings: 5,
  economicData: 5,
  retailSales: 5,
  trade: 5,
  // Lower-tier (3-4)
  technicalBreak: 4,
  jobless: 4,
  housing: 4,
  sectorNews: 3,
  merger: 3,
  other: 2.5,
  default: 2,
}

// Urgency multipliers
const URGENCY_MULTIPLIERS: Record<string, number> = {
  immediate: 1.3,
  high: 1.15,
  normal: 1.0,
}

// Time-based volatility windows (Eastern Time)
interface TimeWindow {
  start: number
  end: number
  multiplier: number
  label: string
}

const VOLATILITY_WINDOWS: TimeWindow[] = [
  { start: 4, end: 9, multiplier: 1.2, label: 'Pre-market' },
  { start: 9, end: 10, multiplier: 1.3, label: 'Open' },
  { start: 13, end: 16, multiplier: 1.25, label: 'FOMC window' },
  { start: 15, end: 16, multiplier: 1.15, label: 'Power hour' },
]

export interface IVScoreInput {
  parsed: ParsedHeadline
  hotPrint?: HotPrint | null
  timestamp?: Date
  vixData?: VIXData
}

export interface ExtendedIVScore extends IVScoreResult {
  /** Generic implied points for the selected instrument */
  impliedPoints: number
  /** Which instrument the implied points are for */
  instrument: string
  macroLevel: 1 | 2 | 3 | 4
  sentiment: 'bullish' | 'bearish' | 'neutral'
  tradingImplication: string
  /** Per-item sub-score breakdown */
  subScores?: SubScoreBreakdown
}

/**
 * Calculate IV impact score for a parsed headline
 */
export function calculateIVScore(input: IVScoreInput): ExtendedIVScore {
  const { parsed, hotPrint, timestamp = new Date(), vixData } = input
  const rationale: string[] = []

  // --- Sub-score tracking ---
  let subTiming = 0
  let subDeviation = 0
  let subMomentum = 0

  // Get base weight from event type
  const eventType = parsed.eventType ?? 'default'
  const baseEventWeight = EVENT_WEIGHTS[eventType] ?? EVENT_WEIGHTS.default
  let score = baseEventWeight
  rationale.push(`Base weight for ${eventType}: ${score}`)

  // Breaking news boost (momentum)
  if (parsed.isBreaking) {
    score += 1.5
    subMomentum += 0.75
    rationale.push('Breaking headline: +1.5')
  }

  // Urgency multiplier (momentum)
  const urgencyMult = URGENCY_MULTIPLIERS[parsed.urgency] ?? 1.0
  if (urgencyMult > 1.0) {
    const urgencyBoost = score * (urgencyMult - 1)
    subMomentum += Math.min(0.75, urgencyBoost / score)
    score *= urgencyMult
    rationale.push(`Urgency (${parsed.urgency}): ×${urgencyMult}`)
  }

  // Market reaction language (momentum)
  if (parsed.marketReaction?.direction) {
    const intensityBoost = parsed.marketReaction.intensity === 'severe' ? 1.5 :
                           parsed.marketReaction.intensity === 'moderate' ? 0.75 : 0.25
    score += intensityBoost
    subMomentum += Math.min(0.5, intensityBoost / 3)
    rationale.push(`Market reaction (${parsed.marketReaction.intensity}): +${intensityBoost}`)
  }

  // Magnitude adjustment (deviation)
  if (parsed.magnitude) {
    if (parsed.magnitude > 50) {
      score += 2
      subDeviation += 1
      rationale.push('Large magnitude (>50): +2')
    } else if (parsed.magnitude > 25) {
      score += 1
      subDeviation += 0.5
      rationale.push('Moderate magnitude (>25): +1')
    }
  }

  // Numerical deviation (actual vs forecast)
  if (parsed.numbers?.actual !== undefined && parsed.numbers?.forecast !== undefined) {
    const deviation = Math.abs(parsed.numbers.actual - parsed.numbers.forecast)
    const forecastValue = Math.abs(parsed.numbers.forecast) || 1
    const deviationPct = (deviation / forecastValue) * 100

    if (deviationPct > 50) {
      score += 2.5
      subDeviation += 2
      rationale.push(`Large deviation (${deviationPct.toFixed(1)}%): +2.5`)
    } else if (deviationPct > 20) {
      score += 1.5
      subDeviation += 1
      rationale.push(`Moderate deviation (${deviationPct.toFixed(1)}%): +1.5`)
    } else if (deviationPct > 10) {
      score += 0.75
      subDeviation += 0.5
      rationale.push(`Mild deviation (${deviationPct.toFixed(1)}%): +0.75`)
    }
  }

  // Hot print boost (deviation)
  if (hotPrint) {
    const impactBoost = hotPrint.impact === 'high' ? 2.5 :
                        hotPrint.impact === 'medium' ? 1.5 : 0.75
    score += impactBoost
    subDeviation += Math.min(1, impactBoost / 2.5)
    rationale.push(`Hot print (${hotPrint.impact}): +${impactBoost}`)
  }

  // Time-based adjustments (timing)
  const easternHour = getEasternHour(timestamp)
  for (const window of VOLATILITY_WINDOWS) {
    if (easternHour >= window.start && easternHour < window.end) {
      // Special case: FOMC window only applies to Fed events
      if (window.label === 'FOMC window' && eventType !== 'fedDecision') {
        continue
      }
      const timingBoost = score * (window.multiplier - 1)
      subTiming += Math.min(3, timingBoost)
      score *= window.multiplier
      rationale.push(`${window.label} timing: ×${window.multiplier}`)
      break
    }
  }

  // --- VIX continuous curve multiplier ---
  let vixMult = 1.0
  let vixContextScore = 0
  if (vixData) {
    vixMult = continuousVIXMultiplier(vixData.level)
    score *= vixMult
    vixContextScore = Math.min(10, vixData.level / 4) // 0-10 scale based on VIX level
    rationale.push(`VIX ${vixData.level.toFixed(1)} → ×${vixMult.toFixed(2)}`)

    if (vixData.isSpike) {
      const spikeAdj = vixData.spikeDirection === 'up' ? 2 : -1
      score += spikeAdj
      rationale.push(`VIX spike ${vixData.spikeDirection}: ${spikeAdj > 0 ? '+' : ''}${spikeAdj}`)
    }
  }

  // Clamp final score
  score = Math.min(10, Math.max(0, score))

  // Build sub-score breakdown
  const subScores: SubScoreBreakdown = {
    eventWeight: baseEventWeight,
    timing: Math.min(3, subTiming),
    deviation: Math.min(3, subDeviation),
    momentum: Math.min(2, subMomentum),
    vixContext: Number(vixContextScore.toFixed(1)),
    vixMultiplier: Number(vixMult.toFixed(2)),
  }

  // Calculate implied points (uses PRIMARY_INSTRUMENT env var or defaults to /ES)
  const primaryInstrument = process.env.PRIMARY_INSTRUMENT || '/ES'
  const ptResult = scoreToPoints(score, primaryInstrument)

  // Legacy ES/NQ fields for backward compat (always compute both)
  const esResult = scoreToPoints(score, '/ES')
  const nqResult = scoreToPoints(score, '/NQ')

  // Determine macro level (1-4 scale) — VIX-aware thresholds
  const macroLevel = calculateMacroLevel(score, parsed, hotPrint, vixData)

  // Determine sentiment
  const sentiment = determineSentiment(parsed, hotPrint)

  // Generate trading implication
  const tradingImplication = generateTradingImplication(score, macroLevel, sentiment, eventType)

  return {
    eventType,
    score: Number(score.toFixed(2)),
    rationale,
    impliedESPoints: esResult.points,
    impliedNQPoints: nqResult.points,
    impliedPoints: ptResult.points,
    instrument: ptResult.instrument,
    timestamp: timestamp.toISOString(),
    macroLevel,
    sentiment,
    tradingImplication,
    subScores,
  }
}

/**
 * Get Eastern Time hour from date
 */
function getEasternHour(date: Date): number {
  const utcHour = date.getUTCHours()
  // Approximate ET as UTC-5 (simplified, ignoring DST)
  return (utcHour + 24 - 5) % 24
}

/**
 * Convert score to implied point movements for any instrument.
 * Uses INSTRUMENT_BETAS from iv-scoring-v2 for beta-adjusted scaling.
 */
function scoreToPoints(score: number, instrument: string = '/ES'): { points: number; instrument: string } {
  if (score <= 0) return { points: 0, instrument }

  // Non-linear scaling — steeper for high-impact events (geopolitical, crisis)
  // Base curve calibrated for /ES (beta 1.0)
  let basePoints: number
  if (score <= 3) {
    basePoints = score * 8
  } else if (score <= 6) {
    basePoints = 24 + (score - 3) * 15
  } else if (score <= 8) {
    basePoints = 69 + (score - 6) * 30
  } else {
    basePoints = 129 + (score - 8) * 50
  }

  // Apply instrument beta from INSTRUMENT_BETAS (defaults to 1.0 for unknown instruments)
  const config = INSTRUMENT_BETAS[instrument]
  const beta = config ? Math.abs(config.beta) : 1.0
  const adjustedPoints = basePoints * beta

  return {
    points: Number(adjustedPoints.toFixed(1)),
    instrument,
  }
}

/**
 * Calculate macro level (1-4)
 * In elevated VIX (>22), the Level 3 threshold drops from 6 → 5
 */
function calculateMacroLevel(
  score: number,
  parsed: ParsedHeadline,
  hotPrint: HotPrint | null | undefined,
  vixData?: VIXData
): 1 | 2 | 3 | 4 {
  const hasEmoji = hasLevel4Emoji(parsed.raw)
  const isMajorPrint = MAJOR_MACRO_PRINTS.includes(parsed.eventType ?? '')

  if (hasEmoji || isMajorPrint) return 4

  // In elevated VIX, events matter more — lower the Level 3 threshold
  const level3Threshold = (vixData && vixData.level > 22) ? 5 : 6

  if (hotPrint?.impact === 'medium' || score >= level3Threshold) return 3
  if (score >= 4) return 2
  return 1
}

/**
 * Determine sentiment from parsed data
 */
function determineSentiment(
  parsed: ParsedHeadline,
  hotPrint: HotPrint | null | undefined
): 'bullish' | 'bearish' | 'neutral' {
  // Market reaction is most direct signal
  if (parsed.marketReaction?.direction === 'up') return 'bullish'
  if (parsed.marketReaction?.direction === 'down') return 'bearish'

  // Direction field
  if (parsed.direction === 'up') return 'bullish'
  if (parsed.direction === 'down') return 'bearish'

  // Action-based inference
  const bullishActions = ['raises', 'hikes', 'beats', 'surges', 'rallies', 'jumps']
  const bearishActions = ['cuts', 'slashes', 'misses', 'tumbles', 'drops', 'sinks']
  
  const action = parsed.action?.toLowerCase() ?? ''
  if (bullishActions.some(a => action.includes(a))) return 'bullish'
  if (bearishActions.some(a => action.includes(a))) return 'bearish'

  // Hot print direction
  if (hotPrint) {
    // For inflation data, below forecast is typically bullish for equities
    const inflationEvents = ['cpiPrint', 'ppiPrint']
    if (inflationEvents.includes(parsed.eventType ?? '')) {
      return hotPrint.direction === 'below' ? 'bullish' : 'bearish'
    }
    // For growth data, above forecast is typically bullish
    return hotPrint.direction === 'above' ? 'bullish' : 'bearish'
  }

  return 'neutral'
}

/**
 * Generate trading implication text
 */
function generateTradingImplication(
  score: number,
  macroLevel: number,
  sentiment: string,
  eventType: string
): string {
  if (score <= 2) {
    return 'Low impact event. Monitor but no immediate action required.'
  }

  if (score <= 4) {
    return `Moderate ${eventType} event. Watch for ${sentiment === 'bullish' ? 'support' : 'resistance'} levels.`
  }

  if (score <= 6) {
    const action = sentiment === 'bullish' ? 'long entries on pullbacks' : 
                   sentiment === 'bearish' ? 'short entries on bounces' : 
                   'wait for directional confirmation'
    return `Notable ${eventType} impact. Consider ${action}.`
  }

  if (score <= 8) {
    return `High impact ${eventType}. Expect elevated volatility. ${sentiment === 'neutral' ? 'Wait for market structure' : `Bias ${sentiment}.`}`
  }

  return `Critical ${eventType} event. Maximum volatility expected. Trade with caution, reduce size.`
}

/**
 * Batch score multiple headlines
 */
export function batchCalculateIVScores(
  inputs: IVScoreInput[]
): ExtendedIVScore[] {
  return inputs.map(calculateIVScore)
}

/**
 * Get event type weight
 */
export function getEventWeight(eventType: string): number {
  return EVENT_WEIGHTS[eventType] ?? EVENT_WEIGHTS.default
}
