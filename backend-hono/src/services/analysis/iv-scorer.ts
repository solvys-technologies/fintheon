// [claude-code 2026-04-19] S24-T3: V4 calculateMacroLevel scarcity gate behind SCORING_V4 flag.
//   L10 reserved for environment-changing headlines (action verb + lexicon matrix-flip / Level-4 emoji / major print).
//   L9 = strong evidence with lexicon hit. L8 caps hedged/speculative framing ("talks of", "considering", "may").
// [claude-code 2026-03-26] S2-T5: Regime-aware V3 rewire — async, dynamic calibration weights, regime+commentator multipliers, scheduled-data breaking block
// [claude-code 2026-03-26] Tier-based score ceiling + recalibrated scoreToPoints curve (was producing 200+ pts for jobless claims)
// [claude-code 2026-03-24] VIX-weighted scoring: continuousVIXMultiplier, SubScoreBreakdown, finer EVENT_WEIGHTS, macro threshold adjustment
/**
 * IV Scorer Service
 * Calculate Implied Volatility impact scores for news events
 * Day 16 - Phase 5 Implementation
 */

import type {
  ParsedHeadline,
  HotPrint,
  IVScoreResult,
} from "../../types/news-analysis.js";
import type { SubScoreBreakdown } from "../../types/riskflow.js";
import type { VIXData } from "../vix-service.js";
import { hasLevel4Emoji, MAJOR_MACRO_PRINTS } from "../headline-parser.js";
import {
  INSTRUMENT_BETAS,
  continuousVIXMultiplier,
} from "../iv-scoring/index.js";
import {
  getCurrentRegime,
  getRegimeMultipliers,
} from "../regime/regime-service.js";
import { getMultiplierForSpeaker } from "../commentator/commentator-service.js";
import { getWeightForEvent } from "../calibration/calibration-service.js";

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
  ismPrint: 5,
  ism: 5,
  // Yield/GDP/Political (5.5-6.5)
  yieldCurveSignal: 6.5,
  gdpPrint: 6,
  leverageWarning: 6,
  politicalCommentary: 5.5,
  // Mid-tier (5)
  earningsMidCap: 5,
  earnings: 5,
  economicData: 4,
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
};

// Urgency multipliers
const URGENCY_MULTIPLIERS: Record<string, number> = {
  immediate: 1.3,
  high: 1.15,
  normal: 1.0,
};

// Time-based volatility windows (Eastern Time)
interface TimeWindow {
  start: number;
  end: number;
  multiplier: number;
  label: string;
}

const VOLATILITY_WINDOWS: TimeWindow[] = [
  { start: 4, end: 9, multiplier: 1.2, label: "Pre-market" },
  { start: 9, end: 10, multiplier: 1.3, label: "Open" },
  { start: 13, end: 16, multiplier: 1.25, label: "FOMC window" },
  { start: 15, end: 16, multiplier: 1.15, label: "Power hour" },
];

export interface IVScoreInput {
  parsed: ParsedHeadline;
  hotPrint?: HotPrint | null;
  timestamp?: Date;
  vixData?: VIXData;
}

export interface ExtendedIVScore extends IVScoreResult {
  /** Generic implied points for the selected instrument */
  impliedPoints: number;
  /** Which instrument the implied points are for */
  instrument: string;
  macroLevel: 1 | 2 | 3 | 4;
  sentiment: "bullish" | "bearish" | "neutral";
  tradingImplication: string;
  /** Per-item sub-score breakdown */
  subScores?: SubScoreBreakdown;
}

// Scheduled data releases should never get a breaking boost — they're expected, not breaking
const SCHEDULED_DATA_EVENTS = [
  "cpiPrint",
  "ppiPrint",
  "nfpPrint",
  "gdpPrint",
  "pcePrint",
  "ismPrint",
  "ism",
  "jolts",
  "retailSales",
  "housing",
  "jobless",
  "economicData",
];

/**
 * Calculate IV impact score for a parsed headline (V3: regime-aware, async)
 */
