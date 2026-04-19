// [claude-code 2026-03-24] Deterministic reactive score adjustment engine — NO LLM calls, purely rule-based.
// Maps RiskFlow items to AgentDesk risk categories and adjusts running analysis scores in real-time.

export type AgentDeskRiskCategory =
  | "geopolitical"
  | "political"
  | "monetary-policy"
  | "earnings-corporate"
  | "market-structure"
  | "black-swan";

export interface RunningAnalysisState {
  baselineRunId: string | null;
  categoryScores: Record<AgentDeskRiskCategory, number>;
  compositeIV: number;
  confidence: number;
  accumulatedItemIds: string[];
  lastUpdateAt: string;
  adjustmentCount: number;
}

const ALL_CATEGORIES: AgentDeskRiskCategory[] = [
  "geopolitical",
  "political",
  "monetary-policy",
  "earnings-corporate",
  "market-structure",
  "black-swan",
];

const CATEGORY_MAP: Record<string, AgentDeskRiskCategory> = {
  fed: "monetary-policy",
  fomc: "monetary-policy",
  rate: "monetary-policy",
  cpi: "monetary-policy",
  inflation: "monetary-policy",
  treasury: "monetary-policy",
  earnings: "earnings-corporate",
  revenue: "earnings-corporate",
  guidance: "earnings-corporate",
  war: "geopolitical",
  sanctions: "geopolitical",
  tariff: "geopolitical",
  nato: "geopolitical",
  election: "political",
  congress: "political",
  legislation: "political",
  liquidity: "market-structure",
  vix: "market-structure",
  margin: "market-structure",
  pandemic: "black-swan",
  earthquake: "black-swan",
  default: "black-swan",
};

function clamp(min: number, max: number, value: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Map a RiskFlow item's tags + headline to one of the 6 AgentDesk risk categories.
 * Checks tags first, then headline keywords. Defaults to 'market-structure'.
 */
export function mapRiskFlowToCategory(
  tags: string[],
  headline: string,
): AgentDeskRiskCategory {
  // Check tags first
  for (const tag of tags) {
    const lower = tag.toLowerCase();
    for (const [keyword, category] of Object.entries(CATEGORY_MAP)) {
      if (lower.includes(keyword)) return category;
    }
  }
  // Fall back to headline keyword scan
  const lowerHeadline = headline.toLowerCase();
  for (const [keyword, category] of Object.entries(CATEGORY_MAP)) {
    if (lowerHeadline.includes(keyword)) return category;
  }
  return "market-structure";
}

/**
 * Apply a deterministic score adjustment for a single RiskFlow item.
 * Returns a new state (does not mutate input).
 */
export function adjustScoresForRiskFlow(
  currentState: RunningAnalysisState,
  item: {
    id: string;
    headline: string;
    tags: string[];
    ivScore: number;
    macroLevel: number;
    sentiment: string;
  },
): RunningAnalysisState {
  const category = mapRiskFlowToCategory(item.tags, item.headline);
  const impactDelta = item.ivScore * (item.macroLevel / 4) * 0.25;
  const oldScore = currentState.categoryScores[category];
  const newCategoryScore = clamp(0, 10, oldScore + impactDelta);

  const updatedScores = {
    ...currentState.categoryScores,
    [category]: newCategoryScore,
  };
  const compositeIV =
    ALL_CATEGORIES.reduce((sum, cat) => sum + updatedScores[cat], 0) /
    ALL_CATEGORIES.length;

  return {
    baselineRunId: currentState.baselineRunId,
    categoryScores: updatedScores,
    compositeIV: Number(compositeIV.toFixed(2)),
    confidence: Number((currentState.confidence * 0.98).toFixed(4)),
    accumulatedItemIds: [...currentState.accumulatedItemIds, item.id],
    lastUpdateAt: new Date().toISOString(),
    adjustmentCount: currentState.adjustmentCount + 1,
  };
}

/** Only trigger reactive adjustment for high-impact items (macroLevel >= 3). */
export function shouldTriggerReactiveAdjustment(macroLevel: number): boolean {
  return macroLevel >= 3;
}

// ── In-memory state ──────────────────────────────────────────────────────────
let _runningState: RunningAnalysisState | null = null;

/** Return the cached composite IV from running state, or 0 if none. */
export function getRunningAnalysisScore(): number {
  return _runningState?.compositeIV ?? 0;
}

export function getRunningState(): RunningAnalysisState | null {
  return _runningState;
}

export function setRunningState(state: RunningAnalysisState): void {
  _runningState = state;
}

/** Initialize fresh running state from a full AgentDesk debate result. */
export function resetRunningState(
  baselineRunId: string,
  categoryScores: Record<AgentDeskRiskCategory, number>,
  compositeIV: number,
): void {
  _runningState = {
    baselineRunId,
    categoryScores: { ...categoryScores },
    compositeIV,
    confidence: 1.0,
    accumulatedItemIds: [],
    lastUpdateAt: new Date().toISOString(),
    adjustmentCount: 0,
  };
}
