// [claude-code 2026-03-23] AgentDesk Sanctum frontend types — expanded for snap-scroll dashboard + presets

export type AgentDeskRiskCategory =
  | "geopolitical"
  | "political"
  | "monetary-policy"
  | "earnings-corporate"
  | "market-structure"
  | "black-swan";

export interface AgentDeskCategoryScore {
  category: AgentDeskRiskCategory;
  ivScore: number;
  confidence: number;
  delta: number;
  description?: string;
}

export interface AgentDeskTimePoint {
  dayOffset: number;
  date: string;
  composite: number;
  categories: Record<AgentDeskRiskCategory, number>;
  impliedPoints?: number;
}

export interface AgentDeskGeneratedEvent {
  id: string;
  title: string;
  description: string;
  date: string;
  category: AgentDeskRiskCategory;
  impactScore: number;
  probability: number;
  isAiGenerated: true;
}

export interface AgentDeskScenario {
  label: string;
  probability: number;
  projectedScore: number;
  description?: string;
  agentConsensus?: number;
}

export interface SanctumData {
  simulationId: string;
  status: "idle" | "running" | "complete" | "error";
  error?: string;
  compositeIV: number;
  confidence: number;
  regimeShiftProbability: number;
  categoryScores: AgentDeskCategoryScore[];
  timeSeries: AgentDeskTimePoint[];
  generatedEvents: AgentDeskGeneratedEvent[];
  scenarios: AgentDeskScenario[];
  briefing?: AgentDeskBriefing;
  contextSnapshot?: SimulationContext;
}

export const RISK_CATEGORY_LABELS: Record<AgentDeskRiskCategory, string> = {
  geopolitical: "Geopolitical",
  political: "Political",
  "monetary-policy": "Monetary Policy",
  "earnings-corporate": "Earnings",
  "market-structure": "Mkt Structure",
  "black-swan": "Black Swan",
};

/** @deprecated Use ivHeatColor(score) instead — dynamic heat-map coloring based on IV value */
export const RISK_CATEGORY_COLORS: Record<AgentDeskRiskCategory, string> = {
  geopolitical: "#EF4444",
  political: "#8B5CF6",
  "monetary-policy": "#3B82F6",
  "earnings-corporate": "#10B981",
  "market-structure": "#F59E0B",
  "black-swan": "#EC4899",
};

/**
 * Dynamic heat-map color: low IV → teal, mid → amber, high → red.
 * Score expected 0–10. Clamps to range.
 */
