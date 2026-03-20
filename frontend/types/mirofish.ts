// [claude-code 2026-03-16] MiroFish Auditorium frontend types

export type MiroFishRiskCategory =
  | 'geopolitical'
  | 'political'
  | 'monetary-policy'
  | 'earnings-corporate'
  | 'market-structure'
  | 'black-swan';

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

export interface MiroFishScenario {
  label: string;
  probability: number;
  projectedScore: number;
  description?: string;
  agentConsensus?: number;
}

export interface AuditoriumData {
  simulationId: string;
  status: 'idle' | 'running' | 'complete' | 'error';
  error?: string;
  compositeIV: number;
  confidence: number;
  regimeShiftProbability: number;
  categoryScores: MiroFishCategoryScore[];
  timeSeries: MiroFishTimePoint[];
  generatedEvents: MiroFishGeneratedEvent[];
  scenarios: MiroFishScenario[];
}

export const RISK_CATEGORY_LABELS: Record<MiroFishRiskCategory, string> = {
  'geopolitical': 'Geopolitical',
  'political': 'Political',
  'monetary-policy': 'Monetary Policy',
  'earnings-corporate': 'Earnings',
  'market-structure': 'Mkt Structure',
  'black-swan': 'Black Swan',
};

export const RISK_CATEGORY_COLORS: Record<MiroFishRiskCategory, string> = {
  'geopolitical': '#EF4444',
  'political': '#8B5CF6',
  'monetary-policy': '#3B82F6',
  'earnings-corporate': '#10B981',
  'market-structure': '#F59E0B',
  'black-swan': '#EC4899',
};

export const COMPOSITE_COLOR = '#c79f4a';
