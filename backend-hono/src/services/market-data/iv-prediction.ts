// [claude-code 2026-03-16] IV prediction service — heuristic fallback + AgentDesk integration
// [claude-code 2026-03-16] Removed simulationId param — auto-checks latest cached prediction
// [claude-code 2026-05-03] S57: normalize AgentDesk + heuristic scenarios into fixed slots.

import type {
  IVPrediction,
  IVPredictionScenario,
} from "./iv-prediction-types.js";
import type { BlendedIVScore } from "./iv-scorer.js";
import { isSkillEnabled } from "../../config/feature-flags.js";
import { getLatestCachedPrediction } from "../agent-desk/agent-desk-service.js";
import { normalizeCanonicalIvScenarios } from "./canonical-iv-scenarios.js";

/**
 * Generate an IV prediction for the next session.
 * Uses AgentDesk if available and a simulation has completed,
 * otherwise falls back to a simple heuristic based on current score + VIX dynamics.
 */
export async function generateIVPrediction(
  currentScore: BlendedIVScore,
): Promise<IVPrediction> {
  // Try AgentDesk first — auto-fetch latest cached prediction
  if (isSkillEnabled("agentDesk")) {
    const mfPrediction = getLatestCachedPrediction();
    if (mfPrediction) {
      return {
        nextSessionScore: mfPrediction.nextSessionScore,
        confidence: mfPrediction.confidence,
        regimeShiftProbability: mfPrediction.regimeShiftProbability,
        scenarios: normalizeCanonicalIvScenarios(
          mfPrediction.scenarios,
          mfPrediction.nextSessionScore,
        ),
        source: "agentDesk",
        generatedAt: mfPrediction.generatedAt,
      };
    }
  }

  // Heuristic fallback — mean-reversion + VIX momentum
  return heuristicPrediction(currentScore);
}

function heuristicPrediction(score: BlendedIVScore): IVPrediction {
  const now = score.score;
  const vix = score.vix.level;
  const vixChange = score.vix.percentChange;

  // Mean-reversion bias: scores tend to drift toward 3.5 (long-run average)
  const meanTarget = 3.5;
  const reversion = (meanTarget - now) * 0.15;

  // VIX momentum: large VIX moves carry into the next session
  const momentum =
    vixChange > 10
      ? 0.8
      : vixChange > 5
        ? 0.4
        : vixChange < -10
          ? -0.6
          : vixChange < -5
            ? -0.3
            : 0;

  // VIX spike persistence: spikes tend to persist
  const spikeBias =
    score.vix.isSpike && score.vix.spikeDirection === "up" ? 0.5 : 0;

  const projected = Math.max(
    0,
    Math.min(10, now + reversion + momentum + spikeBias),
  );
  const delta = Math.abs(projected - now);

  // Confidence is lower when projected change is large
  const confidence = Math.max(0.3, 0.85 - delta * 0.1);

  // Regime shift: probability of score moving ±3 or more
  const regimeShift =
    vix > 30 ? 0.4 : vix > 22 ? 0.2 : Math.abs(vixChange) > 15 ? 0.25 : 0.05;

  const scenarios = normalizeCanonicalIvScenarios(
    buildHeuristicScenarios(now, projected, vix, vixChange),
    projected,
  );

  return {
    nextSessionScore: Number(projected.toFixed(1)),
    confidence: Number(confidence.toFixed(2)),
    regimeShiftProbability: Number(regimeShift.toFixed(2)),
    scenarios,
    source: "heuristic",
    generatedAt: new Date().toISOString(),
  };
}

function buildHeuristicScenarios(
  current: number,
  projected: number,
  vix: number,
  vixChange: number,
): IVPredictionScenario[] {
  const scenarios: IVPredictionScenario[] = [];

  // Base case — continuation
  scenarios.push({
    label: "Continuation",
    probability: 0.5,
    projectedScore: Number(projected.toFixed(1)),
  });

  // Risk-on scenario — score drops
  const riskOn = Math.max(0, projected - 1.5);
  scenarios.push({
    label: "Risk-on rally",
    probability: vixChange < -5 ? 0.3 : 0.2,
    projectedScore: Number(riskOn.toFixed(1)),
  });

  // Escalation scenario — score rises
  const escalation = Math.min(10, projected + 2);
  scenarios.push({
    label: vix > 22 ? "Volatility spike" : "Headline escalation",
    probability: vixChange > 5 ? 0.3 : 0.15,
    projectedScore: Number(escalation.toFixed(1)),
  });

  // Normalize probabilities
  const total = scenarios.reduce((s, sc) => s + sc.probability, 0);
  for (const sc of scenarios)
    sc.probability = Number((sc.probability / total).toFixed(2));

  // Sort by probability descending
  scenarios.sort((a, b) => b.probability - a.probability);

  return scenarios;
}
