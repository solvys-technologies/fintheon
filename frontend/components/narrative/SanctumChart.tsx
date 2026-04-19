// [claude-code 2026-04-19] S25-T2: TradingView iframe swap — drop widgetembed + projection overlay, mount the same EmbeddedBrowserFrame the trading browser uses so the real TradingView chart UI loads
// [claude-code 2026-03-28] S9-T3: Removed IV risk bars canvas — TradingView + projection overlay only
// [claude-code 2026-03-24] Chart overhaul — TradingView iframe embed
import { useMemo } from "react";
import type {
  AgentDeskTimePoint,
  AgentDeskScenario,
} from "../../types/agent-desk";
import { EmbeddedBrowserFrame } from "../layout/EmbeddedBrowserFrame";

/** Map Fintheon futures symbols to TradingView chart symbols. */
const SYMBOL_MAP: Record<string, string> = {
  "/MNQ": "NASDAQ:QQQ",
  "/NQ": "NASDAQ:QQQ",
  "/ES": "SP:SPX",
  "/MES": "SP:SPX",
  "/GC": "COMEX:GC1!",
  "/MGC": "COMEX:GC1!",
  "/YM": "DJ:DJI",
  "/RTY": "RUSSELL:RUT",
  "/CL": "NYMEX:CL1!",
  MNQ: "NASDAQ:QQQ",
  NQ: "NASDAQ:QQQ",
  ES: "SP:SPX",
  MES: "SP:SPX",
  YM: "DJ:DJI",
  RTY: "RUSSELL:RUT",
};

function mapSymbol(sym: string): string {
  return SYMBOL_MAP[sym] ?? SYMBOL_MAP[`/${sym}`] ?? "NASDAQ:QQQ";
}

interface SanctumChartProps {
  /** @deprecated Projection overlay removed; kept for call-site compat. */
  timeSeries?: AgentDeskTimePoint[];
  /** @deprecated Projection overlay removed; kept for call-site compat. */
  rollingDays?: number;
  selectedSymbol?: string;
  /** @deprecated Projection overlay removed; kept for call-site compat. */
  compositeIV?: number;
  /** @deprecated Projection overlay removed; kept for call-site compat. */
  confidence?: number;
  /** @deprecated Projection overlay removed; kept for call-site compat. */
  regimeShiftProbability?: number;
  /** @deprecated Projection overlay removed; kept for call-site compat. */
  scenarios?: AgentDeskScenario[];
}

export function SanctumChart({ selectedSymbol = "/MNQ" }: SanctumChartProps) {
  const tvUrl = useMemo(() => {
    const symbol = mapSymbol(selectedSymbol);
    return `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(symbol)}`;
  }, [selectedSymbol]);

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex-1 min-h-0 overflow-hidden">
        <EmbeddedBrowserFrame
          title="TradingView Chart"
          src={tvUrl}
          className="w-full h-full bg-[var(--fintheon-bg)]"
        />
      </div>
    </div>
  );
}
