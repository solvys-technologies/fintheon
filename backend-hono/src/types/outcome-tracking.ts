// [claude-code 2026-03-19] T1: Outcome tracking types for agent prediction scorecards

import type { BoardroomAgent } from './boardroom.js';

export type PredictionType = 'trade_idea' | 'regime_prediction' | 'event_forecast';
export type PredictionOutcome = 'correct' | 'incorrect' | 'partial' | 'expired';

export interface TrackedPrediction {
  id: string;
  agent: BoardroomAgent;
  type: PredictionType;
  instrument: string;
  prediction: string;
  predictionDate: string;
  targetDate?: string;
  direction?: 'bullish' | 'bearish' | 'neutral';
  entryPrice?: number;
  targetPrice?: number;
  resolvedAt?: string;
  outcome?: PredictionOutcome;
  actualResult?: string;
  pnlImpact?: number;
}

export interface AgentScorecard {
  agent: BoardroomAgent;
  totalPredictions: number;
  correctCount: number;
  incorrectCount: number;
  partialCount: number;
  winRate: number;
  avgPnlPerPrediction: number;
  streakCurrent: number;
  bestStreak: number;
}
