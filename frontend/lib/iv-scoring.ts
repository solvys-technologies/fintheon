// [claude-code 2026-03-09] Added FrontendIVConfig type, computeIVScore now accepts optional config override
/**
 * IV Scoring Engine for PULSE
 *
 * Computes an Implied Volatility Score (0-100) based on:
 * - Current VIX vs 30-day average
 * - VIX term structure (contango/backwardation)
 * - Put/Call ratio trends
 * - Historical IV percentile
 *
 * Follows the "22 VIX Fixer" playbook for trade sizing recommendations.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface IVScoringInput {
  /** Current VIX spot level */
  vixCurrent: number;
  /** 30-day simple moving average of VIX (default: 18) */
  vix30dAvg?: number;
  /** VIX 3-month futures level for term structure (default: vixCurrent * 1.05) */
  vix3mFutures?: number;
  /** Current put/call ratio (default: 0.85) */
  putCallRatio?: number;
  /** 20-day average put/call ratio (default: 0.82) */
  putCallAvg?: number;
  /** Historical IV percentile rank 0-100 (default: derived from VIX) */
  ivPercentile?: number;
}

export type VolEnvironment = 'Low Vol' | 'Normal' | 'Elevated' | 'Crisis';

export interface SizingRecommendation {
  /** Multiplier for standard position size (e.g., 1.2 = 120% of normal) */
  sizeMultiplier: number;
  /** Human-readable recommendation */
  label: string;
  /** Detailed reasoning */
  detail: string;
}

export interface IVScoreResult {
  /** Composite IV score 0-100 */
  score: number;
  /** Volatility environment classification */
  environment: VolEnvironment;
  /** Trade sizing recommendation */
  sizing: SizingRecommendation;
  /** Individual component scores for transparency */
  components: {
    vixVsAvg: number;
    termStructure: number;
    putCallSignal: number;
    ivPercentile: number;
  };
  /** ISO timestamp of computation */
  timestamp: string;
  /** Legacy 0-10 score for backward compatibility with existing IVScoreCard */
  legacyScore: number;
}

// ─── Config ──────────────────────────────────────────────────────────────────

export interface FrontendIVConfig {
  weights: {
    vixVsAvg: number;
    termStructure: number;
    putCallSignal: number;
    ivPercentile: number;
  };
  vixThresholds: {
    low: number;
    normal: number;
    elevated: number;
    crisis: number;
  };
}

// ─── Constants (defaults) ────────────────────────────────────────────────────

/** Component weights (must sum to 1.0) */
const DEFAULT_WEIGHTS = {
  vixVsAvg: 0.35,
  termStructure: 0.20,
  putCallSignal: 0.15,
  ivPercentile: 0.30,
} as const;

/** VIX thresholds for the 22 VIX Fixer playbook — OPEN ITEM: awaiting Chief input on final values */
const DEFAULT_VIX_THRESHOLDS = {
  low: 14,
  normal: 20,
  elevated: 28,
  crisis: 40,
} as const;

// ─── Scoring Functions ───────────────────────────────────────────────────────

/**
 * Score VIX current vs 30-day average (0-100).
 * Below average = low score, significantly above = high score.
 */
function scoreVixVsAvg(current: number, avg: number): number {
  const ratio = current / avg;
  if (ratio <= 0.7) return 5;
  if (ratio <= 0.85) return 15;
  if (ratio <= 1.0) return 30;
  if (ratio <= 1.15) return 50;
  if (ratio <= 1.3) return 65;
  if (ratio <= 1.5) return 80;
  return Math.min(100, 80 + (ratio - 1.5) * 40);
}

/**
 * Score VIX term structure (0-100).
 * Contango (futures > spot) = normal/low score.
 * Backwardation (futures < spot) = elevated/crisis score.
 */
function scoreTermStructure(spotVix: number, futures3m: number): number {
  const spread = (futures3m - spotVix) / spotVix;
  // Normal contango: ~5% premium → low score
  // Flat: ~0% → moderate
  // Backwardation: negative → high score
  if (spread >= 0.10) return 10;
  if (spread >= 0.05) return 25;
  if (spread >= 0.0) return 40;
  if (spread >= -0.05) return 65;
  if (spread >= -0.10) return 80;
  return 95;
}

