// [claude-code 2026-03-16] Added NarrativeCategory type for canvas zone mapping
// [claude-code 2026-03-13] Hermes migration: openclaw -> hermes in AgentProviderConfig
// [claude-code 2026-03-06] NarrativeFlow shared types — all tracks import from here
export type CatalystSentiment = 'bullish' | 'bearish';
export type NarrativeCategory = 'geopolitical' | 'macroeconomic' | 'monetary' | 'market-structure' | 'supply-chain' | 'black-swan' | 'earnings';
export type CatalystSource = 'rss' | 'user' | 'agent' | 'riskflow' | 'brief';
export type CatalystSeverity = 'high' | 'medium' | 'low';
export type NarrativeStatus = 'active' | 'watching' | 'archived' | 'decayed';
export type DirectionBias = 'long' | 'short' | 'neutral';
export type RopePolarity = 'reinforcing' | 'contradicting';
export type ZoomLevel = 'week' | 'month' | 'quarter' | 'year';
export type CatalystTemplateType = 'fomc' | 'cpi' | 'earnings' | 'geopolitical' | 'custom';
export type BeatMissResult = 'beat' | 'miss' | 'inline' | null;
export type NarrativeSortKey = 'order' | 'title' | 'intensity' | 'status' | 'category' | 'updatedAt';
export type SortDirection = 'asc' | 'desc';

export const ASSET_CLASSES: Record<string, string[]> = {
  'Equity Index': ['ES', 'NQ', 'YM', 'RTY', 'SPY', 'QQQ', 'IWM', 'DIA'],
  'Mega-Cap': ['AAPL', 'MSFT', 'NVDA', 'GOOGL', 'AMZN', 'META', 'TSLA'],
  Crypto: ['BTC', 'ETH', 'SOL', 'DOGE', 'XRP'],
  Commodities: ['GC', 'SI', 'CL', 'NG', 'HG'],
  'Fixed Income': ['ZN', 'ZB', 'ZF', 'TLT', 'HYG'],
  Forex: ['EUR/USD', 'GBP/USD', 'USD/JPY', 'DXY'],
};

export interface NarrativeLane {
  id: string;
  title: string;
  description?: string;
  instruments: string[];
  directionBias: DirectionBias;
  category: NarrativeCategory;
  status: NarrativeStatus;
  dateRange: { start: string; end: string | null };
  healthScore: number;
  intensity?: number;
  color: string;
  order: number;
  parentId: string | null;
  forkDate: string | null;
  decayWeeks: number;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
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
  tags?: string[];
  category?: NarrativeCategory;
  intensity?: number;
  beatMiss?: BeatMissResult;
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
  sortKey: NarrativeSortKey;
  sortDirection: SortDirection;
  filterCategory: NarrativeCategory | 'all';
  filterStatus: NarrativeStatus | 'all';
  filterBeatMiss: BeatMissResult | 'all';
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
  | { type: 'IMPORT_CATALYSTS'; catalysts: Omit<CatalystCard, 'id' | 'createdAt' | 'updatedAt'>[] }
  | { type: 'TAG_CATALYST'; catalystId: string; tags: string[] }
  | { type: 'SET_SORT'; sortKey: NarrativeSortKey; sortDirection: SortDirection }
  | { type: 'SET_FILTER_CATEGORY'; category: NarrativeCategory | 'all' }
  | { type: 'SET_FILTER_STATUS'; status: NarrativeStatus | 'all' }
  | { type: 'SET_FILTER_BEAT_MISS'; beatMiss: BeatMissResult | 'all' }
  | { type: 'TAKE_SNAPSHOT' }
  | { type: 'RESTORE_SNAPSHOT' };