export async function calculateIVScore(
  input: IVScoreInput,
): Promise<ExtendedIVScore> {
  const { parsed, hotPrint, timestamp = new Date(), vixData } = input;
  const rationale: string[] = [];

  // --- Sub-score tracking ---
  let subTiming = 0;
  let subDeviation = 0;
  let subMomentum = 0;

  // Get base weight from calibration table (falls back to EVENT_WEIGHTS)
  const eventType = parsed.eventType ?? "default";
  let baseEventWeight: number;
  try {
    baseEventWeight = await getWeightForEvent(eventType);
  } catch {
    baseEventWeight = EVENT_WEIGHTS[eventType] ?? EVENT_WEIGHTS.default;
  }
  let score = baseEventWeight;
  rationale.push(`Base weight for ${eventType}: ${score}`);

  // Breaking news boost (momentum) — blocked on scheduled data releases
  if (parsed.isBreaking && !SCHEDULED_DATA_EVENTS.includes(eventType)) {
    score += 1.5;
    subMomentum += 0.75;
    rationale.push("Breaking headline: +1.5");
  }

  // Urgency multiplier (momentum)
  const urgencyMult = URGENCY_MULTIPLIERS[parsed.urgency] ?? 1.0;
  if (urgencyMult > 1.0) {
    const urgencyBoost = score * (urgencyMult - 1);
    subMomentum += Math.min(0.75, urgencyBoost / score);
    score *= urgencyMult;
    rationale.push(`Urgency (${parsed.urgency}): ×${urgencyMult}`);
  }

  // Market reaction language (momentum)
  if (parsed.marketReaction?.direction) {
    const intensityBoost =
      parsed.marketReaction.intensity === "severe"
        ? 1.5
        : parsed.marketReaction.intensity === "moderate"
          ? 0.75
          : 0.25;
    score += intensityBoost;
    subMomentum += Math.min(0.5, intensityBoost / 3);
    rationale.push(
      `Market reaction (${parsed.marketReaction.intensity}): +${intensityBoost}`,
    );
  }

  // Magnitude adjustment (deviation)
  if (parsed.magnitude) {
    if (parsed.magnitude > 50) {
      score += 2;
      subDeviation += 1;
      rationale.push("Large magnitude (>50): +2");
    } else if (parsed.magnitude > 25) {
      score += 1;
      subDeviation += 0.5;
      rationale.push("Moderate magnitude (>25): +1");
    }
  }

  // Numerical deviation (actual vs forecast)
  if (
    parsed.numbers?.actual !== undefined &&
    parsed.numbers?.forecast !== undefined
  ) {
    const deviation = Math.abs(parsed.numbers.actual - parsed.numbers.forecast);
    const forecastValue = Math.abs(parsed.numbers.forecast) || 1;
    const deviationPct = (deviation / forecastValue) * 100;

    if (deviationPct > 50) {
      score += 2.5;
      subDeviation += 2;
      rationale.push(`Large deviation (${deviationPct.toFixed(1)}%): +2.5`);
    } else if (deviationPct > 20) {
      score += 1.5;
      subDeviation += 1;
      rationale.push(`Moderate deviation (${deviationPct.toFixed(1)}%): +1.5`);
    } else if (deviationPct > 10) {
      score += 0.75;
      subDeviation += 0.5;
      rationale.push(`Mild deviation (${deviationPct.toFixed(1)}%): +0.75`);
    }
  }

  // Hot print boost (deviation)
  if (hotPrint) {
    const impactBoost =
      hotPrint.impact === "high"
        ? 2.5
        : hotPrint.impact === "medium"
          ? 1.5
          : 0.75;
    score += impactBoost;
    subDeviation += Math.min(1, impactBoost / 2.5);
    rationale.push(`Hot print (${hotPrint.impact}): +${impactBoost}`);
  }

  // Time-based adjustments (timing)
  const easternHour = getEasternHour(timestamp);
  for (const window of VOLATILITY_WINDOWS) {
    if (easternHour >= window.start && easternHour < window.end) {
      // Special case: FOMC window only applies to Fed events
      if (window.label === "FOMC window" && eventType !== "fedDecision") {
        continue;
      }
      const timingBoost = score * (window.multiplier - 1);
      subTiming += Math.min(3, timingBoost);
      score *= window.multiplier;
      rationale.push(`${window.label} timing: ×${window.multiplier}`);
      break;
    }
  }

  // --- VIX continuous curve multiplier ---
  let vixMult = 1.0;
  let vixContextScore = 0;
  if (vixData) {
    vixMult = continuousVIXMultiplier(vixData.level);
    score *= vixMult;
    vixContextScore = Math.min(10, vixData.level / 4); // 0-10 scale based on VIX level
    rationale.push(`VIX ${vixData.level.toFixed(1)} → ×${vixMult.toFixed(2)}`);

    if (vixData.isSpike) {
      const spikeAdj = vixData.spikeDirection === "up" ? 2 : -1;
      score += spikeAdj;
      rationale.push(
        `VIX spike ${vixData.spikeDirection}: ${spikeAdj > 0 ? "+" : ""}${spikeAdj}`,
      );
    }
  }

  // --- Regime multiplier (after VIX, before tier ceiling) ---
  let regimeMultiplier = 1.0;
  let regimeName = "CONSOLIDATION";
  try {
    const regimeState = await getCurrentRegime();
    regimeName = regimeState.regime;
    const regimeProfile = getRegimeMultipliers(regimeState.regime);

    // Event-type-specific override first
    if (regimeProfile.eventTypeOverrides[eventType]) {
      regimeMultiplier = regimeProfile.eventTypeOverrides[eventType];
    }
    // Then apply sentiment-based scaling
    const sentiment = determineSentiment(parsed, hotPrint);
    if (sentiment === "bullish") {
      regimeMultiplier *= regimeProfile.sentimentMultipliers.bullish;
    } else if (sentiment === "bearish") {
      regimeMultiplier *= regimeProfile.sentimentMultipliers.bearish;
    } else {
      regimeMultiplier *= regimeProfile.sentimentMultipliers.neutral;
    }
    score *= regimeMultiplier;
    rationale.push(`Regime: ${regimeName} (${regimeMultiplier.toFixed(2)}x)`);
  } catch {
    // Fallback: CONSOLIDATION ≈ 1.0 multipliers — no regime adjustment
  }

  // --- Commentator multiplier (after regime, before tier ceiling) ---
  let commentatorMultiplier = 1.0;
  if (parsed.speaker) {
    try {
      commentatorMultiplier = await getMultiplierForSpeaker(parsed.speaker);
      score *= commentatorMultiplier;
      rationale.push(
        `Speaker: ${parsed.speaker} (${commentatorMultiplier.toFixed(2)}x tier)`,
      );
    } catch {
      // Fallback: no speaker adjustment
    }
  }

  // Tier-based score ceiling: prevents low-tier events from reaching crisis scores via boost stacking
  // e.g. jobless (base 4) caps at 8, cpiPrint (base 7.5) caps at 10
  const maxBoostedScore = Math.min(10, baseEventWeight + 4);
  score = Math.min(maxBoostedScore, score);
  rationale.push(
    `Tier ceiling (base ${baseEventWeight} + 4 = ${maxBoostedScore}): capped at ${maxBoostedScore}`,
  );

  // Clamp final score
  score = Math.min(10, Math.max(0, score));

  // Build sub-score breakdown
  const subScores: SubScoreBreakdown = {
    eventWeight: baseEventWeight,
    timing: Math.min(3, subTiming),
    deviation: Math.min(3, subDeviation),
    momentum: Math.min(2, subMomentum),
    vixContext: Number(vixContextScore.toFixed(1)),
    vixMultiplier: Number(vixMult.toFixed(2)),
    regimeMultiplier: Number(regimeMultiplier.toFixed(2)),
    regimeName,
    commentatorMultiplier: Number(commentatorMultiplier.toFixed(2)),
    speaker: parsed.speaker || null,
  };

  // Calculate implied points (uses PRIMARY_INSTRUMENT env var or defaults to /ES)
  const primaryInstrument = process.env.PRIMARY_INSTRUMENT || "/ES";
  const ptResult = scoreToPoints(score, primaryInstrument);

  // Legacy ES/NQ fields for backward compat (always compute both)
  const esResult = scoreToPoints(score, "/ES");
  const nqResult = scoreToPoints(score, "/NQ");

  // Determine macro level (1-4 scale) — VIX-aware thresholds
  const macroLevel = calculateMacroLevel(score, parsed, hotPrint, vixData);

  // Determine sentiment
  const sentiment = determineSentiment(parsed, hotPrint);

  // Generate trading implication
  const tradingImplication = generateTradingImplication(
    score,
    macroLevel,
    sentiment,
    eventType,
  );

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
  };
}

