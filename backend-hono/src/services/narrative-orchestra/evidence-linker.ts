import type { Theme } from "../theme-tracker/types.js";
import type {
  NarrativeEvidence,
  NarrativeEvidenceStance,
  NarrativeHypothesis,
} from "./types.js";

export interface RiskFlowEvidenceSource {
  id?: string;
  tweet_id?: string;
  sourceId?: string;
  headline?: string;
  body?: string;
  summary?: string;
  sentiment?: string;
  stance?: string;
  iv_score?: number;
  macro_level?: number;
  published_at?: string;
  analyzed_at?: string;
  created_at?: string;
  price_brain_score?: Record<string, unknown> | null;
}

export interface EvidenceLinkInput {
  themes: Theme[];
  riskflowCatalysts: RiskFlowEvidenceSource[];
  hypotheses?: NarrativeHypothesis[];
  now?: string;
}

export interface LinkedEvidenceResult {
  evidence: NarrativeEvidence[];
  evidenceByHypothesisId: Record<string, NarrativeEvidence[]>;
  catalystHypothesisIds: Record<string, string>;
}

export function linkEvidenceToHypotheses(
  input: EvidenceLinkInput,
): LinkedEvidenceResult {
  const catalystHypothesisIds = mapCatalystsToHypotheses(input);
  const evidence = input.riskflowCatalysts
    .map((source) =>
      buildRiskFlowEvidence({
        source,
        hypothesisId: resolveHypothesisIdForCatalyst({
          catalystId: getSourceId(source),
          catalystHypothesisIds,
          fallbackTitle: source.headline,
        }),
        now: input.now,
      }),
    )
    .filter((item): item is NarrativeEvidence => Boolean(item));

  return {
    evidence,
    evidenceByHypothesisId: groupEvidenceByHypothesis(evidence),
    catalystHypothesisIds,
  };
}

export function groupEvidenceByStance(
  evidence: NarrativeEvidence[],
): Record<NarrativeEvidenceStance, NarrativeEvidence[]> {
  return {
    supports: evidence.filter((item) => item.stance === "supports"),
    contradicts: evidence.filter((item) => item.stance === "contradicts"),
    neutral: evidence.filter((item) => item.stance === "neutral"),
  };
}

export function resolveHypothesisIdForCatalyst(input: {
  catalystId?: string;
  catalystHypothesisIds: Record<string, string>;
  fallbackTitle?: string;
}): string {
  if (input.catalystId && input.catalystHypothesisIds[input.catalystId]) {
    return input.catalystHypothesisIds[input.catalystId];
  }
  return `hypothesis:riskflow:${slugFor(input.catalystId || input.fallbackTitle || "unlinked")}`;
}

function mapCatalystsToHypotheses(
  input: EvidenceLinkInput,
): Record<string, string> {
  const hypothesisByTheme = new Map(
    (input.hypotheses ?? [])
      .filter((hypothesis) => hypothesis.themeId)
      .map((hypothesis) => [hypothesis.themeId as string, hypothesis.id]),
  );
  const catalystHypothesisIds: Record<string, string> = {};

  for (const theme of input.themes) {
    const hypothesisId =
      hypothesisByTheme.get(theme.id) ?? `hypothesis:${theme.id}`;
    for (const catalystId of theme.catalystIds) {
      catalystHypothesisIds[catalystId] = hypothesisId;
    }
  }

  for (const source of input.riskflowCatalysts) {
    const sourceId = getSourceId(source);
    const explicitHypothesisId = getString(
      source.price_brain_score?.hypothesisId,
    );
    if (sourceId && explicitHypothesisId) {
      catalystHypothesisIds[sourceId] = explicitHypothesisId;
    }
  }

  return catalystHypothesisIds;
}

function buildRiskFlowEvidence(input: {
  source: RiskFlowEvidenceSource;
  hypothesisId: string;
  now?: string;
}): NarrativeEvidence | null {
  const sourceId = getSourceId(input.source);
  if (!sourceId) return null;

  const title = input.source.headline || input.source.summary || sourceId;
  return {
    id: `evidence:riskflow:${sourceId}`,
    hypothesisId: input.hypothesisId,
    sourceType: "riskflow",
    sourceId,
    title,
    summary: input.source.summary || input.source.body,
    stance: inferEvidenceStance(input.source),
    confidence: inferEvidenceConfidence(input.source),
    observedAt:
      input.source.published_at ||
      input.source.analyzed_at ||
      input.source.created_at ||
      input.now ||
      new Date().toISOString(),
  };
}

function inferEvidenceStance(
  source: RiskFlowEvidenceSource,
): NarrativeEvidenceStance {
  const explicit = source.stance || getString(source.price_brain_score?.stance);
  if (explicit) return normalizeStance(explicit);

  const headline = source.headline?.toLowerCase() ?? "";
  if (
    /\b(denies|walks back|reverses|contradicts|refutes|false)\b/.test(headline)
  ) {
    return "contradicts";
  }

  const score = source.iv_score ?? 0;
  const macroLevel = source.macro_level ?? 0;
  if (score >= 7 || macroLevel >= 3) return "supports";

  return "neutral";
}

function normalizeStance(stance: string): NarrativeEvidenceStance {
  const normalized = stance.toLowerCase();
  if (normalized.includes("contradict") || normalized.includes("oppose")) {
    return "contradicts";
  }
  if (normalized.includes("support") || normalized.includes("reinforce")) {
    return "supports";
  }
  return "neutral";
}

function inferEvidenceConfidence(source: RiskFlowEvidenceSource): number {
  const rawConfidence = Number(source.price_brain_score?.confidence);
  if (Number.isFinite(rawConfidence)) return clamp01(rawConfidence);

  const ivScore = clamp01((source.iv_score ?? 0) / 10);
  const macroScore = clamp01((source.macro_level ?? 0) / 4);
  return Number(Math.max(0.25, ivScore * 0.65 + macroScore * 0.35).toFixed(2));
}

function groupEvidenceByHypothesis(
  evidence: NarrativeEvidence[],
): Record<string, NarrativeEvidence[]> {
  return evidence.reduce<Record<string, NarrativeEvidence[]>>(
    (groups, item) => {
      groups[item.hypothesisId] = [...(groups[item.hypothesisId] ?? []), item];
      return groups;
    },
    {},
  );
}

function getSourceId(source: RiskFlowEvidenceSource): string | undefined {
  return source.sourceId || source.tweet_id || source.id;
}

function getString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function slugFor(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}