export function ivHeatColor(score: number): string {
  const t = Math.max(0, Math.min(1, score / 10));
  // 0.0 → teal #14B8A6, 0.5 → amber #F59E0B, 1.0 → red #EF4444
  if (t <= 0.5) {
    const p = t / 0.5; // 0→1 within low–mid
    const r = Math.round(0x14 + (0xf5 - 0x14) * p);
    const g = Math.round(0xb8 + (0x9e - 0xb8) * p);
    const b = Math.round(0xa6 + (0x0b - 0xa6) * p);
    return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
  }
  const p = (t - 0.5) / 0.5; // 0→1 within mid–high
  const r = Math.round(0xf5 + (0xef - 0xf5) * p);
  const g = Math.round(0x9e + (0x44 - 0x9e) * p);
  const b = Math.round(0x0b + (0x44 - 0x0b) * p);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

export const COMPOSITE_COLOR = "#c79f4a";

// --- Sanctum Preset System ---

export type SanctumPreset =
  | "full-brief"
  | "chart-focus"
  | "econ-watch"
  | "risk-scan";

export const AUDITORIUM_PRESETS: {
  id: SanctumPreset;
  label: string;
  description: string;
}[] = [
  { id: "full-brief", label: "Command", description: "Command Center" },
  { id: "chart-focus", label: "Chart", description: "Chart overlay" },
  { id: "econ-watch", label: "Econ", description: "Economic Intelligence" },
  { id: "risk-scan", label: "Risk", description: "Risk & Narratives" },
];

export const AUDITORIUM_PAGES = [
  "Command Center",
  "Econ Intel",
  "Risk & Narratives",
  "Narrative Flow",
] as const;

// --- Economic Intelligence Types ---

export interface EconEvent {
  id: string;
  name: string;
  date: string;
  time?: string;
  country: string;
  importance: 1 | 2 | 3;
  forecast?: string;
  previous?: string;
  actual?: string;
  category?: string;
}

export interface EconPrint {
  id: string;
  eventName: string;
  date: string;
  actual: number;
  forecast: number;
  previous: number;
  surprise: number;
  direction: "beat" | "miss" | "inline";
}

export interface EconHistoryPrint {
  id?: string;
  date: string | null;
  actual: number | null;
  forecast: number | null;
  previous: number | null;
  surprise: number | null;
  direction: "beat" | "miss" | "inline" | null;
  ivScore: number | null;
}

export interface EconScoredItem {
  id: string;
  headline: string;
  ivScore: number | null;
  macroLevel: number | null;
  sentiment: string | null;
  riskType: string | null;
  subScores: {
    eventWeight?: number;
    timing?: number;
    deviation?: number;
    momentum?: number;
    vixContext?: number;
    vixMultiplier?: number;
    regimeMultiplier?: number;
    regimeName?: string;
  } | null;
  econData: {
    actual?: number;
    forecast?: number;
    previous?: number;
    beatMiss?: "beat" | "miss" | "inline";
    surprisePercent?: number;
  } | null;
  publishedAt: string | null;
  marketImpact?: {
    nq: { points: number; percent: number } | null;
    es: { points: number; percent: number } | null;
    ym: { points: number; percent: number } | null;
    asOf: string;
  };
}

export interface EconCardData {
  name: string;
  ticker: string;
  nextDate?: string;
  lastPrint?: EconPrint;
  printHistory?: EconHistoryPrint[];
  scoredItems?: EconScoredItem[];
  agentConsensus?: "beat" | "miss" | "inline";
  agentConfidence?: number;
}

// --- Simulation Context & Briefing ---

export interface RiskFlowCatalyst {
  id: string;
  title: string;
  summary: string;
  macro_level: number;
  sentiment: string;
  iv_score: number;
  category?: string;
  created_at: string;
  sub_scores?: {
    eventWeight?: number;
    timing?: number;
    deviation?: number;
    momentum?: number;
    vixContext?: number;
    vixMultiplier?: number;
    regimeMultiplier?: number;
    regimeName?: string;
    commentatorMultiplier?: number;
    speaker?: string | null;
  } | null;
  econ_data?: {
    actual?: number;
    forecast?: number;
    previous?: number;
    beatMiss?: "beat" | "miss" | "inline";
    surprisePercent?: number;
  } | null;
  risk_type?: string | null;
  agent_note?: string | null;
  price_brain_score?: {
    sentiment?: string;
    classification?: string;
    impliedPoints?: number | null;
    instrument?: string | null;
  } | null;
  narrative_threads?: string[];
}

export interface EconPrintStat {
  eventName: string;
  actual: number | null;
  forecast: number | null;
  previous: number | null;
  surprise: number | null;
  direction: "beat" | "miss" | "inline" | null;
  ivScore: number | null;
  printedAt: string | null;
}

export interface SimulationContext {
  vixLevel: number | null;
  fredIndicators: Record<string, number>;
  riskflowHeadlines: RiskFlowCatalyst[];
  econPrintHistory?: EconPrintStat[];
  fredFetchedAt: string | null;
  fetchedAt: string;
}

export interface AgentDeskBriefing {
  summary: string;
  keyFindings: string[];
  riskAlerts: string[];
  agentConsensus: string;
  /** Harper AI-generated narrative analysis */
  harperAnalysis?: string;
  generatedAt: string;
}

export interface MacroIndicator {
  key: string;
  label: string;
  value: number;
  unit: string;
  stressLevel: "low" | "moderate" | "elevated" | "high";
}

export interface SanctumNarrative {
  id: string;
  title: string;
  category: string;
  directionBias: string;
  healthScore: number;
  instruments: string[];
  status: string;
  dateRange: { start: string; end: string | null };
}

export interface AgentDeskRunRecord {
  id: string;
  simulation_id: string;
  preset: SanctumPreset;
  composite_iv: number;
  regime_shift_probability: number;
  confidence: number;
  briefing_text: string;
  created_at: string;
}

// ── Running Analysis Types ──

export interface RunningAnalysisSnapshot {
  compositeIV: number;
  categoryScores: AgentDeskCategoryScore[];
  confidence: number;
  adjustmentCount: number;
  lastUpdateAt: string;
  baselineRunId: string | null;
  accumulatedItemCount: number;
}

export interface RollingWindowData {
  runs: AgentDeskRunSummary[];
  avgCompositeIV: number;
  avgConfidence: number;
  avgRegimeShift: number;
  trendDirection: "rising" | "falling" | "stable";
  periodStart: string;
  periodEnd: string;
}

export interface AgentDeskRunSummary {
  simulationId: string;
  preset: SanctumPreset;
  compositeIV: number;
  confidence: number;
  regimeShiftProbability: number;
  briefingText: string;
  categoryScores: AgentDeskCategoryScore[];
  scenarios: AgentDeskScenario[];
  createdAt: string;
}