/**
 * Get Eastern Time hour from date
 */
function getEasternHour(date: Date): number {
  const utcHour = date.getUTCHours();
  // Approximate ET as UTC-5 (simplified, ignoring DST)
  return (utcHour + 24 - 5) % 24;
}

/**
 * Convert score to implied point movements for any instrument.
 * Uses INSTRUMENT_BETAS from iv-scoring-v2 for beta-adjusted scaling.
 */
function scoreToPoints(
  score: number,
  instrument: string = "/ES",
): { points: number; instrument: string } {
  if (score <= 0) return { points: 0, instrument };

  // Non-linear scaling calibrated for /ES (beta 1.0)
  // Curve: 0-15-45-69-99 pts across score 0-3-6-8-10
  let basePoints: number;
  if (score <= 3) {
    basePoints = score * 5;
  } else if (score <= 6) {
    basePoints = 15 + (score - 3) * 10;
  } else if (score <= 8) {
    basePoints = 45 + (score - 6) * 12;
  } else {
    basePoints = 69 + (score - 8) * 15;
  }

  // Apply instrument beta from INSTRUMENT_BETAS (defaults to 1.0 for unknown instruments)
  const config = INSTRUMENT_BETAS[instrument];
  const beta = config ? Math.abs(config.beta) : 1.0;
  const adjustedPoints = basePoints * beta;

  return {
    points: Number(adjustedPoints.toFixed(1)),
    instrument,
  };
}

