// [Codex 2026-05-27] Manual chamber run template registry.
import type { ArbitrumRunPresetId } from "./types.js";

export interface ArbitrumRunPreset {
  id: ArbitrumRunPresetId;
  label: string;
  description: string;
  instruction: string;
}

export const ARBITRUM_RUN_PRESETS: readonly ArbitrumRunPreset[] = [
  {
    id: "volatility-forecast",
    label: "Volatility Forecast",
    description: "VIX, bonds, and DXY impact versus session risk.",
    instruction:
      "Forecast intraday and intraweek volatility using VIX, bond yields, curve pressure, DXY, and cross-asset risk transmission. Separate realized volatility risk from tradeable opportunity.",
  },
  {
    id: "roro",
    label: "RORO",
    description: "Risk-on / risk-off sentiment and positioning read.",
    instruction:
      "Frame the read through risk-on versus risk-off sentiment. Compare equities, rates, dollar, commodities, and crypto tone, then state whether the desk should expect chase, unwind, or rotation behavior.",
  },
  {
    id: "looming-swans",
    label: "Looming Swans",
    description: "Black swan paths for unexpected volatility.",
    instruction:
      "Identify looming black swan scenarios that could create unexpected intraday or intraweek volatility. Focus on plausible catalysts, early warning signals, and what would invalidate each scenario.",
  },
  {
    id: "behavioral-policy-theme",
    label: "Behavioral / Policy Theme",
    description: "TACO trade, policy reflexivity, and market behavior.",
    instruction:
      "Analyze behavioral and policy reflexivity, including TACO trade dynamics, policy walk-backs, positioning reflexes, and the market's tendency to front-run or fade official messaging.",
  },
  {
    id: "buy-dip-sell-rip",
    label: "Buy Dip / Sell Rip",
    description: "Rumor/news and mean-reversion trade framing.",
    instruction:
      "Frame major stock or macro events through buy-the-rumor, sell-the-news, buy-the-dip, and sell-the-rip behavior. Lean into mean-reversion context without producing an execution instruction.",
  },
  {
    id: "fed-scout",
    label: "Fed Scout",
    description: "Fed put, pivot, and soft-landing next three meetings.",
    instruction:
      "Scout the next three Fed meetings using rate futures, fetched economic data, and prior proven Desk Plan theses. Evaluate Fed put, pivot, hold, and soft-landing paths with explicit evidence quality.",
  },
  {
    id: "signal-check",
    label: "Signal Check",
    description: "Noise versus signal for headlines and trading windows.",
    instruction:
      "Classify the week's headlines, scheduled economic events, and Desk Plan trading windows into noise versus signal. Highlight what should affect the chamber read and what should be ignored.",
  },
] as const;

const PRESET_BY_ID = new Map(
  ARBITRUM_RUN_PRESETS.map((preset) => [preset.id, preset]),
);

export function normalizeArbitrumRunPresetIds(
  value: unknown,
): ArbitrumRunPresetId[] {
  if (!Array.isArray(value)) return [];
  const requested = new Set(
    value.filter((id): id is string => typeof id === "string"),
  );
  return ARBITRUM_RUN_PRESETS.filter((preset) => requested.has(preset.id)).map(
    (preset) => preset.id,
  );
}

export function buildArbitrumPresetContext(
  ids: readonly ArbitrumRunPresetId[],
): string | null {
  const presets = ids
    .map((id) => PRESET_BY_ID.get(id))
    .filter((preset): preset is ArbitrumRunPreset => Boolean(preset));
  if (presets.length === 0) return null;
  const lines = presets.map(
    (preset) => `- ${preset.label}: ${preset.instruction}`,
  );
  return [
    "Manual chamber run templates selected by the user:",
    ...lines,
    "Apply these templates as lenses for this manual run only. Do not alter scheduled or event-triggered Arbitrum behavior.",
  ].join("\n");
}
