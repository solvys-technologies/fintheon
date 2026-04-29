// [claude-code 2026-03-28] S8-T5: AgentDesk gov official agents, deliberation pipeline types
// [claude-code 2026-03-24] Added RunningAnalysisSnapshot, RollingWindowQuery, AggregatedRollingData, AgentDeskRunSummary
// [claude-code 2026-03-23] AgentDesk simulation engine types

export type AgentDeskRiskCategory =
  | "geopolitical"
  | "political"
  | "monetary-policy"
  | "earnings-corporate"
  | "market-structure"
  | "black-swan";

export interface AgentDeskAgent {
  id: string;
  persona: string;
  role:
    | "macro-strategist"
    | "sentiment-analyst"
    | "geopolitical-analyst"
    | "earnings-analyst"
    | "risk-manager"
    | "contrarian"
    | "fundamentals"
    | "sentiment"
    | "central-banker"
    | "executive"
    | "treasury-secretary"
    | "foreign-policy"
    | "commerce-secretary"
    | "middle-east-envoy"
    | "trade-rep"
    | "trade-advisor"
    | "flow-analyst"
    | "vol-analyst"
    | "macro-analyst"
    | "credit-analyst";
  narrativeCategories: string[];
}

/** Which layer produced a deliberation result */
export type DebateLayer = "market-analysts" | "gov-officials";

// ── Deliberation Pipeline Types ─────────────────────────────────────────────

export interface GovOfficialAssessment {
  agentId: string;
  name: string;
  role: string;
  assessment: string;
  confidence: number;
  keyConcern: string;
  recommendedAction: string;
  projectedIVScore: number;
  regimeShiftProbability: number;
  categoryScores: AgentDeskCategoryScore[];
}

export interface HermesDeliberation {
  agentId: string;
  name: string;
  verdict: "agree" | "disagree" | "nuance";
  reasoning: string;
  confidence: number;
}

export interface harper-2_1Scoring {
  compositeIV: number;
  regimeShiftProbability: number;
  categoryScores: AgentDeskCategoryScore[];
  surfacedTheses: string[];
  downgradedTheses: string[];
  finalBriefing: string;
  actionabilityScore: number;
  contestedTheses: string[];
  /** Consensus score 0-100. 40-70 = healthy. 90+ = groupthink risk. */
  consensusScore?: number;
  /** Number of analysts whose projectedIV diverges by > 1.5 from mean */
  healthyDisagreementCount?: number;
  /** Whether the devil's advocate contrarian was triggered */
  contrarianTriggered?: boolean;
}

export type DeliberationPhase =
  | "idle"
  | "market-analysts"
  | "gov-officials"
  | "hermes-deliberation"
  | "harper-scoring"
  | "complete"
  | "interrupted";

export interface DeliberationState {
  simulationId: string;
  phase: DeliberationPhase;
  phaseStartedAt: string;
  /** Phase 1: Market analyst assessments (primary layer) */
  analystResults?: MarketAnalystAssessment[];
  /** Phase 1.5: Gov official assessments (conditional — geopolitical content) */
  agentDeskResults?: GovOfficialAssessment[];
  /** Whether the gov-official phase was skipped */
  govOfficialsSkipped?: boolean;
  hermesResults?: HermesDeliberation[];
  harperScoring?: harper-2_1Scoring;
  userInjection?: string;
  error?: string;
}

export interface AgentDeskEntity {
  id: string;
  type: "narrative" | "event" | "indicator";
  label: string;
  properties: Record<string, unknown>;
}

export interface AgentDeskRelationship {
  fromId: string;
  toId: string;
  type: "reinforces" | "contradicts" | "causes" | "correlates";
  weight: number;
}

export interface AgentDeskSeed {
  entities: AgentDeskEntity[];
  relationships: AgentDeskRelationship[];
  environmentalContext: Record<string, unknown>;
  agents: AgentDeskAgent[];
  timestamp: string;
}

export interface AgentDeskSimulation {
  id: string;
  status: "queued" | "running" | "complete" | "error";
  progress: number;
  startedAt: string;
  completedAt?: string;
  error?: string;
}

export interface AgentDeskScenario {
  label: string;
  probability: number;
  projectedIVScore: number;
  description: string;
  agentConsensus: number;
}

