// [claude-code 2026-04-24] S35-T1: Arbitrum gates — SIGNALS, not vetoes.
// Computes three surfaced metrics:
//   - consensus_spread_pp: max - min probability across seats (percentage points)
//   - category_quality: calibration-history-derived trust score for the category
//   - calibration_watermark: 0..1 portion of the calibration history this seat
//     config has actually been measured on
//
// No call path should use these as hard gates on execution — they attach to
// the verdict so downstream UI (T3) can display them.

import type { ArbitrumGatesSurfaced, ArbitrumSeatTranscript } from "./types.js";

const DEFAULT_CATEGORY_QUALITY = 0.6;
const DEFAULT_CALIBRATION_WATERMARK = 0.5;

// Category quality defaults — until a calibration history exists, use
// priors per category type. These are intentionally conservative; the
// calibration service (S27/S28) is expected to overwrite them as data
// accumulates.
const CATEGORY_QUALITY_PRIOR: Record<string, number> = {
  macro: 0.65,
  "session-digest": 0.55,
  earnings: 0.6,
  geopolitics: 0.5,
  commentary: 0.55,
  custom: 0.5,
};

export interface GatesContext {
  /** Optional calibration history snapshot for the category. If omitted,
   *  falls back to CATEGORY_QUALITY_PRIOR[category] or DEFAULT. */
  calibrationHistory?: {
    category_quality?: number;
    calibration_watermark?: number;
  };
}

function consensusSpreadPp(seats: ArbitrumSeatTranscript[]): number {
  const finals = seats
    .map((s) => s.rounds[s.rounds.length - 1]?.probability)
    .filter((p): p is number => typeof p === "number");
  if (finals.length === 0) return 0;
  const max = Math.max(...finals);
  const min = Math.min(...finals);
  return Math.round((max - min) * 10000) / 100; // percentage points, 2 decimals
}

export function computeGates(
  seats: ArbitrumSeatTranscript[],
  category: string,
  ctx: GatesContext = {},
): ArbitrumGatesSurfaced {
  const categoryPrior =
    CATEGORY_QUALITY_PRIOR[category.toLowerCase()] ?? DEFAULT_CATEGORY_QUALITY;

  const category_quality =
    typeof ctx.calibrationHistory?.category_quality === "number"
      ? ctx.calibrationHistory.category_quality
      : categoryPrior;

  const calibration_watermark =
    typeof ctx.calibrationHistory?.calibration_watermark === "number"
      ? ctx.calibrationHistory.calibration_watermark
      : DEFAULT_CALIBRATION_WATERMARK;

  return {
    consensus_spread_pp: consensusSpreadPp(seats),
    category_quality,
    calibration_watermark,
  };
}
