// [claude-code 2026-03-23] Fitness evaluator — measures IV scoring accuracy against actual outcomes
// Compares predicted implied moves to actual price moves for stored observations.

import type {
  ScoringObservation,
  FitnessResult,
  FitnessReport,
} from "./types.js";

/**
 * Evaluate the fitness of a single observation.
 * Requires the observation to have both predictedMove and actualMove filled in.
 */
export function evaluateObservation(
  obs: ScoringObservation,
): FitnessResult | null {
  if (
    obs.actualMove == null ||
    obs.predictedMove == null ||
    obs.predictedMove === 0
  ) {
    return null;
  }

  const directionCorrect =
    (obs.actualMove >= 0 && obs.predictedMove >= 0) ||
    (obs.actualMove < 0 && obs.predictedMove < 0) ||
    obs.actualMove === 0;

  const magnitudeError = Math.abs(
    Math.abs(obs.actualMove) - Math.abs(obs.predictedMove),
  );
  const magnitudeErrorPct =
    (magnitudeError / Math.abs(obs.predictedMove)) * 100;

  // Score accuracy: 1 - (error / predicted), clamped to [0, 1]
  const scoreAccuracy = Math.max(0, Math.min(1, 1 - magnitudeErrorPct / 100));

  // Bias: positive means we overpredicted the magnitude
  const bias = Math.abs(obs.predictedMove) - Math.abs(obs.actualMove);

  return {
    observationId: obs.id,
    directionCorrect,
    magnitudeError: Number(magnitudeError.toFixed(2)),
    magnitudeErrorPct: Number(magnitudeErrorPct.toFixed(1)),
    scoreAccuracy: Number(scoreAccuracy.toFixed(3)),
    bias: Number(bias.toFixed(2)),
  };
}

/**
 * Generate a fitness report from a set of observations.
 */
export function generateFitnessReport(
  observations: ScoringObservation[],
): FitnessReport {
  const results: Array<{ obs: ScoringObservation; fit: FitnessResult }> = [];

  for (const obs of observations) {
    const fit = evaluateObservation(obs);
    if (fit) {
      results.push({ obs, fit });
    }
  }

  const evaluated = results.length;

  if (evaluated === 0) {
    return {
      totalObservations: observations.length,
      evaluatedObservations: 0,
      directionAccuracy: 0,
      meanMagnitudeError: 0,
      meanMagnitudeErrorPct: 0,
      meanScoreAccuracy: 0,
      meanBias: 0,
      byEventType: {},
      bySession: {},
      generatedAt: new Date().toISOString(),
    };
  }

  // Aggregate stats
  const directionCorrectCount = results.filter(
    (r) => r.fit.directionCorrect,
  ).length;
  const sumMagError = results.reduce((s, r) => s + r.fit.magnitudeError, 0);
  const sumMagErrorPct = results.reduce(
    (s, r) => s + r.fit.magnitudeErrorPct,
    0,
  );
  const sumAccuracy = results.reduce((s, r) => s + r.fit.scoreAccuracy, 0);
  const sumBias = results.reduce((s, r) => s + r.fit.bias, 0);

  // By event type
  const byEventType: FitnessReport["byEventType"] = {};
  for (const { obs, fit } of results) {
    const et = obs.eventType;
    if (!byEventType[et]) {
      byEventType[et] = {
        count: 0,
        directionAccuracy: 0,
        meanMagnitudeError: 0,
        meanBias: 0,
      };
    }
    byEventType[et].count++;
    byEventType[et].directionAccuracy += fit.directionCorrect ? 1 : 0;
    byEventType[et].meanMagnitudeError += fit.magnitudeError;
    byEventType[et].meanBias += fit.bias;
  }
  for (const et of Object.keys(byEventType)) {
    const n = byEventType[et].count;
    byEventType[et].directionAccuracy = Number(
      ((byEventType[et].directionAccuracy / n) * 100).toFixed(1),
    );
    byEventType[et].meanMagnitudeError = Number(
      (byEventType[et].meanMagnitudeError / n).toFixed(2),
    );
    byEventType[et].meanBias = Number(
      (byEventType[et].meanBias / n).toFixed(2),
    );
  }

  // By session
  const bySession: FitnessReport["bySession"] = {};
  for (const { obs, fit } of results) {
    const sess = obs.session;
    if (!bySession[sess]) {
      bySession[sess] = {
        count: 0,
        directionAccuracy: 0,
        meanMagnitudeError: 0,
      };
    }
    bySession[sess].count++;
    bySession[sess].directionAccuracy += fit.directionCorrect ? 1 : 0;
    bySession[sess].meanMagnitudeError += fit.magnitudeError;
  }
  for (const sess of Object.keys(bySession)) {
    const n = bySession[sess].count;
    bySession[sess].directionAccuracy = Number(
      ((bySession[sess].directionAccuracy / n) * 100).toFixed(1),
    );
    bySession[sess].meanMagnitudeError = Number(
      (bySession[sess].meanMagnitudeError / n).toFixed(2),
    );
  }

  return {
    totalObservations: observations.length,
    evaluatedObservations: evaluated,
    directionAccuracy: Number(
      ((directionCorrectCount / evaluated) * 100).toFixed(1),
    ),
    meanMagnitudeError: Number((sumMagError / evaluated).toFixed(2)),
    meanMagnitudeErrorPct: Number((sumMagErrorPct / evaluated).toFixed(1)),
    meanScoreAccuracy: Number((sumAccuracy / evaluated).toFixed(3)),
    meanBias: Number((sumBias / evaluated).toFixed(2)),
    byEventType,
    bySession,
    generatedAt: new Date().toISOString(),
  };
}
