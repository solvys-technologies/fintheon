// [claude-code 2026-03-16] MiroFish simulation engine types
// [claude-code 2026-03-16] Extended with risk categories, time series, generated events for Auditorium

export type MiroFishRiskCategory =
  | 'geopolitical'
  | 'political'
  | 'monetary-policy'
  | 'earnings-corporate'
  | 'market-structure'
  | 'black-swan';

export interface MiroFishAgent {
  id: string;
  persona: string;
  role: 'macro-strategist' | 'sentiment-analyst' | 'geopolitical-analyst' | 'earnings-analyst' | 'risk-manager' | 'contrarian' | 'fundamentals' | 'sentiment';
  narrativeCategories: string[];
}

export interface MiroFishEntity {
  id: string;
  type: 'narrative' | 'event' | 'indicator';
  label: string;
  properties: Record<string, unknown>;
}

export interface MiroFishRelationship {
  fromId: string;
  toId: string;
  type: 'reinforces' | 'contradicts' | 'causes' | 'correlates';
  weight: number;
}

export interface MiroFishSeed {
  entities: MiroFishEntity[];
  relationships: MiroFishRelationship[];
  environmentalContext: Record<string, unknown>;
  agents: MiroFishAgent[];
  timestamp: string;
}

export interface MiroFishSimulation {
  id: string;
  status: 'queued' | 'running' | 'complete' | 'error';
  progress: number;
  startedAt: string;
  completedAt?: string;
  error?: string;
}

export interface MiroFishScenario {
  label: string;
  probability: number;
  projectedIVScore: number;
  description: string;
  agentConsensus: number;
}

export interface MiroFishCategoryScore {
  category: MiroFishRiskCategory;
  ivScore: number;
  confidence: number;
  delta: number;
}

export interface MiroFishTimePoint {
  dayOffset: number;
  date: string;
  composite: number;
  categories: Record<MiroFishRiskCategory, number>;
}

export interface MiroFishGeneratedEvent {
  id: string;
  title: string;
  description: string;
  date: string;
  category: MiroFishRiskCategory;
  impactScore: number;
  probability: number;
  isAiGenerated: true;
}

export interface MiroFishAgentResponse {
  agentId: string;
  projectedIVScore: number;
  regimeShiftProbability: number;
  categoryScores: MiroFishCategoryScore[];
  scenarios: MiroFishScenario[];
  generatedEvents: MiroFishGeneratedEvent[];
  reasoning: string;
}

export interface MiroFishReport {
  simulationId: string;
  scenarios: MiroFishScenario[];
  regimeShiftProbability: number;
  nextSessionProjection: number;
  confidence: number;
  agentVotes: Array<{ agentId: string; position: string; confidence: number }>;
  categoryScores: MiroFishCategoryScore[];
  timeSeries: MiroFishTimePoint[];
  generatedEvents: MiroFishGeneratedEvent[];
  generatedAt: string;
}

export interface MiroFishPrediction {
  simulationId: string;
  nextSessionScore: number;
  confidence: number;
  regimeShiftProbability: number;
  scenarios: Array<{
    label: string;
    probability: number;
    projectedScore: number;
  }>;
  categoryScores?: MiroFishCategoryScore[];
  timeSeries?: MiroFishTimePoint[];
  generatedEvents?: MiroFishGeneratedEvent[];
  source: 'mirofish';
  generatedAt: string;
}

export interface MiroFishInjection {
  variable: string;
  targetNarrativeIds: string[];
  description: string;
}
