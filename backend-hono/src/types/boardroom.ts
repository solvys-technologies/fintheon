// [claude-code 2026-03-16] Agent backend v7.9: updated BoardroomAgent roster
/**
 * Boardroom types
 * Shared backend contracts for boardroom and intervention messages.
 *
 * Agent roster (v7.9):
 *   Harper-Hermes — CAO (Chief Agent Officer), coordination & boardroom moderation
 *   Oracle        — The All-Seer, prediction markets + macro (merged PMA-1 + PMA-2)
 *   Feucht        — Futures, Execution & Risk
 *   Consul        — Fundamentals desk
 *   Herald        — News & Sentiment
 *   (Sentinel removed in v7.9 — risk absorbed by Feucht)
 */

export type BoardroomAgent =
  | 'Harper-Hermes'
  | 'Oracle'
  | 'Feucht'
  | 'Consul'
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
