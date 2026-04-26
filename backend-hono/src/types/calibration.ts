// [claude-code 2026-03-27] S2-T1: Calibration system types — weight overrides, annotations, observations

import type { MarketRegime } from "./regime.js";

export interface CalibrationEntry {
  id: string;
  eventType: string;
  baseWeight: number;
  regimeOverrides: Partial<Record<MarketRegime, number>>;
  updatedAt: string;
  updatedBy: string;
}

export interface RefinementAnnotation {
  id: string;
  riskflowItemId: string; // tweet_id reference
  comment?: string;
  flawTag?: FlawTag;
  suggestedScore?: number;
  createdAt: string;
  createdBy: string;
}

export type FlawTag =
  | "overscored"
  | "underscored"
  | "wrong_type"
  | "wrong_sentiment"
  | "missing_context"
  | "commentator_misweight"
  | "regime_mismatch"
  | "desk-drift";

export interface CalibrationObservation {
  id: string;
  headline: string;
  eventType?: string;
  predictedIVScore?: number;
  actualPointsMove?: number;
  instrument: string;
  regimeAtTime?: MarketRegime;
  vixAtTime?: number;
  observedAt?: string;
  notes?: string;
  source: "manual" | "backfill" | "live_correlation";
  createdAt: string;
}
