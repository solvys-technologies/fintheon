// [claude-code 2026-04-19] S25-T1: Cards fused into single row (no per-card borders), fading vertical rulers between instruments
// [claude-code 2026-04-17] S23-T2: Poll cadence 120s → 30s as fallback for synthesis-complete event
// [claude-code 2026-04-04] Persist last prediction to localStorage — shows instantly on startup, refreshes in background
// [claude-code 2026-03-31] Added 120s polling interval (was static one-time fetch)
// [claude-code 2026-03-28] S7: 5 forward-looking prediction cards under TradingView in Aquarium
// [claude-code 2026-04-19] Loader swapped to Unicode FishSwimmer — aquarium-themed microinteraction
import { useState, useEffect, useRef } from "react";
import { Diff, TrendingDown, Minus } from "lucide-react";
import { SnakeSpinner } from "../icon-bank/agent-spinners";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";

interface InstrumentOutlook {
  symbol: string;
  name: string;
  ivScore: number;
  lean: "bullish" | "bearish" | "neutral";
  range: [number, number];
  conviction: "low" | "moderate" | "elevated";
  drivers: string[];
  scoredItemCount: number;
}

const LEAN_CONFIG = {
  bullish: { icon: Diff, color: "var(--fintheon-bullish)", label: "Bullish" },
  bearish: {
    icon: TrendingDown,
    color: "var(--fintheon-bearish)",
    label: "Bearish",
  },
  neutral: { icon: Minus, color: "var(--fintheon-muted)", label: "Neutral" },
};

const CONVICTION_COLOR: Record<string, string> = {
  low: "var(--fintheon-muted)",
  moderate: "var(--fintheon-accent)",
  elevated: "var(--fintheon-bearish)",
};

function IVHeatBar({ score }: { score: number }) {
  const pct = Math.min(100, (score / 10) * 100);
  const hue = score >= 7 ? 0 : score >= 5 ? 30 : score >= 3 ? 45 : 120;
  return (
    <div className="w-full h-[3px] rounded-full bg-[var(--fintheon-border)]/10 overflow-hidden">
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${pct}%`, backgroundColor: `hsl(${hue}, 70%, 50%)` }}
      />
    </div>
  );
}

const CACHE_KEY = "fintheon:aquarium-predictions";

function loadCachedOutlook(): InstrumentOutlook[] {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function cacheOutlook(data: InstrumentOutlook[]): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch {
    /* silent */
  }
}

export function AquariumPredictionCards() {
  const cached = loadCachedOutlook();
  const [outlook, setOutlook] = useState<InstrumentOutlook[]>(cached);
  const [loading, setLoading] = useState(cached.length === 0);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchOutlook = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/predictions/outlook`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const instruments = data.instruments ?? [];
        if (!cancelled && instruments.length > 0) {
          setOutlook(instruments);
          cacheOutlook(instruments);
        }
      } catch (err) {
        console.warn("[Predictions] fetch failed:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    // Background fetch (cached data already showing if available)
    fetchOutlook();

    // Poll every 30s when tab is visible — fallback for synthesis-complete event
    pollRef.current = setInterval(() => {
      if (document.visibilityState === "visible") fetchOutlook();
    }, 30_000);

    return () => {
      cancelled = true;
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <SnakeSpinner size={13} />
      </div>
    );
  }

  if (outlook.length === 0) {
    return (
      <div className="text-center py-3 text-[9px] text-[var(--fintheon-muted)]/40">
        No prediction data available — scored items needed
      </div>
    );
  }

  return (
    <div className="flex items-stretch px-4 py-3 overflow-x-auto scrollbar-none w-full">
      {outlook.map((inst, idx) => {
        const leanCfg = LEAN_CONFIG[inst.lean];
        const LeanIcon = leanCfg.icon;
        const isLast = idx === outlook.length - 1;
        return (
          <div key={inst.symbol} className="flex items-stretch">
            <div className="flex-shrink-0 w-[220px] px-3 py-2 flex flex-col gap-2">
              {/* Header: symbol + lean */}
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono font-bold text-[var(--fintheon-accent)]">
                  {inst.symbol}
                </span>
                <div className="flex items-center gap-1">
                  <LeanIcon
                    className="w-3 h-3"
                    style={{ color: leanCfg.color }}
                  />
                  <span
                    className="text-[8px] font-semibold uppercase"
                    style={{ color: leanCfg.color }}
                  >
                    {leanCfg.label}
                  </span>
                </div>
              </div>

              {/* IV Heat bar */}
              <div>
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[7px] text-[var(--fintheon-muted)]/50 uppercase">
                    Heat
                  </span>
                  <span className="text-[8px] font-mono text-[var(--fintheon-text)]">
                    {inst.ivScore.toFixed(1)}
                  </span>
                </div>
                <IVHeatBar score={inst.ivScore} />
              </div>

              {/* Range */}
              <div className="flex items-center justify-between">
                <span className="text-[7px] text-[var(--fintheon-muted)]/50 uppercase">
                  Range
                </span>
                <span className="text-[9px] font-mono text-[var(--fintheon-text)]">
                  {inst.range[0] > 0 ? "+" : ""}
                  {inst.range[0]} to {inst.range[1] > 0 ? "+" : ""}
                  {inst.range[1]} pts
                </span>
              </div>

              {/* Conviction */}
              <div className="flex items-center justify-between">
                <span className="text-[7px] text-[var(--fintheon-muted)]/50 uppercase">
                  Conviction
                </span>
                <span
                  className="text-[8px] font-semibold uppercase px-1.5 py-0.5 rounded"
                  style={{
                    color: CONVICTION_COLOR[inst.conviction],
                    backgroundColor: `color-mix(in srgb, ${CONVICTION_COLOR[inst.conviction]} 10%, transparent)`,
                  }}
                >
                  {inst.conviction}
                </span>
              </div>

              {/* Drivers */}
              {inst.drivers.length > 0 && (
                <div className="pt-1">
                  {inst.drivers.slice(0, 2).map((d, i) => (
                    <p
                      key={i}
                      className="text-[9px] text-[var(--fintheon-muted)]/50 line-clamp-2"
                    >
                      {d}
                    </p>
                  ))}
                </div>
              )}

              {/* Data points */}
              <div className="text-[6px] text-[var(--fintheon-muted)]/25 text-right">
                {inst.scoredItemCount} data points
              </div>
            </div>

            {/* Fading vertical ruler between instruments */}
            {!isLast && (
              <div className="w-px relative shrink-0 my-2">
                <div
                  className="absolute inset-0"
                  style={{
                    background:
                      "linear-gradient(to bottom, transparent 0%, var(--fintheon-accent) 50%, transparent 100%)",
                    opacity: 0.18,
                  }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
