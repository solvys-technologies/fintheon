// [claude-code 2026-03-20] Apparatus tab — Neural Constellation agent intelligence types
import type { LucideIcon } from 'lucide-react';

export interface AgentNode {
  id: string;
  label: string;
  role: string;
  icon: LucideIcon;
  /** Position on the constellation canvas (0-1 normalized) */
  x: number;
  y: number;
  accentColor: string;
  memories: AgentMemory[];
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

export type MemorySource = 'twitter' | 'notion' | 'mirofish' | 'trade' | 'boardroom' | 'manual';

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

export interface Commandment {
  number: number;
  text: string;
}