/**
 * Score put/call ratio signal (0-100).
 * Elevated P/C ratio relative to average signals fear.
 */
function scorePutCall(current: number, avg: number): number {
  const deviation = (current - avg) / avg;
  if (deviation <= -0.15) return 15; // Low fear
  if (deviation <= -0.05) return 25;
  if (deviation <= 0.05) return 40;
  if (deviation <= 0.15) return 55;
  if (deviation <= 0.25) return 70;
  if (deviation <= 0.40) return 85;
  return 95;
}

/**
 * Derive IV percentile from VIX if not provided.
 * Uses a rough mapping based on historical VIX distribution.
 */
function deriveIvPercentile(vix: number): number {
  // Historical VIX distribution (approximate CDF)
  if (vix <= 12) return 5;
  if (vix <= 14) return 15;
  if (vix <= 16) return 30;
  if (vix <= 18) return 45;
  if (vix <= 20) return 55;
  if (vix <= 23) return 65;
  if (vix <= 27) return 75;
  if (vix <= 32) return 85;
  if (vix <= 40) return 92;
  return 98;
}

// ─── Environment Classification ──────────────────────────────────────────────

function classifyEnvironment(score: number): VolEnvironment {
  if (score < 25) return 'Low Vol';
  if (score < 50) return 'Normal';
  if (score < 75) return 'Elevated';
  return 'Crisis';
}

// ─── Sizing Recommendation (22 VIX Fixer Playbook) ──────────────────────────

function getSizingRecommendation(score: number, vix: number): SizingRecommendation {
  if (score < 25) {
    return {
      sizeMultiplier: 1.25,
      label: 'Scale Up',
      detail: `VIX at ${vix.toFixed(1)} — low vol regime. Favorable for full-size positions and premium selling strategies.`,
    };
  }
  if (score < 50) {
    return {
      sizeMultiplier: 1.0,
      label: 'Normal Size',
      detail: `VIX at ${vix.toFixed(1)} — normal conditions. Standard position sizing applies.`,
    };
  }
  if (score < 75) {
    return {
      sizeMultiplier: 0.65,
      label: 'Scale Down',
      detail: `VIX at ${vix.toFixed(1)} — elevated vol. Reduce size by ~35%. Wider stops, smaller lots.`,
    };
  }
  return {
    sizeMultiplier: 0.35,
    label: 'Defensive',
    detail: `VIX at ${vix.toFixed(1)} — crisis regime. Cut size to ~35%. Capital preservation mode. Only A+ setups.`,
  };
}

// ─── Main Scoring Function ───────────────────────────────────────────────────

export function computeIVScore(input: IVScoringInput, config?: Partial<FrontendIVConfig>): IVScoreResult {
  const {
    vixCurrent,
    vix30dAvg = 18,
    vix3mFutures = vixCurrent * 1.05,
    putCallRatio = 0.85,
    putCallAvg = 0.82,
    ivPercentile,
  } = input;

  const weights = { ...DEFAULT_WEIGHTS, ...config?.weights };

  const resolvedPercentile = ivPercentile ?? deriveIvPercentile(vixCurrent);

  const components = {
    vixVsAvg: scoreVixVsAvg(vixCurrent, vix30dAvg),
    termStructure: scoreTermStructure(vixCurrent, vix3mFutures),
    putCallSignal: scorePutCall(putCallRatio, putCallAvg),
    ivPercentile: resolvedPercentile,
  };

  const score = Math.round(
    components.vixVsAvg * weights.vixVsAvg +
    components.termStructure * weights.termStructure +
    components.putCallSignal * weights.putCallSignal +
    components.ivPercentile * weights.ivPercentile
  );

  const clampedScore = Math.max(0, Math.min(100, score));

  return {
    score: clampedScore,
    environment: classifyEnvironment(clampedScore),
    sizing: getSizingRecommendation(clampedScore, vixCurrent),
    components,
    timestamp: new Date().toISOString(),
    legacyScore: Math.round((clampedScore / 10) * 10) / 10, // Convert 0-100 → 0-10
  };
}

/**
 * Quick score from just a VIX level (convenience function).
 * Uses sensible defaults for all other inputs.
 */
export function quickIVScore(vix: number, config?: Partial<FrontendIVConfig>): IVScoreResult {
  return computeIVScore({ vixCurrent: vix }, config);
}
