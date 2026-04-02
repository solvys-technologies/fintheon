// [claude-code 2026-03-28] S8-T5: MiroShark gov official agents, deliberation pipeline types
// [claude-code 2026-03-24] Added RunningAnalysisSnapshot, RollingWindowQuery, AggregatedRollingData, MiroSharkRunSummary
// [claude-code 2026-03-23] MiroShark simulation engine types

export type MiroSharkRiskCategory =
  | 'geopolitical'
  | 'political'
  | 'monetary-policy'
  | 'earnings-corporate'
  | 'market-structure'
  | 'black-swan';

export interface MiroSharkAgent {
  id: string;
  persona: string;
  role: 'macro-strategist' | 'sentiment-analyst' | 'geopolitical-analyst' | 'earnings-analyst' | 'risk-manager' | 'contrarian' | 'fundamentals' | 'sentiment'
    | 'central-banker' | 'executive' | 'treasury-secretary' | 'foreign-policy' | 'commerce-secretary' | 'middle-east-envoy' | 'trade-rep' | 'trade-advisor';
  narrativeCategories: string[];
}

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
  categoryScores: MiroSharkCategoryScore[];
}

export interface HermesDeliberation {
  agentId: string;
  name: string;
  verdict: 'agree' | 'disagree' | 'nuance';
  reasoning: string;
  confidence: number;
}

export interface HarperOpusScoring {
  compositeIV: number;
  regimeShiftProbability: number;
  categoryScores: MiroSharkCategoryScore[];
  surfacedTheses: string[];
  downgradedTheses: string[];
  finalBriefing: string;
  actionabilityScore: number;
  contestedTheses: string[];
}

export type DeliberationPhase = 'idle' | 'miroshark-sim' | 'hermes-deliberation' | 'harper-scoring' | 'complete' | 'interrupted';

export interface DeliberationState {
  simulationId: string;
  phase: DeliberationPhase;
  phaseStartedAt: string;
  mirosharkResults?: GovOfficialAssessment[];
  hermesResults?: HermesDeliberation[];
  harperScoring?: HarperOpusScoring;
  userInjection?: string;
  error?: string;
}

export interface MiroSharkEntity {
  id: string;
  type: 'narrative' | 'event' | 'indicator';
  label: string;
  properties: Record<string, unknown>;
}

export interface MiroSharkRelationship {
  fromId: string;
  toId: string;
  type: 'reinforces' | 'contradicts' | 'causes' | 'correlates';
  weight: number;
}

export interface MiroSharkSeed {
  entities: MiroSharkEntity[];
  relationships: MiroSharkRelationship[];
  environmentalContext: Record<string, unknown>;
  agents: MiroSharkAgent[];
  timestamp: string;
}

export interface MiroSharkSimulation {
  id: string;
  status: 'queued' | 'running' | 'complete' | 'error';
  progress: number;
  startedAt: string;
  completedAt?: string;
  error?: string;
}

export interface MiroSharkScenario {
  label: string;
  probability: number;
  projectedIVScore: number;
  description: string;
  agentConsensus: number;
}

export interface MiroSharkCategoryScore {
  category: MiroSharkRiskCategory;
  ivScore: number;
  confidence: number;
  delta: number;
}

export interface MiroSharkTimePoint {
  dayOffset: number;
  date: string;
  composite: number;
  categories: Record<MiroSharkRiskCategory, number>;
}

export interface MiroSharkGeneratedEvent {
  id: string;
  title: string;
  description: string;
  date: string;
  category: MiroSharkRiskCategory;
  impactScore: number;
  probability: number;
  isAiGenerated: true;
}

export interface MiroSharkAgentResponse {
  agentId: string;
  projectedIVScore: number;
  regimeShiftProbability: number;
  categoryScores: MiroSharkCategoryScore[];
  scenarios: MiroSharkScenario[];
  generatedEvents: MiroSharkGeneratedEvent[];
  reasoning: string;
}

export interface MiroSharkReport {
  simulationId: string;
  scenarios: MiroSharkScenario[];
  regimeShiftProbability: number;
  nextSessionProjection: number;
  confidence: number;
  agentVotes: Array<{ agentId: string; position: string; confidence: number }>;
  categoryScores: MiroSharkCategoryScore[];
  timeSeries: MiroSharkTimePoint[];
  generatedEvents: MiroSharkGeneratedEvent[];
  generatedAt: string;
  briefing?: MiroSharkBriefing;
  contextSnapshot?: SimulationContext;
}

export interface MiroSharkPrediction {
  simulationId: string;
  nextSessionScore: number;
  confidence: number;
  regimeShiftProbability: number;
  scenarios: Array<{
    label: string;
    probability: number;
    projectedScore: number;
  }>;
  categoryScores?: MiroSharkCategoryScore[];
  timeSeries?: MiroSharkTimePoint[];
  generatedEvents?: MiroSharkGeneratedEvent[];
  briefing?: MiroSharkBriefing;
  contextSnapshot?: SimulationContext;
  source: 'miroshark';
  generatedAt: string;
}

export interface MiroSharkInjection {
  variable: string;
  targetNarrativeIds: string[];
  description: string;
}

// --- Preset & Context Types ---

export type SanctumPreset = 'full-brief' | 'chart-focus' | 'econ-watch' | 'risk-scan';

export interface RiskFlowHeadline {
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
    beatMiss?: 'beat' | 'miss' | 'inline';
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
  direction: 'beat' | 'miss' | 'inline' | null;
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

export interface MiroSharkBriefing {
  summary: string;
  keyFindings: string[];
  riskAlerts: string[];
  agentConsensus: string;
  generatedAt: string;
}

export interface MiroSharkRunRecord {
  id: string;
  simulation_id: string;
  preset: SanctumPreset;
  composite_iv: number;
  regime_shift_probability: number;
  confidence: number;
  briefing_text: string;
  category_scores: MiroSharkCategoryScore[];
  scenarios: MiroSharkScenario[];
  context_snapshot: SimulationContext;
  created_at: string;
}

// --- Running Analysis + Rolling Window Types ---

export interface RunningAnalysisSnapshot {
  compositeIV: number;
  categoryScores: MiroSharkCategoryScore[];
  confidence: number;
  adjustmentCount: number;
  lastUpdateAt: string;
  baselineRunId: string | null;
  accumulatedItemCount: number;
}

export interface RollingWindowQuery {
  days: 1 | 7 | 14 | 30;
  preset?: SanctumPreset;
  limit?: number;
}

export interface AggregatedRollingData {
  runs: MiroSharkRunSummary[];
  avgCompositeIV: number;
  avgConfidence: number;
  avgRegimeShift: number;
  trendDirection: 'rising' | 'falling' | 'stable';
  periodStart: string;
  periodEnd: string;
}

export interface MiroSharkRunSummary {
  simulationId: string;
  preset: SanctumPreset;
  compositeIV: number;
  confidence: number;
  regimeShiftProbability: number;
  briefingText: string;
  categoryScores: MiroSharkCategoryScore[];
  scenarios: MiroSharkScenario[];
  createdAt: string;
}
