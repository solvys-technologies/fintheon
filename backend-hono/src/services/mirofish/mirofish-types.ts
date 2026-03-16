// [claude-code 2026-03-16] MiroFish simulation engine types

export interface MiroFishConfig {
  url: string;
  enabled: boolean;
  timeoutMs: number;
}

export interface MiroFishAgent {
  id: string;
  persona: string;
  role: 'macro-strategist' | 'sentiment-analyst' | 'geopolitical-analyst' | 'earnings-analyst' | 'risk-manager';
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

export interface MiroFishReport {
  simulationId: string;
  scenarios: MiroFishScenario[];
  regimeShiftProbability: number;
  nextSessionProjection: number;
  confidence: number;
  agentVotes: Array<{ agentId: string; position: string; confidence: number }>;
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
  source: 'mirofish';
  generatedAt: string;
}

export interface MiroFishInjection {
  variable: string;
  targetNarrativeIds: string[];
  description: string;
}
