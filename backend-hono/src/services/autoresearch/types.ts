// [claude-code 2026-03-23] Canonical types for autoresearch scoring, observation, and backtesting
// All autoresearch modules import types from this file.

import type { IVScoringConfig } from "../iv-scoring/index.js";

/** A single scored observation attached to a news event */
export interface ScoringObservation {
  /** Unique observation ID (usually matches the news item ID) */
  id: string;
  /** The news headline that triggered the observation */
  headline: string;
  /** Classified event type (e.g. 'cpiPrint', 'fedDecision', 'tariffs') */
  eventType: string;
  /** IV score assigned at observation time (0-10) */
  ivScore: number;
  /** VIX level at the time of observation */
  vixAtObservation: number;
  /** Instrument symbol (e.g. '/ES') */
  instrument: string;
  /** Price of the instrument at observation time */
  priceAtObservation: number;
  /** Price of the instrument N minutes after the event (for outcome tracking) */
  priceAfter?: number;
  /** Minutes after the event at which priceAfter was recorded */
  priceAfterMinutes?: number;
  /** Actual price move observed (priceAfter - priceAtObservation) */
  actualMove?: number;
  /** Predicted implied points from Rule of 16 */
  predictedMove?: number;
  /** When the event was published */
  publishedAt: string;
  /** When this observation was recorded */
  observedAt: string;
  /** Trading session at observation time */
  session: string;
  /** Source of the news item */
  source?: string;
  /** Tags from headline parsing */
  tags?: string[];
}

/** Result of a fitness evaluation for a single observation */
export interface FitnessResult {
  /** The observation being evaluated */
  observationId: string;
  /** Directional accuracy: did we predict the right sign? */
  directionCorrect: boolean;
  /** Magnitude error: |actual - predicted| in points */
  magnitudeError: number;
  /** Magnitude error as a percentage of predicted */
  magnitudeErrorPct: number;
  /** Score accuracy: how close was IV score to what a perfect scorer would assign? */
  scoreAccuracy: number;
  /** Overpredict (positive) or underpredict (negative) */
  bias: number;
}

/** Aggregated fitness stats across multiple observations */
export interface FitnessReport {
  /** Total observations evaluated */
  totalObservations: number;
  /** Observations with sufficient data for evaluation */
  evaluatedObservations: number;
  /** Percentage of correct directional predictions */
  directionAccuracy: number;
  /** Mean absolute magnitude error (points) */
  meanMagnitudeError: number;
  /** Mean magnitude error as percentage */
  meanMagnitudeErrorPct: number;
  /** Mean score accuracy (0-1, 1 = perfect) */
  meanScoreAccuracy: number;
  /** Mean bias: positive = overpredicting, negative = underpredicting */
  meanBias: number;
  /** Breakdown by event type */
  byEventType: Record<
    string,
    {
      count: number;
      directionAccuracy: number;
      meanMagnitudeError: number;
      meanBias: number;
    }
  >;
  /** Breakdown by session */
  bySession: Record<
    string,
    {
      count: number;
      directionAccuracy: number;
      meanMagnitudeError: number;
    }
  >;
  /** Timestamp of the report */
  generatedAt: string;
}

/** Configuration for the backtesting engine */
export interface BacktestConfig {
  /** Path to the scoring weights JSON config */
  scoringWeightsPath: string;
  /** Instrument to backtest */
  instrument: string;
  /** How many minutes after event to measure outcome */
  outcomeWindowMinutes: number;
  /** Minimum IV score to include in evaluation */
  minIVScore: number;
  /** Maximum age of observations to include (hours) */
  maxObservationAgeHours: number;
}

/** Scoring weights used by the backtest engine — mirrors IVScoringConfig keys */
export type ScoringWeights = IVScoringConfig;
