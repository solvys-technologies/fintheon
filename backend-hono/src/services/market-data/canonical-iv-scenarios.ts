// [claude-code 2026-05-03] S57: canonical next-session IV scenario slots.
import type { IVPredictionScenario } from "./iv-prediction-types.js";

export const CANONICAL_IV_SCENARIO_LABELS = [
  "Continuation",
  "Risk-on rally",
  "Escalation",
] as const;

type CanonicalIvScenarioLabel = (typeof CANONICAL_IV_SCENARIO_LABELS)[number];

interface BucketAccumulator {
  probability: number;
  weightedScore: number;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function clampScore(value: number, fallbackScore: number): number {
  if (!Number.isFinite(value)) return fallbackScore;
  return Math.max(0, Math.min(10, value));
}

function matchCanonicalSlot(label: string): CanonicalIvScenarioLabel {
  const normalized = label.toLowerCase();
  if (
    normalized.includes("risk-on") ||
    normalized.includes("risk on") ||
    normalized.includes("rally") ||
    normalized.includes("bull") ||
    normalized.includes("relief") ||
    normalized.includes("compression")
  ) {
    return "Risk-on rally";
  }
  if (
    normalized.includes("escalat") ||
    normalized.includes("spike") ||
    normalized.includes("headline") ||
    normalized.includes("shock") ||
    normalized.includes("risk-off") ||
    normalized.includes("risk off")
  ) {
    return "Escalation";
  }
  return "Continuation";
}

export function normalizeCanonicalIvScenarios(
  scenarios: IVPredictionScenario[] | undefined,
  fallbackScore: number,
): IVPredictionScenario[] {
  const scoreFallback = clampScore(fallbackScore, 0);
  const buckets = new Map<CanonicalIvScenarioLabel, BucketAccumulator>();

  for (const scenario of scenarios ?? []) {
    const slot = matchCanonicalSlot(scenario.label ?? "");
    const probability = clamp01(scenario.probability);
    const projectedScore = clampScore(scenario.projectedScore, scoreFallback);
    const previous = buckets.get(slot) ?? { probability: 0, weightedScore: 0 };
    previous.probability += probability;
    previous.weightedScore += projectedScore * probability;
    buckets.set(slot, previous);
  }

  return CANONICAL_IV_SCENARIO_LABELS.map((label) => {
    const bucket = buckets.get(label);
    const probability = clamp01(bucket?.probability ?? 0);
    const projectedScore =
      bucket && bucket.probability > 0
        ? bucket.weightedScore / bucket.probability
        : scoreFallback;

    return {
      label,
      probability: Number(probability.toFixed(2)),
      projectedScore: Number(
        clampScore(projectedScore, scoreFallback).toFixed(1),
      ),
    };
  });
}
