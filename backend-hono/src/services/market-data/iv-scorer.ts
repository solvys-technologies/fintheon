// [claude-code 2026-04-02] Blended IV score service — 70% VIX + 20% catalyst heat + 10% MiroShark running analysis + systemic overlay
// Provides a single 0-10 composite score for the /api/market-data/iv-score endpoint.
// V3: adds systemic risk overlay (causal chains, historical rhyming, credit signals)

import { fetchVIX, type VIXData } from '../vix-service.js';
import { calculateIVScoreV2, classifyEventType, type StackedEvent } from '../iv-scoring-v2.js';
import { getCachedAssessment } from '../systemic/risk-detector.js';
import { generateIVPrediction } from './iv-prediction.js';
import type { IVPrediction } from './iv-prediction-types.js';
import { getRunningAnalysisScore } from '../miroshark/miroshark-reactive.js';

export interface BlendedIVScore {
  /** Composite 0-10 score (70% VIX + 20% catalyst heat + 10% MiroShark + systemic overlay) */
  score: number;
  /** VIX-only component score (0-10) */
  vixComponent: number;
  /** Headline-only component score (0-10) */
  headlineComponent: number;
  /** MiroShark running analysis component score (0-10) */
  mirosharkComponent: number;
  /** Weight breakdown */
  weights: { vix: number; headlines: number; miroshark: number };
  /** VIX snapshot */
  vix: {
    level: number;
    percentChange: number;
    isSpike: boolean;
    spikeDirection: 'up' | 'down' | 'none';
    staleMinutes: number;
  };
  /** Headline event count used */
  eventCount: number;
  /** Human-readable rationale lines */
  rationale: string[];
  timestamp: string;
  /** V3: Systemic risk overlay data */
  systemic?: {
    score: number;
    overlay: number;
    activeChains: number;
    rhymeMatches: number;
    creditSignals: number;
    topRhyme?: {
      crisisName: string;
      crisisYear: number;
      matchScore: number;
      peakVix: number;
      maxDrawdown: number;
    };
    rationale: string[];
  };
  /** V4: Next-session prediction (MiroShark or heuristic) */
  prediction?: IVPrediction;
}

const VIX_WEIGHT = 0.7;
const HEADLINE_WEIGHT = 0.2;
const MIROSHARK_WEIGHT = 0.1;

/**
 * Map VIX level to a 0-10 score.
 * Below VIX 16: stubborn, compressed (1.5-2.5 range)
 * VIX 18-24: steep ramp (5-9)
 * VIX 24+: elevated floor, VIX 24 → 9 so blended score hits ~7
 */
function vixToScore(vix: number): number {
  if (vix <= 0) return 0;
  if (vix >= 50) return 10;
  // Piecewise linear — stubborn below 16, steep above 18, ceiling above 30
  const breakpoints = [
    { vix: 10, score: 1.5 },
    { vix: 13, score: 2 },
    { vix: 16, score: 2.5 },
    { vix: 18, score: 5 },
    { vix: 20, score: 6.5 },
    { vix: 22, score: 8 },
    { vix: 24, score: 9 },
    { vix: 30, score: 9.5 },
    { vix: 50, score: 10 },
  ];
  if (vix <= breakpoints[0].vix) return breakpoints[0].score * (vix / breakpoints[0].vix);
  for (let i = 1; i < breakpoints.length; i++) {
    if (vix <= breakpoints[i].vix) {
      const prev = breakpoints[i - 1];
      const curr = breakpoints[i];
      const t = (vix - prev.vix) / (curr.vix - prev.vix);
      return prev.score + t * (curr.score - prev.score);
    }
  }
  return 10;
}

/**
 * Calculate a blended IV score: 70% VIX + 20% catalyst heat + 10% MiroShark running analysis.
 * Headline heat comes from the V2 scoring engine applied to recent DB events.
 * MiroShark component comes from the deterministic reactive scoring engine.
 */
