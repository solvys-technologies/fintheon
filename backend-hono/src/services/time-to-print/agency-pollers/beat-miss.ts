// [claude-code 2026-04-25] S40-P4: polarity-aware beat/miss classifier.
//   surprisePercent = (actual - forecast) / forecast
//   beat = surprise sign matches POLARITY (good for risk-on)
//   miss = surprise sign opposes POLARITY
//   inline = |surprise| < 0.001
//
// Polarity table per brief:
//   CPI: -1   (low CPI = beat for risk-on)
//   PPI: -1
//   NFP: +1   (high jobs = beat)
//   JOBLESS: -1  (low claims = beat)
//   GDP: +1
//   RETAIL: +1
//   PCE: -1
//   FOMC: 0   (no straightforward polarity — use direction tag)

import type { EconEventKey } from "./types.js";

const POLARITY: Partial<Record<EconEventKey, 1 | -1 | 0>> = {
  cpi: -1,
  ppi: -1,
  empsit: 1,
  nfp: 1,
  jolts: 1,
  eci: -1,
  prod2: 1,
  gdp: 1,
  pce: -1,
  "personal-income": 1,
  "retail-sales": 1,
  "housing-starts": 1,
  "durable-goods": 1,
  fomc: 0,
};

export interface BeatMissResult {
  beatMiss: "beat" | "miss" | "inline";
  surprisePercent: number;
}

export function classifyBeatMiss(
  actual: number,
  forecast: number,
  eventKey: EconEventKey,
): BeatMissResult {
  const denom = Math.abs(forecast || 1);
  const surprise = (actual - forecast) / denom;
  if (Math.abs(surprise) < 0.001) {
    return { beatMiss: "inline", surprisePercent: 0 };
  }
  const polarity = POLARITY[eventKey] ?? 1;
  if (polarity === 0) {
    // FOMC and similar — fall back to magnitude only; caller decides direction.
    return {
      beatMiss: surprise > 0 ? "beat" : "miss",
      surprisePercent: surprise * 100,
    };
  }
  const matchesPolarity = Math.sign(surprise) === Math.sign(polarity);
  return {
    beatMiss: matchesPolarity ? "beat" : "miss",
    surprisePercent: surprise * 100,
  };
}