/**
 * Calculate macro level (1-4)
 * In elevated VIX (>22), the Level 3 threshold drops from 6 → 5
 */
function calculateMacroLevel(
  score: number,
  parsed: ParsedHeadline,
  hotPrint: HotPrint | null | undefined,
  vixData?: VIXData,
): 1 | 2 | 3 | 4 {
  const hasEmoji = hasLevel4Emoji(parsed.raw);
  const isMajorPrint = MAJOR_MACRO_PRINTS.includes(parsed.eventType ?? "");

  if (hasEmoji || isMajorPrint) return 4;

  // In elevated VIX, events matter more — lower the Level 3 threshold
  const level3Threshold = vixData && vixData.level > 22 ? 5 : 6;

  if (hotPrint?.impact === "medium" || score >= level3Threshold) return 3;
  if (score >= 4) return 2;
  return 1;
}

// ─── V4 Scarcity Gate (SCORING_V4) ───────────────────────────────────
// L9 / L10 are reserved for environment-changing headlines.
// Hedged framing ("talks of", "considering") caps at L8 regardless of multipliers.
// T2 wires this into calculateIVScore when SCORING_V4=true; rescore-all calls it directly.

const V4_ACTION_VERBS = [
  "signed",
  "confirmed",
  "announced",
  "declared",
  "begins",
  "commences",
  "collapses",
  "fails",
  "ends",
  "resigned",
  "fired",
  "dies",
  "attacked",
  "struck",
  "launched",
  "cuts",
  "hikes",
  "halts",
  "resumes",
  "reopens",
  "halted",
  "approved",
  "rejected",
  "passed",
  "vetoed",
] as const;

const V4_HEDGE_PHRASES = [
  "talks of",
  "discussions",
  "considering",
  "weighing",
  "may ",
  "might ",
  "could ",
  "possibly",
  "maybe",
  "reportedly planning",
  "rumored",
  "suggests",
  "sources say",
] as const;

export const V4_CAP_HEDGED = 8;
export const V4_CAP_NO_GATE = 8.5;
export const V4_THRESHOLD_L9 = 8.5;
export const V4_THRESHOLD_L10 = 9.5;

export interface V4GateAnalysis {
  hasActionVerb: boolean;
  hasHedgePhrase: boolean;
  hasLevel4Emoji: boolean;
  isMajorPrint: boolean;
  lexiconHit: boolean;
  isMatrixFlip: boolean;
  targetRegime: string | null;
}

