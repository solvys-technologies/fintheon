// [claude-code 2026-03-15] Track 2: PsychAssist hardening — shared ER types, constants, and helpers
import type React from 'react';

export type ERState = 'steadfast' | 'poised' | 'tilted';

export type InterventionLevel = 'none' | 'visual' | 'voice' | 'lockout';

export interface ERSnapshot {
  score: number;
  state: ERState;
  timestamp: Date;
  audioLevels?: { avg: number; peak: number };
  keywords?: string[];
}

export interface OvertradingStatus {
  isOvertrading: boolean;
  tradesInWindow: number;
  warning?: string;
}

export interface SentimentResult {
  sentiment: number;
  confidence: number;
  keywords: string[];
  tiltIndicators: string[];
  summary: string;
}

export interface ERContextValue {
  isMonitoring: boolean;
  erScore: number;
  resonanceState: ERState;
  sessionId: number | null;
  overtradingStatus: OvertradingStatus | null;
  analyser: AnalyserNode | null;
  timeInTiltSeconds: number;
  infractionCount: number;
  maxTiltScore: number;
  sessionStartTime: number | null;
  recentInfraction: boolean;
  lastInfractionAt: number | null;
  interventionLevel: InterventionLevel;
  isLockedOut: boolean;
  lastSentiment: SentimentResult | null;
  vadActive: boolean;
  startMonitoring: () => Promise<void>;
  stopMonitoring: () => Promise<void>;
  updateScore: (delta: number) => void;
  addInfraction: (keywords: string[]) => void;
  clearRecentInfraction: () => void;
  dismissLockout: () => void;
  getRecentSnapshots: () => ERSnapshot[];
}

export interface ERProviderProps {
  children: React.ReactNode;
}

/** 6-word verbal infraction keyword list for VAD detection */
export const AGGRESSIVE_KEYWORDS = ['fuck', 'shit', 'damn', 'stupid', 'idiot', 'hate'] as const;

// VAD configuration
export const VAD_ENERGY_THRESHOLD = 0.08;
export const VAD_SILENCE_DURATION_MS = 1500;
export const VAD_MIN_SPEECH_MS = 500;
export const VAD_CHECK_INTERVAL_MS = 100;
export const SENTIMENT_COOLDOWN_MS = 10_000;

export function computeInterventionLevel(score: number): InterventionLevel {
  if (score <= -5) return 'lockout';
  if (score <= -3) return 'voice';
  if (score <= -1) return 'visual';
  return 'none';
}
