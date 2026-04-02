// [claude-code 2026-03-11] Point estimator — translates blended IV score to implied point moves
// Uses Rule of 16 + instrument betas from iv-scoring-v2.

import { calculateImpliedPoints, getInstrumentConfig, type ImpliedPoints } from '../iv-scoring-v2.js';

export interface PointEstimate {
  /** The blended IV score this estimate is based on */
  ivScore: number;
  /** Implied daily points move from VIX via Rule of 16 */
  implied: ImpliedPoints;
  /** Score-scaled estimate: what fraction of the daily move this score implies */
  scaledPoints: number;
  /** Ticks on the instrument */
  scaledTicks: number;
  /** Dollar risk per contract at this level */
  scaledDollarRisk: number;
  /** Urgency label */
  urgency: 'low' | 'moderate' | 'elevated' | 'high' | 'extreme';
}

export interface AggregateEventSignal {
  macroLevel?: number;
  riskType?: string | null;
}

export interface EstimatePointsOptions {
  uncapNarrativePressure?: boolean;
}

export function shouldUncapNarrativePressure(event: AggregateEventSignal): boolean {
  return (
    event.macroLevel === 4 &&
    (event.riskType === 'Macro' || event.riskType === 'Geopolitical')
  );
}

/**
 * Map IV score (0-10) to urgency label
 */
function scoreToUrgency(score: number): PointEstimate['urgency'] {
  if (score <= 2) return 'low';
  if (score <= 4) return 'moderate';
  if (score <= 6) return 'elevated';
  if (score <= 8) return 'high';
  return 'extreme';
}

/**
 * Estimate implied point move for a given IV score and VIX level.
 * The score scales the daily implied move: score/10 * implied daily move.
 * narrativePressure (0-3) caps how much of the daily range a single event can claim.
 */
export function estimatePoints(
  ivScore: number,
  vixLevel: number,
  instrument: string = '/ES',
  currentPrice?: number,
  narrativePressure: number = 0,
  options?: EstimatePointsOptions,
): PointEstimate {
  const config = getInstrumentConfig(instrument);
  const price = currentPrice ?? config?.currentPrice ?? 6000;

  const implied = calculateImpliedPoints(vixLevel, price, instrument);

  // Cap based on narrative pressure (% of daily range a single event can claim)
  const CAP_BY_NARRATIVE: Record<number, number> = { 0: 0.25, 1: 0.30, 2: 0.35, 3: 0.45 };
  const NARRATIVE_PRESSURE_CAP = CAP_BY_NARRATIVE[Math.min(3, Math.max(0, narrativePressure))] ?? 0.25;
  const effectiveCap = options?.uncapNarrativePressure ? Infinity : NARRATIVE_PRESSURE_CAP;
  const maxPoints = implied.adjustedPoints * effectiveCap;

  // Scale: the IV score represents what fraction of daily implied move is "active"
  const scaleFactor = Math.min(1, ivScore / 10);
  const rawScaled = implied.adjustedPoints * scaleFactor;
  let scaledPoints = Number(Math.min(maxPoints, rawScaled).toFixed(1));

  // VIX floor: when VIX > 16, implied points must be at least 1% of instrument price.
  // Markets are moving — sub-1% estimates understate real volatility.
  if (vixLevel > 16) {
    const onePercentFloor = Number((price * 0.01).toFixed(1));
    if (scaledPoints < onePercentFloor) {
      scaledPoints = onePercentFloor;
    }
  }
  const scaledTicks = Math.round((scaledPoints / (implied.adjustedPoints || 1)) * implied.adjustedTicks);
  const tickValue = config?.tickValue ?? 1;
  const scaledDollarRisk = Number((scaledTicks * tickValue).toFixed(2));

  return {
    ivScore,
    implied,
    scaledPoints,
    scaledTicks,
    scaledDollarRisk,
    urgency: scoreToUrgency(ivScore),
  };
}

/**
 * Aggregate point estimator for the session-level IV score display.
 * Unlike estimatePoints(), this does NOT apply a static narrative cap.
 *
 * Cap behavior:
 *  - Default (no critical events): cap at 50% of daily implied move
 *  - Critical Econ Data (macroLevel 4) or Geopolitical active event: NO CAP
 */
export function estimateAggregatePoints(
  ivScore: number,
  vixLevel: number,
  instrument: string = '/ES',
  activeEvents: AggregateEventSignal[] = [],
  currentPrice?: number,
): number {
  const config = getInstrumentConfig(instrument);
  const price = currentPrice ?? config?.currentPrice ?? 6000;
  const implied = calculateImpliedPoints(vixLevel, price, instrument);
  const scaleFactor = Math.min(1, ivScore / 10);
  const rawScaled = implied.adjustedPoints * scaleFactor;

  const hasCriticalEvent = activeEvents.some(
    (event) =>
      event.macroLevel === 4 ||
      event.riskType?.toLowerCase() === 'geopolitical',
  );

  if (hasCriticalEvent) {
    return Number(rawScaled.toFixed(1));
  }

  const cap = implied.adjustedPoints * 0.5;
  return Number(Math.min(cap, rawScaled).toFixed(1));
}
