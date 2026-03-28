// [claude-code 2026-03-28] NarrativeFlow shared types — all tracks import from here
// S5-T1: Added TreeNode, CanvasViewport, ZOOM_THRESHOLDS, marketImpact on CatalystCard
export type CatalystSentiment = 'bullish' | 'bearish';
export type NarrativeCategory = 'geopolitical' | 'macroeconomic' | 'monetary' | 'market-structure' | 'supply-chain' | 'black-swan' | 'earnings';
export type CatalystSource = 'rss' | 'user' | 'agent' | 'riskflow' | 'riskflow-import' | 'brief' | 'research';
export type CatalystSeverity = 'high' | 'medium' | 'low';
export type NarrativeStatus = 'active' | 'watching' | 'archived' | 'decayed';
export type DirectionBias = 'long' | 'short' | 'neutral';
export type RopePolarity = 'reinforcing' | 'contradicting';
export type ZoomLevel = 'week' | 'month' | 'quarter' | 'year';
export type CatalystTemplateType = 'fomc' | 'cpi' | 'earnings' | 'geopolitical' | 'custom';

export interface NarrativeLane {
  id: string;
  title: string;
  instruments: string[];
  directionBias: DirectionBias;
  category: NarrativeCategory;
  status: NarrativeStatus;
  dateRange: { start: string; end: string | null };
  healthScore: number;
  color: string;
  order: number;
  parentId: string | null;
  forkDate: string | null;
  decayWeeks: number;
  createdAt: string;
  updatedAt: string;
}

export interface ResearchBullet {
  id: string;
  boldPhrase: string;
  explanation: string;
  source: 'ai' | 'user' | 'riskflow';
  highlightable: boolean;
}

export interface NarrativeAggregateCard {
  id: string;
  title: string;
  riskCategory: NarrativeCategory;
  timeBucket: string;
  constituentCardIds: string[];
  severity: CatalystSeverity;
  sentiment: CatalystSentiment;
  cardCount: number;
}

export interface CatalystCard {
  id: string;
  title: string;
  description: string;
  date: string;
  sentiment: CatalystSentiment;
  severity: CatalystSeverity;
  source: CatalystSource;
  narrativeIds: string[];
  isGhost: boolean;
  templateType: CatalystTemplateType | null;
  position: { x: number; y: number } | null;
  tags?: string[];  // user-defined tags for filtering/organizing
  category?: NarrativeCategory;
  riskflowItemId?: string;              // link back to scored_riskflow_items
  marketImpact?: {
    nq: { points: number; percent: number } | null;
    es: { points: number; percent: number } | null;
    ym: { points: number; percent: number } | null;
    asOf: string; // ISO date of the close
  };
  directionBias?: 'bullish' | 'bearish' | 'neutral';
  status?: 'active' | 'monitoring' | 'resolved';
  dateRange?: { start: string; end: string | null };
  researchBullets?: ResearchBullet[];
  parentHighlight?: string;
  parentCardId?: string;
  childCardIds?: string[];
  drillDepth: number;
  createdAt: string;
  updatedAt: string;
}

export interface Rope {
  id: string;
  fromId: string;
  fromType: 'catalyst' | 'lane';
  toId: string;
  toType: 'catalyst' | 'lane';
  polarity: RopePolarity;
  weight: number;
  approved: boolean;
  createdAt: string;
}

export interface ConfluenceNode {
  id: string;
  catalystId: string;
  narrativeIds: string[];
  date: string;
  position: { x: number; y: number };
}

export interface NarrativeConflict {
  id: string;
  laneAId: string;
  laneBId: string;
  ropeId: string;
  description: string;
  severity: CatalystSeverity;
  resolved: boolean;
}

export interface AgentProviderConfig {
  provider: 'hermes' | 'github-models' | 'manual';
  autoApprove: boolean;
  model?: string;
}

export interface NarrativeFlowState {
  lanes: NarrativeLane[];
  catalysts: CatalystCard[];
  ropes: Rope[];
  confluenceNodes: ConfluenceNode[];
  conflicts: NarrativeConflict[];
  zoomLevel: ZoomLevel;
  currentWeekStart: string;
  selectedCatalystId: string | null;
  selectedLaneId: string | null;
  filterSentiment: CatalystSentiment | 'all';
  heatmapEnabled: boolean;
  replayMode: boolean;
  replayPosition: number;
  agentProvider: AgentProviderConfig;
  viewport: CanvasViewport;
  dateFilter: { start: string; end: string } | null;
}

