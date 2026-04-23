// [claude-code 2026-04-19] S25-T4a: Econ Intelligence right-column instrument fuses. Vertical layout (one per row), reads from the same /api/predictions/outlook + cache that AquariumPredictionCards uses. Doto numbers, fading vertical ruler is owned by the parent.
import { useEffect, useState } from "react";
import {
  Diff,
  TrendingDown,
  Minus,
  Loader2,
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";
const CACHE_KEY = "fintheon:aquarium-predictions";

interface InstrumentOutlook {
  symbol: string;
  name?: string;
  ivScore: number;
  lean: "bullish" | "bearish" | "neutral";
  range: [number, number];
  conviction: "low" | "moderate" | "elevated";
  drivers?: string[];
  scoredItemCount?: number;
}

const LEAN_CONFIG = {
  bullish: { icon: Diff, color: "var(--fintheon-bullish)" },
  bearish: { icon: TrendingDown, color: "var(--fintheon-bearish)" },
  neutral: { icon: Minus, color: "var(--fintheon-muted)" },
};

function loadCached(): InstrumentOutlook[] {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function EconInstrumentFuses() {
  const cached = loadCached();
  const [outlook, setOutlook] = useState<InstrumentOutlook[]>(cached);
  const [loading, setLoading] = useState(cached.length === 0);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const r = await fetch(`${API_BASE}/api/predictions/outlook`);
        if (!r.ok || cancelled) return;
        const data = await r.json();
        const items: InstrumentOutlook[] = data.instruments ?? [];
        if (items.length > 0 && !cancelled) {
          setOutlook(items);
          try {
            localStorage.setItem(CACHE_KEY, JSON.stringify(items));
          } catch {}
        }
      } catch {}
      if (!cancelled) setLoading(false);
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex-1 min-w-0 flex flex-col gap-3 px-4 py-3">
      <div className="flex items-baseline justify-between">
        <span
          className="text-[10px] tracking-[0.22em] uppercase text-[var(--fintheon-accent)]/85"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          Instruments
        </span>
        <span className="text-[8px] uppercase tracking-[0.18em] text-[var(--fintheon-muted)]/40">
          IV · 24h
        </span>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-[10px] text-[var(--fintheon-muted)]/40">
          <Loader2 className="w-3 h-3 animate-spin" />
          Loading instruments…
        </div>
      )}

      {!loading && outlook.length === 0 && (
        <p className="text-[10px] text-[var(--fintheon-muted)]/35">
          No instrument data available.
        </p>
      )}

      {outlook.map((inst) => {
        const cfg = LEAN_CONFIG[inst.lean];
        const Icon = cfg.icon;
        const pct = Math.max(0, Math.min(10, inst.ivScore)) * 10;
        return (
          <div key={inst.symbol} className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between">
              <div className="flex items-center gap-2">
                <span
                  className="text-[11px] font-bold text-[var(--fintheon-accent)]"
                  style={{
                    fontFamily: "Doto, ui-monospace, monospace",
                    letterSpacing: "0.02em",
                  }}
                >
                  {inst.symbol}
                </span>
                <Icon size={10} style={{ color: cfg.color }} />
              </div>
              <span
                className="text-[12px] font-bold"
                style={{
                  color: cfg.color,
                  fontFamily: "Doto, ui-monospace, monospace",
                  letterSpacing: "0.02em",
                }}
              >
                {inst.ivScore.toFixed(1)}
              </span>
            </div>
            <div className="h-[3px] rounded-full bg-[var(--fintheon-border)]/12 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${pct}%`, backgroundColor: cfg.color }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
