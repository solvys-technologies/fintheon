// [Codex 2026-05-27] S103 local Arbitrum manual-run preset registry.
import type { ArbitrumRunPresetId } from "./types";

export type { ArbitrumRunPresetId };

export interface ArbitrumRunPreset {
  id: ArbitrumRunPresetId;
  label: string;
  description: string;
}

export const ARBITRUM_RUN_PRESETS: readonly ArbitrumRunPreset[] = [
  {
    id: "volatility-forecast",
    label: "Volatility Forecast",
    description: "VIX, bonds, and DXY impact versus risk.",
  },
  {
    id: "roro",
    label: "RORO",
    description: "Risk-on / risk-off sentiment and positioning.",
  },
  {
    id: "looming-swans",
    label: "Looming Swans",
    description: "Black swan paths for intraday or intraweek volatility.",
  },
  {
    id: "behavioral-policy-theme",
    label: "Behavioral / Policy Theme",
    description: "TACO trade, policy reflexivity, and market behavior.",
  },
  {
    id: "buy-dip-sell-rip",
    label: "Buy Dip / Sell Rip",
    description: "Rumor/news and mean-reversion trade framing.",
  },
  {
    id: "fed-scout",
    label: "Fed Scout",
    description: "Fed put, pivot, and soft landing for three meetings.",
  },
  {
    id: "signal-check",
    label: "Signal Check",
    description: "Noise versus signal for headlines and desk windows.",
  },
] as const;

const STORAGE_KEY = "fintheon:arbitrum-run-preset-ids";
const VALID_IDS = new Set(ARBITRUM_RUN_PRESETS.map((preset) => preset.id));

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

export function loadSelectedArbitrumRunPresetIds(): ArbitrumRunPresetId[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    return normalizeArbitrumRunPresetIds(parsed);
  } catch {
    return [];
  }
}

export function saveSelectedArbitrumRunPresetIds(
  ids: readonly ArbitrumRunPresetId[],
): ArbitrumRunPresetId[] {
  const normalized = ids.filter((id, index) => {
    return VALID_IDS.has(id) && ids.indexOf(id) === index;
  });
  const ordered = normalizeArbitrumRunPresetIds(normalized);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ordered));
  } catch {
    /* local-only preference, safe to ignore */
  }
  return ordered;
}
