// [claude-code 2026-05-16] S68-T2: Catalyst drift calculation — measures narrative
// divergence between a theme's current IPV and its historical trajectory.

import * as store from "../theme-tracker/persistence.js";
import type { DriftResult, DriftDirection } from "./types.js";

const DEFAULT_TRAILING_PERIODS = 10;

export function calculateDrift(
  themeId: string,
  trailingPeriods: number = DEFAULT_TRAILING_PERIODS,
): DriftResult | null {
  const theme = store.getTheme(themeId);
  if (!theme) return null;

  const trajectory = theme.trajectory;
  const dataPoints = trajectory.length;
  const currentIPV = theme.ipv;

  if (dataPoints === 0) {
    return {
      themeId,
      magnitude: 0,
      direction: "neutral",
      confidence: 0,
      period: trailingPeriods,
      currentIPV,
      historicalAvgIPV: currentIPV,
    };
  }

  const lookback = Math.min(trailingPeriods, dataPoints);
  const recentPoints = trajectory.slice(dataPoints - lookback);

  const historicalAvgIPV =
    recentPoints.reduce((sum, p) => sum + p.ipv, 0) / lookback;

  const denominator = Math.max(historicalAvgIPV, 0.01);
  const magnitude = Math.min(
    Math.abs(currentIPV - historicalAvgIPV) / denominator,
    1,
  );

  const direction: DriftDirection =
    currentIPV > historicalAvgIPV
      ? "positive"
      : currentIPV < historicalAvgIPV
        ? "negative"
        : "neutral";

  const confidence = Math.min(dataPoints / trailingPeriods, 1);

  return {
    themeId,
    magnitude,
    direction,
    confidence,
    period: lookback,
    currentIPV,
    historicalAvgIPV,
  };
}
