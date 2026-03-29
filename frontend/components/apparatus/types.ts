// [claude-code 2026-03-20] Apparatus tab — agent intelligence card types

export interface AgentNode {
  id: string;
  label: string;
  role: string;
  accentColor: string;
  memories: AgentMemory[];
  /** Comedic expanded bio */
  bio?: string;
  /** Historical non-fiction-based fiction dossier */
  dossier?: string;
  /** Narrative threads this agent is actively tracking */
  activeNarratives?: ActiveNarrative[];
  /** Win/loss record (primarily for Feucht) */
  record?: AgentRecord;
  /** Other notable intel */
  notableInfo?: string[];
}

export interface ActiveNarrative {
  thread: string;
  color: string;
  stance: 'bullish' | 'bearish' | 'neutral' | 'watching';
  note: string;
}

export interface AgentRecord {
  wins: number;
  losses: number;
  breakeven: number;
  winRate: number;
  totalPnl: number;
  avgRR: number;
  streak: string;
  bestTrade: string;
  worstTrade: string;
}

export interface AgentMemory {
  id: string;
  fact: string;
  source: MemorySource;
  timestamp: string;
  confidence: number; // 0-1
  version: number;
  history?: MemoryVersion[];
}

export interface MemoryVersion {
  version: number;
  fact: string;
  timestamp: string;
}

export type MemorySource = 'twitter' | 'data' | 'miroshark' | 'trade' | 'boardroom' | 'manual';

export interface AgentConnection {
  from: string;
  to: string;
  type: 'context' | 'conflict';
  label: string;
  /** Shared context items or conflict description */
  detail: string;
}

export interface CronEntry {
  agent: string;
  description: string;
  schedule: string;
}

export interface LiveActivity {
  agent: string;
  action: string;
  elapsed: string;
}

export type CommandmentBlockLevel = 'hard' | 'soft' | 'guidance';

export interface Commandment {
  number: number;
  text: string;
  fullText: string;
  blockLevel: CommandmentBlockLevel;
  coreLessons: string[];
  agentUsage: Record<string, string>;
  relatedCommandments: number[];
  mentorSource?: string;
  backgroundStory?: string;
}
