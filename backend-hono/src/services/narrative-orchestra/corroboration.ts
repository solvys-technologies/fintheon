import type {
  NarrativeEvidence,
  NarrativeEvidenceStance,
} from "./types.js";
import { groupEvidenceByStance } from "./evidence-linker.js";

export interface CorroborationInput {
  evidence: NarrativeEvidence[];
  now?: string | Date;
}

export interface CorroborationFactor {
  id: string;
  label: string;
  value: number;
  weight: number;
  explanation: string;
}

export interface CorroborationResult {
  score: number;
  stanceCounts: Record<NarrativeEvidenceStance, number>;
  factors: CorroborationFactor[];
  explanation: string;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function computeCorroborationScore(
  input: CorroborationInput,
): CorroborationResult {
  const now = input.now ? new Date(input.now) : new Date();
  const groups = groupEvidenceByStance(input.evidence);
  const stanceCounts = {
    supports: groups.supports.length,
    contradicts: groups.contradicts.length,
    neutral: groups.neutral.length,
  };

  if (input.evidence.length === 0) {
    return {
      score: 0,
      stanceCounts,
      factors: [],
      explanation: "No linked evidence yet.",
    };
  }

  const factors = [
    buildCountFactor(input.evidence.length),
    buildStanceFactor(stanceCounts),
    buildRecencyFactor(input.evidence, now),
    buildConfidenceFactor(input.evidence),
  ];
  const weightedScore = factors.reduce(
    (total, factor) => total + factor.value * factor.weight,
    0,
  );
  const totalWeight = factors.reduce((total, factor) => total + factor.weight, 0);
  const score = Math.round((weightedScore / totalWeight) * 100);

  return {
    score,
    stanceCounts,
    factors,
    explanation: buildExplanation(score, stanceCounts, factors),
  };
}

function buildCountFactor(count: number): CorroborationFactor {
  const value = Math.min(count / 5, 1);
  return {
    id: "count",
    label: "Evidence count",
    value,
    weight: 0.25,
    explanation: `${count} linked item${count === 1 ? "" : "s"} across the hypothesis.`,
  };
}

function buildStanceFactor(
  counts: Record<NarrativeEvidenceStance, number>,
): CorroborationFactor {
  const total = counts.supports + counts.contradicts + counts.neutral;
  const supportShare = total > 0 ? counts.supports / total : 0;
  const contradictionShare = total > 0 ? counts.contradicts / total : 0;
  const neutralShare = total > 0 ? counts.neutral / total : 0;
  const value = clamp01(supportShare + neutralShare * 0.35 - contradictionShare * 0.7);

  return {
    id: "stance-mix",
    label: "Stance mix",
    value,
    weight: 0.3,
    explanation:
      `${counts.supports} supporting, ${counts.contradicts} contradicting, ` +
      `${counts.neutral} neutral.`,
  };
}

function buildRecencyFactor(
  evidence: NarrativeEvidence[],
  now: Date,
): CorroborationFactor {
  const recencyScores = evidence.map((item) => {
    const observedAt = new Date(item.observedAt).getTime();
    if (!Number.isFinite(observedAt)) return 0.4;
    const ageDays = Math.max(0, (now.getTime() - observedAt) / MS_PER_DAY);
    return Math.exp(-ageDays / 2);
  });
  const value = average(recencyScores);

  return {
    id: "recency",
    label: "Recency",
    value,
    weight: 0.2,
    explanation: `${Math.round(value * 100)}% recency strength after time decay.`,
  };
}

function buildConfidenceFactor(
  evidence: NarrativeEvidence[],
): CorroborationFactor {
  const value = average(evidence.map((item) => clamp01(item.confidence)));
  return {
    id: "confidence",
    label: "Source confidence",
    value,
    weight: 0.25,
    explanation: `${Math.round(value * 100)}% average evidence confidence.`,
  };
}

function buildExplanation(
  score: number,
  counts: Record<NarrativeEvidenceStance, number>,
  factors: CorroborationFactor[],
): string {
  const strongest = [...factors].sort((a, b) => b.value - a.value)[0];
  const dissent =
    counts.contradicts > 0
      ? `${counts.contradicts} contradicting item${counts.contradicts === 1 ? "" : "s"} keep it fragile`
      : "no direct contradiction linked";
  return `Corroboration ${score}/100: ${strongest.explanation} ${dissent}.`;
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  const total = values.reduce((sum, value) => sum + value, 0);
  return clamp01(total / values.length);
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}