export interface AgentDeskCategoryScore {
  category: AgentDeskRiskCategory;
  ivScore: number;
  confidence: number;
  delta: number;
}

export interface AgentDeskTimePoint {
  dayOffset: number;
  date: string;
  composite: number;
  categories: Record<AgentDeskRiskCategory, number>;
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

export interface AgentDeskAgentResponse {
  agentId: string;
  projectedIVScore: number;
  regimeShiftProbability: number;
  categoryScores: AgentDeskCategoryScore[];
  scenarios: AgentDeskScenario[];
  generatedEvents: AgentDeskGeneratedEvent[];
  reasoning: string;
}

export interface AgentDeskReport {
  simulationId: string;
  scenarios: AgentDeskScenario[];
  regimeShiftProbability: number;
  nextSessionProjection: number;
  confidence: number;
  agentVotes: Array<{ agentId: string; position: string; confidence: number }>;
  categoryScores: AgentDeskCategoryScore[];
  timeSeries: AgentDeskTimePoint[];
  generatedEvents: AgentDeskGeneratedEvent[];
  generatedAt: string;
  briefing?: AgentDeskBriefing;
  contextSnapshot?: SimulationContext;
  /** Which debate layer produced this report */
  debateLayer?: DebateLayer;
  /** Whether the gov-official layer was also run (geopolitical content detected) */
  govOfficialReport?: AgentDeskReport;
}

// ── Market Analyst Assessment (Sprint 2 deliberation) ──────────────────────

export interface MarketAnalystAssessment {
  agentId: string;
  name: string;
  title: string;
  role: string;
  subjects: string[];
  assessment: string;
  confidence: number;
  keyConcern: string;
  projectedIVScore: number;
  regimeShiftProbability: number;
  categoryScores: AgentDeskCategoryScore[];
  headlineCount: number;
}

export interface AgentDeskPrediction {
  simulationId: string;
  nextSessionScore: number;
  confidence: number;
  regimeShiftProbability: number;
  scenarios: Array<{
    label: string;
    probability: number;
    projectedScore: number;
  }>;
  categoryScores?: AgentDeskCategoryScore[];
  timeSeries?: AgentDeskTimePoint[];
  generatedEvents?: AgentDeskGeneratedEvent[];
  briefing?: AgentDeskBriefing;
  contextSnapshot?: SimulationContext;
  source: "agentDesk";
  generatedAt: string;
}

export interface AgentDeskInjection {
  variable: string;
  targetNarrativeIds: string[];
  description: string;
}

// --- Preset & Context Types ---

export type SanctumPreset =
  | "full-brief"
  | "chart-focus"
  | "econ-watch"
  | "risk-scan";

export interface RiskFlowHeadline {
  id: string;
  headline: string;
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
  riskflowHeadlines: RiskFlowHeadline[];
  econPrintHistory?: EconPrintStat[];
  fredFetchedAt: string | null;
  fetchedAt: string;
}

export interface AgentDeskBriefing {
  summary: string;
  keyFindings: string[];
  riskAlerts: string[];
  agentConsensus: string;
  /** Harper AI-generated narrative analysis — deeper than deterministic briefing */
  harperAnalysis?: string;
  generatedAt: string;
}

export interface AgentDeskRunRecord {
  id: string;
  simulation_id: string;
  preset: SanctumPreset;
  composite_iv: number;
  regime_shift_probability: number;
  confidence: number;
  briefing_text: string;
  category_scores: AgentDeskCategoryScore[];
  scenarios: AgentDeskScenario[];
  context_snapshot: SimulationContext;
  created_at: string;
}

// --- Running Analysis + Rolling Window Types ---

export interface RunningAnalysisSnapshot {
  compositeIV: number;
  categoryScores: AgentDeskCategoryScore[];
  confidence: number;
  adjustmentCount: number;
  lastUpdateAt: string;
  baselineRunId: string | null;
  accumulatedItemCount: number;
}

export interface RollingWindowQuery {
  days: 1 | 5 | 7 | 14 | 30;
  preset?: SanctumPreset;
  limit?: number;
}

export interface AggregatedRollingData {
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
