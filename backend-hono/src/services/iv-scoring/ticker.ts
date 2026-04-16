// [claude-code 2026-04-16] Split from computation.ts — main IV scoring function (calculateIVScoreV2)
import type { IVScoringConfig, SessionInfo } from "./config.js";
import { getIVScoringConfig } from "./config.js";
import { calculateImpliedPoints, type ImpliedPoints } from "./instrument.js";
import {
  getCurrentSession,
  getVIXMultiplier,
  calculateVIXSpikeAdjustment,
  calculateStackedScore,
  checkEdgeCases,
  type StackedEvent,
} from "./computation.js";

// ============================================================================
// MAIN SCORING FUNCTION
// ============================================================================

export interface IVScoreInputV2 {
  events: StackedEvent[];
  vixLevel: number;
  previousVixLevel?: number;
  vixUpdateMinutes?: number;
  currentPrice: number;
  instrument: string;
  isMarketClosed?: boolean;
  isEarningsSeason?: boolean;
  isFOMCWeek?: boolean;
  previousSessionScore?: number;
}

export interface IVScoreResultV2 {
  score: number;
  impliedPoints: ImpliedPoints;
  session: SessionInfo;
  vixMultiplier: number;
  vixContext: string;
  activityBaseline: number;
  stackedEvents: number;
  synergy: boolean;
  rationale: string[];
  alert?: string;
}

export function calculateIVScoreV2(
  input: IVScoreInputV2,
  config?: Partial<IVScoringConfig>,
): IVScoreResultV2 {
  const {
    events,
    vixLevel,
    previousVixLevel = vixLevel,
    vixUpdateMinutes = 0,
    currentPrice,
    instrument,
    isMarketClosed = false,
    isEarningsSeason = false,
    isFOMCWeek = false,
    previousSessionScore = 0,
  } = input;

  const resolvedConfig = { ...getIVScoringConfig(), ...config };
  const sc = resolvedConfig.scoring ?? getIVScoringConfig().scoring;

  const rationale: string[] = [];
  const now = new Date();

  for (const event of events) {
    const edgeCase = checkEdgeCases(event.eventType, vixLevel, isMarketClosed);
    if (edgeCase.triggered && edgeCase.score !== undefined) {
      const points = calculateImpliedPoints(vixLevel, currentPrice, instrument);
      return {
        score: edgeCase.score,
        impliedPoints: points,
        session: getCurrentSession(now),
        vixMultiplier: getVIXMultiplier(vixLevel).multiplier,
        vixContext: getVIXMultiplier(vixLevel).context,
        activityBaseline: sc.maxScore,
        stackedEvents: events.length,
        synergy: false,
        rationale: [edgeCase.message!],
        alert: edgeCase.message,
      };
    }
  }

  const session = getCurrentSession(now);
  rationale.push(`Session: ${session.name} (×${session.multiplier})`);

  let vixMult = 1.0;
  let vixContext = "Unknown";
  if (resolvedConfig.vixMultipliers) {
    for (const tier of resolvedConfig.vixMultipliers) {
      if (vixLevel < tier.max) {
        vixMult = tier.multiplier;
        vixContext = tier.context;
        break;
      }
    }
  } else {
    const result = getVIXMultiplier(vixLevel);
    vixMult = result.multiplier;
    vixContext = result.context;
  }
  rationale.push(`VIX ${vixLevel.toFixed(1)}: ×${vixMult} (${vixContext})`);

  const spikeAdj = calculateVIXSpikeAdjustment(
    vixLevel,
    previousVixLevel,
    vixUpdateMinutes,
  );
  if (spikeAdj !== 0) {
    rationale.push(
      `VIX spike adjustment: ${spikeAdj > 0 ? "+" : ""}${spikeAdj}`,
    );
  }

  const isHighIV =
    events.length >= sc.highIVEventThreshold || isEarningsSeason || isFOMCWeek;
  const activityBaseline = isHighIV ? sc.highIVBaseline : sc.lowIVBaseline;
  rationale.push(
    `Activity baseline: ${activityBaseline} (${isHighIV ? "High IV" : "Low IV"})`,
  );

  let score: number;
  let synergy = false;

  if (events.length === 0) {
    score = Math.min(sc.maxScore, vixLevel / sc.noEventBaselineDivisor);
    rationale.push(`No events - VIX baseline: ${score.toFixed(1)}`);
  } else {
    const stacked = calculateStackedScore(events, now, vixLevel);
    score = stacked.score;
    synergy = stacked.synergy;

    if (synergy) {
      rationale.push(
        `Synergy boost applied (events <${sc.synergyWindowMinutes} min apart): ×${sc.synergyMultiplier}`,
      );
    }
    rationale.push(`Stacked events score: ${score.toFixed(2)}`);
  }

  score *= session.multiplier;
  rationale.push(`After session multiplier: ${score.toFixed(2)}`);

  score *= vixMult;
  rationale.push(`After VIX multiplier: ${score.toFixed(2)}`);

  score += spikeAdj;

  if (previousSessionScore > 0) {
    const spillover = previousSessionScore * sc.spilloverFactor;
    score += spillover;
    rationale.push(`Spillover from previous session: +${spillover.toFixed(2)}`);
  }

  score = Math.max(0, Math.min(sc.maxScore, score));
  score = Math.max(score, activityBaseline);

  rationale.push(`Final score: ${score.toFixed(1)}`);

  const impliedPoints = calculateImpliedPoints(
    vixLevel,
    currentPrice,
    instrument,
  );
  rationale.push(
    `Implied move: ±${impliedPoints.adjustedPoints} points (${instrument}, β=${impliedPoints.beta})`,
  );

  let alert: string | undefined;
  if (score >= sc.alertScoreThreshold) {
    alert = "Get focused 'cause this one of them ones";
  }

  return {
    score: Number(score.toFixed(1)),
    impliedPoints,
    session,
    vixMultiplier: vixMult,
    vixContext,
    activityBaseline,
    stackedEvents: events.length,
    synergy,
    rationale,
    alert,
  };
}
