// [claude-code 2026-03-23] MiroFish Sanctum frontend types — expanded for snap-scroll dashboard + presets

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

export interface SanctumData {
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

/** @deprecated Use ivHeatColor(score) instead — dynamic heat-map coloring based on IV value */
export const RISK_CATEGORY_COLORS: Record<MiroFishRiskCategory, string> = {
  'geopolitical': '#EF4444',
  'political': '#8B5CF6',
  'monetary-policy': '#3B82F6',
  'earnings-corporate': '#10B981',
  'market-structure': '#F59E0B',
  'black-swan': '#EC4899',
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
    const r = Math.round(0x14 + (0xF5 - 0x14) * p);
    const g = Math.round(0xB8 + (0x9E - 0xB8) * p);
    const b = Math.round(0xA6 + (0x0B - 0xA6) * p);
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }
  const p = (t - 0.5) / 0.5; // 0→1 within mid–high
  const r = Math.round(0xF5 + (0xEF - 0xF5) * p);
  const g = Math.round(0x9E + (0x44 - 0x9E) * p);
  const b = Math.round(0x0B + (0x44 - 0x0B) * p);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

export const COMPOSITE_COLOR = '#c79f4a';

// --- Sanctum Preset System ---

export type SanctumPreset = 'full-brief' | 'chart-focus' | 'econ-watch' | 'risk-scan';

export const AUDITORIUM_PRESETS: { id: SanctumPreset; label: string; description: string }[] = [
  { id: 'full-brief', label: 'Full Brief', description: 'All pages' },
  { id: 'chart-focus', label: 'Chart Focus', description: 'IV chart expanded' },
  { id: 'econ-watch', label: 'Econ Watch', description: 'Economic events' },
  { id: 'risk-scan', label: 'Risk Scan', description: 'Sectors & scenarios' },
];

export const AUDITORIUM_PAGES = ['Command Center', 'Econ Intel', 'Risk & Narratives'] as const;

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

export interface EconHistoryPrint {
  id?: string;
  date: string | null;
  actual: number | null;
  forecast: number | null;
  previous: number | null;
  surprise: number | null;
  direction: 'beat' | 'miss' | 'inline' | null;
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
    beatMiss?: 'beat' | 'miss' | 'inline';
    surprisePercent?: number;
  } | null;
  publishedAt: string | null;
}

export interface EconCardData {
  name: string;
  ticker: string;
  nextDate?: string;
  lastPrint?: EconPrint;
  printHistory?: EconHistoryPrint[];
  scoredItems?: EconScoredItem[];
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
  riskflowHeadlines: RiskFlowCatalyst[];
  econPrintHistory?: EconPrintStat[];
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

export interface MiroFishRunRecord {
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
  preset: SanctumPreset;
  compositeIV: number;
  confidence: number;
  regimeShiftProbability: number;
  briefingText: string;
  categoryScores: MiroFishCategoryScore[];
  scenarios: MiroFishScenario[];
  createdAt: string;
}
