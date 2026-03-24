// [claude-code 2026-03-23] MiroFish Auditorium frontend types — expanded for snap-scroll dashboard + presets

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
  impliedPoints?: number;
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
  briefing?: MiroFishBriefing;
  contextSnapshot?: SimulationContext;
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

// --- Auditorium Preset System ---

export type AuditoriumPreset = 'full-brief' | 'chart-focus' | 'econ-watch' | 'risk-scan';

export const AUDITORIUM_PRESETS: { id: AuditoriumPreset; label: string; description: string }[] = [
  { id: 'full-brief', label: 'Full Brief', description: 'All pages' },
  { id: 'chart-focus', label: 'Chart Focus', description: 'IV chart expanded' },
  { id: 'econ-watch', label: 'Econ Watch', description: 'Economic events' },
  { id: 'risk-scan', label: 'Risk Scan', description: 'Sectors & scenarios' },
];

export const AUDITORIUM_PAGES = ['Command Center', 'Econ Intel', 'Risk & Scenarios', 'Narratives'] as const;

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
  direction: 'beat' | 'miss' | 'inline';
}

export interface EconCardData {
  name: string;
  ticker: string;
  nextDate?: string;
  lastPrint?: EconPrint;
  agentConsensus?: 'beat' | 'miss' | 'inline';
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
}

export interface SimulationContext {
  vixLevel: number | null;
  fredIndicators: Record<string, number>;
  riskflowHeadlines: RiskFlowCatalyst[];
  fredFetchedAt: string | null;
  fetchedAt: string;
}

export interface MiroFishBriefing {
  summary: string;
  keyFindings: string[];
  riskAlerts: string[];
  agentConsensus: string;
  generatedAt: string;
}

export interface MacroIndicator {
  key: string;
  label: string;
  value: number;
  unit: string;
  stressLevel: 'low' | 'moderate' | 'elevated' | 'high';
}

export interface AuditoriumNarrative {
  id: string;
  title: string;
  category: string;
  directionBias: string;
  healthScore: number;
  instruments: string[];
  status: string;
  dateRange: { start: string; end: string | null };
}

export interface MiroFishRunRecord {
  id: string;
  simulation_id: string;
  preset: AuditoriumPreset;
  composite_iv: number;
  regime_shift_probability: number;
  confidence: number;
  briefing_text: string;
  created_at: string;
}

// ── Running Analysis Types ──

export interface RunningAnalysisSnapshot {
  compositeIV: number;
  categoryScores: MiroFishCategoryScore[];
  confidence: number;
  adjustmentCount: number;
  lastUpdateAt: string;
  baselineRunId: string | null;
  accumulatedItemCount: number;
}

export interface RollingWindowData {
  runs: MiroFishRunSummary[];
  avgCompositeIV: number;
  avgConfidence: number;
  avgRegimeShift: number;
  trendDirection: 'rising' | 'falling' | 'stable';
  periodStart: string;
  periodEnd: string;
}

export interface MiroFishRunSummary {
  simulationId: string;
  preset: AuditoriumPreset;
  compositeIV: number;
  confidence: number;
  regimeShiftProbability: number;
  briefingText: string;
  categoryScores: MiroFishCategoryScore[];
  scenarios: MiroFishScenario[];
  createdAt: string;
}