export async function calculateBlendedIVScore(
  recentEvents: StackedEvent[],
  instrument: string = '/ES',
  currentPrice?: number,
): Promise<BlendedIVScore> {
  const rationale: string[] = [];

  // Fetch VIX
  const vixData = await fetchVIX();
  const vixScore = vixToScore(vixData.level);
  rationale.push(`VIX ${vixData.level.toFixed(1)} → component score ${vixScore.toFixed(1)}/10`);

  // Headline component via V2 engine
  let headlineScore = 0;
  if (recentEvents.length > 0) {
    const v2Result = calculateIVScoreV2({
      events: recentEvents,
      vixLevel: vixData.level,
      previousVixLevel: vixData.previousLevel,
      vixUpdateMinutes: vixData.staleMinutes,
      currentPrice: currentPrice ?? 6000,
      instrument,
      isMarketClosed: false,
    });
    headlineScore = v2Result.score;
    rationale.push(`${recentEvents.length} headline events → component score ${headlineScore.toFixed(1)}/10`);
  } else {
    rationale.push('No recent headline events → headline component 0');
  }

  // MiroShark running analysis component
  const mirosharkScore = getRunningAnalysisScore();
  if (mirosharkScore > 0) {
    rationale.push(`MiroShark running analysis → component score ${mirosharkScore.toFixed(1)}/10`);
  } else {
    rationale.push('No MiroShark running analysis → component 0');
  }

  // Dynamic weights: below VIX 16, keep VIX dominant ("stubborn" regime)
  let effectiveVixWeight = VIX_WEIGHT;
  let effectiveHeadlineWeight = HEADLINE_WEIGHT;
  let effectiveMfWeight = MIROSHARK_WEIGHT;
  if (vixData.level < 16) {
    effectiveVixWeight = 0.75;
    effectiveHeadlineWeight = 0.15;
    effectiveMfWeight = 0.10;
  }

  // Blend
  const blended = vixScore * effectiveVixWeight + headlineScore * effectiveHeadlineWeight + mirosharkScore * effectiveMfWeight;
  // VIX floor: elevated VIX guarantees minimum score (e.g. VIX 24 → vixScore 9 → floor 7)
  const vixFloor = Math.max(0, vixScore - 2);
  let finalScore = Math.max(blended, vixFloor);

  // V3: Apply systemic risk overlay (up to +2.5 pts)
  const systemicAssessment = getCachedAssessment();
  let systemicData: BlendedIVScore['systemic'];

  if (systemicAssessment && systemicAssessment.ivScoreOverlay > 0) {
    finalScore += systemicAssessment.ivScoreOverlay;
    rationale.push(`Systemic overlay: +${systemicAssessment.ivScoreOverlay.toFixed(1)} (${systemicAssessment.rationale.slice(0, 2).join('; ')})`);

    const topRhyme = systemicAssessment.rhymeMatches[0];
    systemicData = {
      score: systemicAssessment.systemicScore,
      overlay: systemicAssessment.ivScoreOverlay,
      activeChains: systemicAssessment.activeChains.length,
      rhymeMatches: systemicAssessment.rhymeMatches.length,
      creditSignals: systemicAssessment.creditSignalCount,
      topRhyme: topRhyme ? {
        crisisName: topRhyme.crisisName,
        crisisYear: topRhyme.crisisYear,
        matchScore: topRhyme.matchScore,
        peakVix: topRhyme.peakVix,
        maxDrawdown: topRhyme.maxDrawdown,
      } : undefined,
      rationale: systemicAssessment.rationale,
    };
  }

  const clamped = Math.min(10, Math.max(0, Number(finalScore.toFixed(1))));
  rationale.push(`Blended: (${vixScore.toFixed(1)} × ${effectiveVixWeight}) + (${headlineScore.toFixed(1)} × ${effectiveHeadlineWeight}) + (${mirosharkScore.toFixed(1)} × ${effectiveMfWeight}) = ${blended.toFixed(1)}, floor ${vixFloor.toFixed(1)}${systemicAssessment?.ivScoreOverlay ? ` + systemic ${systemicAssessment.ivScoreOverlay.toFixed(1)}` : ''} → ${clamped}`);

  const result: BlendedIVScore = {
    score: clamped,
    vixComponent: Number(vixScore.toFixed(1)),
    headlineComponent: Number(headlineScore.toFixed(1)),
    mirosharkComponent: Number(mirosharkScore.toFixed(1)),
    weights: { vix: effectiveVixWeight, headlines: effectiveHeadlineWeight, miroshark: effectiveMfWeight },
    vix: {
      level: vixData.level,
      percentChange: vixData.percentChange,
      isSpike: vixData.isSpike,
      spikeDirection: vixData.spikeDirection,
      staleMinutes: vixData.staleMinutes,
    },
    eventCount: recentEvents.length,
    rationale,
    timestamp: new Date().toISOString(),
    systemic: systemicData,
  };

  // V4: Attach next-session prediction (non-blocking — don't fail the score)
  try {
    result.prediction = await generateIVPrediction(result);
  } catch (err) {
    console.error('[IV Scorer] prediction failed:', err);
  }

  return result;
}

/** Re-export classifyEventType for handler use */
export { classifyEventType };