export function analyzeV4Gate(
  parsed: ParsedHeadline,
  lexicon: Array<{
    keyword: string;
    phrasePattern: string | null;
    isMatrixFlip: boolean;
    targetRegime: string | null;
    requiresActionVerb: boolean;
  }>,
): V4GateAnalysis {
  const headline = (parsed.raw ?? "").toLowerCase();
  const hasActionVerb = V4_ACTION_VERBS.some((v) => headline.includes(v));
  const hasHedgePhrase = V4_HEDGE_PHRASES.some((p) => headline.includes(p));
  const hasEmoji = hasLevel4Emoji(parsed.raw ?? "");
  const isMajorPrint = MAJOR_MACRO_PRINTS.includes(parsed.eventType ?? "");

  let lexiconHit = false;
  let isMatrixFlip = false;
  let targetRegime: string | null = null;
  for (const entry of lexicon) {
    let matches = false;
    if (entry.phrasePattern) {
      try {
        matches = new RegExp(entry.phrasePattern, "i").test(parsed.raw ?? "");
      } catch {
        matches = false;
      }
    } else if (entry.keyword) {
      matches = headline.includes(entry.keyword.toLowerCase());
    }
    if (!matches) continue;

    lexiconHit = true;
    if (entry.isMatrixFlip && (!entry.requiresActionVerb || hasActionVerb)) {
      isMatrixFlip = true;
      targetRegime = entry.targetRegime;
      break;
    }
  }

  return {
    hasActionVerb,
    hasHedgePhrase,
    hasLevel4Emoji: hasEmoji,
    isMajorPrint,
    lexiconHit,
    isMatrixFlip,
    targetRegime,
  };
}

export interface V4ScarcityGateResult {
  cappedScore: number;
  capReason: string;
  level: number;
  matrixFlip: boolean;
  targetRegime: string | null;
}

/**
 * V4 scarcity gate: returns the maximum allowed score given lexicon + action-verb + hedge analysis.
 * Caller is responsible for `Math.min(rawScore, result.cappedScore)`.
 *
 * Rules (per S24-T3 brief):
 *   L10 ⟺ hasLevel4Emoji OR (isMajorPrint AND action verb) OR (lexicon matrix-flip AND action verb)
 *   L9  ⟺ rawScore ≥ 8.5 AND lexicon hit  OR  (isMajorPrint AND high deviation)
 *   L8  ⟺ rawScore ≥ 7.0; also the hard cap whenever a hedge phrase is present
 *   L7..L1: V3 ladder (no cap from this gate)
 */
export async function applyV4ScarcityGate(
  rawScore: number,
  parsed: ParsedHeadline,
  options: { highDeviation?: boolean } = {},
): Promise<V4ScarcityGateResult> {
  const { getLexicon } = await import("../scoring/lexicon-cache.js");
  const lexicon = await getLexicon();
  return computeV4ScarcityGate(rawScore, parsed, lexicon, options);
}

/** Pure variant exposed for batch rescoring (caller pre-loads lexicon once). */
export function computeV4ScarcityGate(
  rawScore: number,
  parsed: ParsedHeadline,
  lexicon: Parameters<typeof analyzeV4Gate>[1],
  options: { highDeviation?: boolean } = {},
): V4ScarcityGateResult {
  const a = analyzeV4Gate(parsed, lexicon);

  // L10 path
  const qualifiesForL10 =
    a.hasLevel4Emoji ||
    (a.isMajorPrint && a.hasActionVerb) ||
    (a.isMatrixFlip && a.hasActionVerb);

  if (qualifiesForL10 && !a.hasHedgePhrase) {
    return {
      cappedScore: 10,
      capReason: a.hasLevel4Emoji
        ? "L10: Level-4 emoji"
        : a.isMajorPrint
          ? "L10: major print + action verb"
          : "L10: lexicon matrix-flip + action verb",
      level: 10,
      matrixFlip: a.isMatrixFlip,
      targetRegime: a.targetRegime,
    };
  }

  // Hedge phrase forces max L8 regardless of other signals
  if (a.hasHedgePhrase) {
    return {
      cappedScore: V4_CAP_HEDGED,
      capReason: `L8 cap: hedged framing (${V4_HEDGE_PHRASES.find((p) => (parsed.raw ?? "").toLowerCase().includes(p))})`,
      level: 8,
      matrixFlip: false,
      targetRegime: null,
    };
  }

  // L9 path
  const qualifiesForL9 =
    (rawScore >= V4_THRESHOLD_L9 && a.lexiconHit) ||
    (a.isMajorPrint && options.highDeviation === true);

  if (qualifiesForL9) {
    return {
      cappedScore: 9.4,
      capReason: a.lexiconHit
        ? "L9: lexicon hit + score≥8.5"
        : "L9: major print + high deviation",
      level: 9,
      matrixFlip: false,
      targetRegime: a.targetRegime,
    };
  }

  // No L9/L10 qualification → cap below the L9 threshold so multipliers can't push past
  if (rawScore >= V4_THRESHOLD_L9) {
    return {
      cappedScore: V4_CAP_NO_GATE,
      capReason: "L8 cap: no lexicon flip / action verb",
      level: 8,
      matrixFlip: false,
      targetRegime: null,
    };
  }

  // L7..L1 unchanged from V3
  return {
    cappedScore: rawScore,
    capReason: "V4 gate: no cap (score < 8.5)",
    level: Math.floor(rawScore),
    matrixFlip: false,
    targetRegime: null,
  };
}