export interface NarrativeSnapshot {
  lanes: NarrativeLane[];
  catalysts: CatalystCard[];
  ropes: Rope[];
  confluenceNodes: ConfluenceNode[];
  conflicts: NarrativeConflict[];
  timestamp: string;
}

export type NarrativeAction =
  | { type: 'ADD_LANE'; lane: Omit<NarrativeLane, 'id' | 'createdAt' | 'updatedAt'> }
  | { type: 'UPDATE_LANE'; id: string; updates: Partial<NarrativeLane> }
  | { type: 'REMOVE_LANE'; id: string }
  | { type: 'REORDER_LANES'; ids: string[] }
  | { type: 'FORK_LANE'; laneId: string; title: string }
  | { type: 'ADD_CATALYST'; catalyst: Omit<CatalystCard, 'id' | 'createdAt' | 'updatedAt'> }
  | { type: 'UPDATE_CATALYST'; id: string; updates: Partial<CatalystCard> }
  | { type: 'REMOVE_CATALYST'; id: string }
  | { type: 'MOVE_CATALYST'; id: string; date: string; position: { x: number; y: number } | null }
  | { type: 'ADD_ROPE'; rope: Omit<Rope, 'id' | 'createdAt'> }
  | { type: 'REMOVE_ROPE'; id: string }
  | { type: 'APPROVE_ROPE'; id: string }
  | { type: 'ADD_CONFLUENCE'; node: Omit<ConfluenceNode, 'id'> }
  | { type: 'REMOVE_CONFLUENCE'; id: string }
  | { type: 'ADD_CONFLICT'; conflict: Omit<NarrativeConflict, 'id'> }
  | { type: 'RESOLVE_CONFLICT'; id: string }
  | { type: 'SET_ZOOM'; level: ZoomLevel }
  | { type: 'SET_WEEK'; weekStart: string }
  | { type: 'SET_FILTER'; sentiment: CatalystSentiment | 'all' }
  | { type: 'TOGGLE_HEATMAP' }
  | { type: 'SET_REPLAY_MODE'; enabled: boolean }
  | { type: 'SET_REPLAY_POSITION'; position: number }
  | { type: 'BULK_ADD_CATALYSTS'; catalysts: CatalystCard[] }
  | { type: 'IMPORT_CATALYSTS'; catalysts: Omit<CatalystCard, 'id' | 'createdAt' | 'updatedAt'>[] }
  | { type: 'TAG_CATALYST'; catalystId: string; tags: string[] }
  | { type: 'TAKE_SNAPSHOT' }
  | { type: 'RESTORE_SNAPSHOT' }
  | { type: 'HIGHLIGHT_BRANCH'; parentId: string; highlightText: string; childCard: Omit<CatalystCard, 'id' | 'createdAt' | 'updatedAt'> }
  | { type: 'ADD_RESEARCH_BULLETS'; cardId: string; bullets: ResearchBullet[] }
  | { type: 'MOVE_CARD_TO_LANE'; cardId: string; targetLaneId: string }
  | { type: 'SET_VIEWPORT'; viewport: Partial<CanvasViewport> }
  | { type: 'SET_DATE_FILTER'; filter: { start: string; end: string } | null };

// ── Tree-map layout types (S5-T1) ──────────────────────────────

export interface TreeNode {
  id: string;
  label: string;
  type: 'root' | 'category' | 'time-bucket' | 'card';
  children: TreeNode[];
  category?: NarrativeCategory;
  timeBucket?: string; // column key
  depth: number;
}

export interface CanvasViewport {
  x: number;        // pan offset X
  y: number;        // pan offset Y
  scale: number;    // CSS transform scale (0.1 - 3.0)
  zoomLevel: ZoomLevel; // semantic zoom level derived from scale thresholds
}

export const ZOOM_THRESHOLDS: Record<ZoomLevel, [number, number]> = {
  'week': [1.5, 3.0],     // close zoom = individual cards
  'month': [0.8, 1.5],    // medium = week aggregates
  'quarter': [0.4, 0.8],  // far = month aggregates
  'year': [0.1, 0.4],     // very far = quarter aggregates
};

export const DEFAULT_VIEWPORT: CanvasViewport = {
  x: 0,
  y: 0,
  scale: 1.0,
  zoomLevel: 'month',
};
