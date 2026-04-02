// [claude-code 2026-04-02] Centralized macro-level assignment for catalysts.
// Determines MacroLevel 1-4 based on IV score, FJ emoji tier, riskType, and keyword signals.
// Source of truth for catalyst severity classification across the feed pipeline.

import type { MacroLevel, RiskType } from '../types/riskflow.js'

type FJMacroTier = 'tier1' | 'tier2' | 'tier3' | 'tier4' | 'none'
type LegacyFJTier = 'critical' | 'high' | 'medium' | 'low'
type AcceptableFJTier = FJMacroTier | LegacyFJTier

export interface MacroLevelInput {
  /** IV score 0-100 (normalized from 0-10 scale × 10) */
  ivScore?: number
  /** FJ emoji tier classification */
  fjEmojiTier?: AcceptableFJTier
  /** Risk type inferred from headline content */
  riskType?: RiskType | string | null
  /** Matched keyword strings from headline parser */
  keywordMatches?: string[]
  /** Count of urgency signals (FJ urgency + macroLevel + keyword matches) */
  urgencySignals?: number
  /**
   * Standard deviation surprise for econ data prints.
   * Measures how far the actual print deviated from consensus forecast.
   * >2 SD = major miss/beat (Level 4 territory).
   * 1-2 SD = notable surprise (Level 3).
   * <1 SD = inline (Level 2 at most).
   * undefined when the catalyst is not an econ data release.
   */
  sdSurprise?: number
}

// Level 4 — Critical (instant SSE broadcast, consilium push, Oracle notes)
// Fed rate decisions, major econ misses, military escalation, flash crashes
const LEVEL4_KEYWORDS = new Set([
  'fed', 'fomc', 'fed rate decision', 'fomc decision', 'rate decision', 'rate cut', 'rate hike',
  'cpi', 'ppi', 'nfp', 'gdp', 'pce',
  'circuit breaker', 'flash crash', 'halt',
  'invasion', 'missile', 'nuclear', 'strait of hormuz', 'ceasefire',
])

// Level 3 — High (consilium push, Oracle notes, MiroShark adjustment)
// Standard econ prints, tariffs, Fed speakers, geopolitical escalation, mega-cap earnings
const LEVEL3_KEYWORDS = new Set([
  'tariff', 'sanction', 'trade war',
  'nato', 'opec', 'proxy attack', 'troop',
  'treasury', 'jobless', 'retail sales', 'consumer confidence',
  'earnings', 'revenue', 'eps', 'guidance',
])

/**
 * Assign MacroLevel (1-4) to a catalyst based on multi-signal scoring.
 *
 * Priority order:
 * 1. FJ emoji tier (if present) — direct mapping from FinancialJuice classification
 * 2. IV score threshold — high IV from the scoring engine implies high severity
 * 3. Risk type + keyword matches — geopolitical/macro content boosts level
 * 4. Urgency signal count — combined signals push borderline items up
 */
export function assignMacroLevel(input: MacroLevelInput): MacroLevel {
  const {
    ivScore = 0,
    fjEmojiTier,
    riskType,
    keywordMatches = [],
    urgencySignals = 0,
    sdSurprise,
  } = input

  // 1. FJ emoji tier is the strongest signal (supports both legacy and macro-tier naming)
  if (fjEmojiTier === 'critical' || fjEmojiTier === 'tier1') return 4
  if (fjEmojiTier === 'high' || fjEmojiTier === 'tier2') return 3

  // 2. Standard deviation surprise — econ data prints with >2 SD surprise are Critical
  if (sdSurprise !== undefined) {
    if (sdSurprise >= 2) return 4   // Major miss/beat — market-moving
    if (sdSurprise >= 1) return 3   // Notable surprise — elevated
    // <1 SD — inline with expectations, fall through to keyword/IV logic
  }

  // 3. Check for Level 4 keywords (these don't need IV corroboration — news leads data)
  const lowerKeywords = keywordMatches.map((k) => k.toLowerCase())
  const hasLevel4Keyword = lowerKeywords.some((kw) => LEVEL4_KEYWORDS.has(kw))

  if (hasLevel4Keyword && ivScore >= 50) return 4
  if (hasLevel4Keyword) return 3 // keyword match alone gets at least High

  // 3. Risk type boost — geopolitical and macro get elevated
  const isGeoOrMacro = riskType === 'Macro' || riskType === 'Geopolitical'

  if (ivScore >= 90) return 4
  if (ivScore >= 80) return isGeoOrMacro ? 4 : 3
  if (ivScore >= 60) return isGeoOrMacro ? 3 : 2

  // 5. Level 3 keyword check
  const hasLevel3Keyword = lowerKeywords.some((kw) => LEVEL3_KEYWORDS.has(kw))

  if (hasLevel3Keyword && ivScore >= 40) return 3
  if (hasLevel3Keyword) return 2

  // 6. Urgency signal accumulation — multiple weak signals = medium
  if (urgencySignals >= 2 && ivScore >= 30) return 2

  // 7. FJ medium tier
  if (fjEmojiTier === 'medium' || fjEmojiTier === 'tier3') return 2

  // 8. Fallback — anything with some IV score is at least Low
  return ivScore >= 30 ? 2 : 1
}
