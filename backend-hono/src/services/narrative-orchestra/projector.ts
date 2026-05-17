import type { Theme } from "../theme-tracker/types.js";
import type { PromotedRiskflowCatalyst } from "./store.js";
import { loadNarrativeSources } from "./store.js";
import type {
  NarrativeEvidence,
  NarrativeHypothesis,
  NarrativeProjection,
} from "./types.js";
import { attachReviewDecisions } from "./review-actions.js";

const FALLBACK_HYPOTHESIS_ID = "hypothesis-market-story-intake";

export async function getNarrativeProjection(): Promise<NarrativeProjection> {
  const sources = await loadNarrativeSources();
  if (sources.loungeHypotheses.length > 0) {
    return {
      hypotheses: await attachReviewDecisions(sources.loungeHypotheses),
      generatedAt: new Date().toISOString(),
      source: "lounge",
      fallbackReason: null,
    };
  }

  return {
    hypotheses: await attachReviewDecisions(
      projectFallbackHypotheses(sources.themes, sources.catalysts),
    ),
    generatedAt: new Date().toISOString(),
    source: "fallback",
    fallbackReason: sources.fallbackReason,
  };
}

export function projectFallbackHypotheses(
  themes: Theme[],
  catalysts: PromotedRiskflowCatalyst[],
): NarrativeHypothesis[] {
  const activeThemes = themes.filter((theme) => theme.status !== "Resolved");
  const hypotheses = activeThemes.map((theme) =>
    projectThemeHypothesis(theme, catalysts),
  );

  const orphanCatalysts = catalysts.filter(
    (catalyst) =>
      !activeThemes.some((theme) => theme.catalystIds.includes(catalyst.id)),
  );
  if (hypotheses.length > 0 || orphanCatalysts.length === 0) return hypotheses;

  return [projectIntakeHypothesis(orphanCatalysts)];
}

function projectThemeHypothesis(
  theme: Theme,
  catalysts: PromotedRiskflowCatalyst[],
): NarrativeHypothesis {
  const themeCatalysts = catalysts.filter((catalyst) =>
    theme.catalystIds.includes(catalyst.id),
  );
  const evidence = [
    createThemeEvidence(theme),
    ...themeCatalysts.map((catalyst) =>
      createRiskflowEvidence(catalyst, theme.id),
    ),
  ];
  const updatedAt = newestTimestamp(evidence.map((item) => item.observedAt));

  return createHypothesis({
    id: `hypothesis-${theme.id}`,
    title: theme.name,
    thesis: `${theme.name} remains a live market story with ${theme.catalystIds.length} linked catalyst${theme.catalystIds.length === 1 ? "" : "s"}.`,
    confidence: clamp(theme.ipv),
    corroborationScore: computeCorroborationScore(evidence),
    themeIds: [theme.id],
    themeId: theme.id,
    catalystIds: theme.catalystIds,
    symbols: unique(themeCatalysts.flatMap((item) => item.symbols)),
    tags: unique([
      theme.status.toLowerCase(),
      ...themeCatalysts.flatMap((item) => item.tags),
    ]),
    evidence,
    createdAt: theme.createdAt,
    updatedAt,
  });
}

function projectIntakeHypothesis(
  catalysts: PromotedRiskflowCatalyst[],
): NarrativeHypothesis {
  const evidence = catalysts
    .slice(0, 12)
    .map((catalyst) =>
      createRiskflowEvidence(catalyst, FALLBACK_HYPOTHESIS_ID),
    );
  const confidence = evidence.length > 0 ? 0.45 : 0.2;

  return createHypothesis({
    id: FALLBACK_HYPOTHESIS_ID,
    title: "Market Story Intake",
    thesis:
      "Promoted RiskFlow catalysts are waiting for Theme Tracker linkage and agent deliberation.",
    confidence,
    corroborationScore: computeCorroborationScore(evidence),
    themeIds: [],
    themeId: null,
    catalystIds: catalysts.map((item) => item.id),
    symbols: unique(catalysts.flatMap((item) => item.symbols)),
    tags: unique(catalysts.flatMap((item) => item.tags)),
    evidence,
    createdAt: newestTimestamp(catalysts.map((item) => item.promotedAt)),
    updatedAt: newestTimestamp(catalysts.map((item) => item.publishedAt)),
  });
}

function createHypothesis(
  input: Omit<
    NarrativeHypothesis,
    "source" | "deliberationSummary" | "routingDecision"
  >,
): NarrativeHypothesis {
  return {
    ...input,
    source: "fallback",
    deliberationSummary: {
      status: "pending",
      consensus: null,
      entries: [],
    },
    routingDecision: {
      status: "candidate",
      rationale: "Awaiting S69 lounge deliberation and human review.",
      nextAction: "review",
      decidedBy: null,
      decidedAt: null,
    },
  };
}

function createThemeEvidence(theme: Theme): NarrativeEvidence {
  return {
    id: `theme-${theme.id}`,
    hypothesisId: `hypothesis-${theme.id}`,
    sourceType: "theme",
    source: "theme",
    sourceId: theme.id,
    title: theme.name,
    summary: `Theme Tracker IPV ${Math.round(theme.ipv * 100)} with ${theme.status.toLowerCase()} status.`,
    stance: theme.status === "Decaying" ? "neutral" : "supports",
    confidence: clamp(theme.ipv),
    observedAt: theme.updatedAt,
    symbols: [],
    tags: [theme.status.toLowerCase()],
  };
}

function createRiskflowEvidence(
  catalyst: PromotedRiskflowCatalyst,
  hypothesisId: string,
): NarrativeEvidence {
  return {
    id: `riskflow-${catalyst.id}`,
    hypothesisId,
    sourceType: "riskflow",
    source: "riskflow",
    sourceId: catalyst.id,
    title: catalyst.headline,
    summary: catalyst.marketImpact ?? catalyst.agentNote ?? catalyst.body,
    stance: catalyst.sentiment.toLowerCase().includes("bear")
      ? "neutral"
      : "supports",
    confidence: clamp(catalyst.ivScore / 10),
    observedAt: catalyst.publishedAt,
    symbols: catalyst.symbols,
    tags: catalyst.tags,
  };
}

function computeCorroborationScore(evidence: NarrativeEvidence[]): number {
  if (evidence.length === 0) return 0;
  const confidence =
    evidence.reduce((sum, item) => sum + item.confidence, 0) / evidence.length;
  const sourceBoost =
    new Set(evidence.map((item) => item.sourceType)).size * 0.12;
  const countBoost = Math.min(evidence.length * 0.04, 0.24);
  return clamp(confidence * 0.7 + sourceBoost + countBoost);
}

function newestTimestamp(values: string[]): string {
  const times = values
    .map((value) => new Date(value).getTime())
    .filter(Number.isFinite);
  if (times.length === 0) return new Date().toISOString();
  return new Date(Math.max(...times)).toISOString();
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, Number(value.toFixed(2))));
}
