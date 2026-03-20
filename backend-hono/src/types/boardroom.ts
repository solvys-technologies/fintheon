// [claude-code 2026-03-19] Agent backend v8.0: updated BoardroomAgent roster (4 agents)
/**
 * Boardroom types
 * Shared backend contracts for boardroom and intervention messages.
 *
 * Agent roster (v8.0):
 *   Harper-Hermes — CAO (Chief Agent Officer), coordination & boardroom moderation
 *   Feucht        — Futures Execution & 40/40 Club
 *   Consul        — PMA-1 Market Intelligence (Kalshi BTC bot)
 *   Oracle        — PMA-2 Quantitative Pattern Diviner
 *   (Herald removed in v8.0 — communications absorbed by Harper-Hermes)
 *   (Sentinel removed in v7.9 — risk absorbed by Feucht)
 */

export type BoardroomAgent =
  | 'Harper-Hermes'
  | 'Feucht'
  | 'Consul'
  | 'Oracle'
  | 'Herald'
  | 'Unknown';

export interface BoardroomMessage {
  id: string;
  agent: BoardroomAgent;
  emoji: string;
  content: string;
  timestamp: string;
  role: 'user' | 'assistant' | 'system';
}

export interface InterventionMessage {
  id: string;
  sender: 'User' | 'Harper-Hermes' | 'Unknown';
  content: string;
  timestamp: string;
}

/* ------------------------------------------------------------------ */
/*  Structured Intervention types                                      */
/* ------------------------------------------------------------------ */

export type InterventionType =
  | 'risk_alert'
  | 'overtrading_warning'
  | 'rule_violation'
  | 'market_event'
  | 'position_check';

export type InterventionSeverity = 'info' | 'warning' | 'critical';

export interface StructuredIntervention {
  id: string;
  agent: BoardroomAgent;
  type: InterventionType;
  severity: InterventionSeverity;
  message: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

/* ------------------------------------------------------------------ */
/*  Trade Idea types                                                   */
/* ------------------------------------------------------------------ */

export type TradeDirection = 'long' | 'short' | 'neutral';
export type ConvictionLevel = 'low' | 'medium' | 'high' | 'max';

export interface TradeIdea {
  id: string;
  agent: BoardroomAgent;
  instrument: string;
  direction: TradeDirection;
  conviction: ConvictionLevel;
  entry?: number;
  stopLoss?: number;
  target?: number;
  riskReward?: number;
  thesis: string;
  keyLevels?: { label: string; price: number }[];
  timestamp: string;
}