/** True when SCORING_V4 feature flag is enabled. */
export function isScoringV4Enabled(): boolean {
  return process.env.SCORING_V4 === "true";
}

/**
 * Determine sentiment from parsed data
 */
function determineSentiment(
  parsed: ParsedHeadline,
  hotPrint: HotPrint | null | undefined,
): "bullish" | "bearish" | "neutral" {
  // Market reaction is most direct signal
  if (parsed.marketReaction?.direction === "up") return "bullish";
  if (parsed.marketReaction?.direction === "down") return "bearish";

  // Direction field
  if (parsed.direction === "up") return "bullish";
  if (parsed.direction === "down") return "bearish";

  // Action-based inference
  const bullishActions = [
    "raises",
    "hikes",
    "beats",
    "surges",
    "rallies",
    "jumps",
  ];
  const bearishActions = [
    "cuts",
    "slashes",
    "misses",
    "tumbles",
    "drops",
    "sinks",
  ];

  const action = parsed.action?.toLowerCase() ?? "";
  if (bullishActions.some((a) => action.includes(a))) return "bullish";
  if (bearishActions.some((a) => action.includes(a))) return "bearish";

  // Hot print direction
  if (hotPrint) {
    // For inflation data, below forecast is typically bullish for equities
    const inflationEvents = ["cpiPrint", "ppiPrint"];
    if (inflationEvents.includes(parsed.eventType ?? "")) {
      return hotPrint.direction === "below" ? "bullish" : "bearish";
    }
    // For growth data, above forecast is typically bullish
    return hotPrint.direction === "above" ? "bullish" : "bearish";
  }

  return "neutral";
}

/**
 * Generate trading implication text
 */
function generateTradingImplication(
  score: number,
  macroLevel: number,
  sentiment: string,
  eventType: string,
): string {
  if (score <= 2) {
    return "Low impact event. Monitor but no immediate action required.";
  }

  if (score <= 4) {
    return `Moderate ${eventType} event. Watch for ${sentiment === "bullish" ? "support" : "resistance"} levels.`;
  }

  if (score <= 6) {
    const action =
      sentiment === "bullish"
        ? "long entries on pullbacks"
        : sentiment === "bearish"
          ? "short entries on bounces"
          : "wait for directional confirmation";
    return `Notable ${eventType} impact. Consider ${action}.`;
  }

  if (score <= 8) {
    return `High impact ${eventType}. Expect elevated volatility. ${sentiment === "neutral" ? "Wait for market structure" : `Bias ${sentiment}.`}`;
  }

  return `Critical ${eventType} event. Maximum volatility expected. Trade with caution, reduce size.`;
}

/**
 * Batch score multiple headlines
 */
export async function batchCalculateIVScores(
  inputs: IVScoreInput[],
): Promise<ExtendedIVScore[]> {
  return Promise.all(inputs.map(calculateIVScore));
}

/**
 * Get event type weight
 */
export function getEventWeight(eventType: string): number {
  return EVENT_WEIGHTS[eventType] ?? EVENT_WEIGHTS.default;
}
