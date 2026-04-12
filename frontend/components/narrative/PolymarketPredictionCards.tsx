// [claude-code 2026-04-12] S15-T3: Polymarket prediction market cards — companion to AquariumPredictionCards
import { useState, useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";

interface PolymarketOutlook {
  slug: string;
  question: string;
  yesPrice: number;
  volume: number;
  category: string;
  closeTime?: string;
  kalshiDivergence?: {
    kalshiPrice: number;
    divergencePct: number;
    direction: "poly_higher" | "poly_lower" | "aligned";
  };
}

const CACHE_KEY = "fintheon:polymarket-predictions";

function loadCached(): PolymarketOutlook[] {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveCache(data: PolymarketOutlook[]): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch {
    /* silent */
  }
}

function formatVolume(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  return `$${Math.round(v)}`;
}

function probabilityColor(p: number): string {
  if (p > 0.6) return "var(--fintheon-bullish)";
  if (p < 0.4) return "var(--fintheon-bearish)";
  return "var(--fintheon-accent)";
}

export function PolymarketPredictionCards() {
  const cached = loadCached();
  const [markets, setMarkets] = useState<PolymarketOutlook[]>(cached);
  const [loading, setLoading] = useState(cached.length === 0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchMarkets = async () => {
      try {
        const res = await fetch(
          `${API_BASE}/api/predictions/polymarket-outlook`,
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const items = data.markets ?? [];
        if (!cancelled && items.length > 0) {
          setMarkets(items);
          saveCache(items);
        }
      } catch (err) {
        console.warn("[PolymarketCards] fetch failed:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchMarkets();

    pollRef.current = setInterval(() => {
      if (document.visibilityState === "visible") fetchMarkets();
    }, 120_000);

    return () => {
      cancelled = true;
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="w-4 h-4 text-[var(--fintheon-accent)]/40 animate-spin" />
      </div>
    );
  }

  if (markets.length === 0) {
    return (
      <div className="text-center py-3 text-[9px] text-[var(--fintheon-muted)]/40">
        No prediction market data available
      </div>
    );
  }

  return (
    <div className="flex gap-2 px-4 py-3 overflow-x-auto scrollbar-none">
      {markets.map((m) => {
        const pct = Math.round(m.yesPrice * 100);
        const barColor = probabilityColor(m.yesPrice);
        const closeDate = m.closeTime
          ? new Date(m.closeTime).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })
          : null;

        return (
          <div
            key={m.slug}
            className="flex-shrink-0 w-[220px] rounded-lg border p-3 flex flex-col gap-2"
            style={{
              backgroundColor:
                "color-mix(in srgb, var(--fintheon-surface) 80%, transparent)",
              borderColor:
                "color-mix(in srgb, var(--fintheon-border) 20%, transparent)",
              backdropFilter: "blur(12px)",
            }}
          >
            {/* Header: category + close date */}
            <div className="flex items-center justify-between">
              <span className="text-[8px] font-semibold uppercase tracking-wider text-[var(--fintheon-accent)]">
                {m.category}
              </span>
              {closeDate && (
                <span className="text-[7px] text-[var(--fintheon-muted)]/40">
                  {closeDate}
                </span>
              )}
            </div>

            {/* Question */}
            <p className="text-[10px] text-[var(--fintheon-text)] line-clamp-2 leading-tight min-h-[28px]">
              {m.question}
            </p>

            {/* Probability bar */}
            <div className="w-full h-[4px] rounded-full bg-[var(--fintheon-border)]/10 overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${pct}%`,
                  backgroundColor: barColor,
                }}
              />
            </div>

            {/* Price */}
            <div className="flex items-center justify-between">
              <span
                className="text-[16px] font-mono font-bold"
                style={{ color: barColor }}
              >
                {pct}%
              </span>
              <span className="text-[7px] text-[var(--fintheon-muted)]/40">
                Vol: {formatVolume(m.volume)}
              </span>
            </div>

            {/* Divergence badge */}
            {m.kalshiDivergence && m.kalshiDivergence.divergencePct > 5 && (
              <div
                className="text-[8px] font-semibold px-1.5 py-0.5 rounded text-center"
                style={{
                  color:
                    m.kalshiDivergence.divergencePct > 10
                      ? "var(--fintheon-bearish)"
                      : "var(--fintheon-muted)",
                  backgroundColor:
                    m.kalshiDivergence.divergencePct > 10
                      ? "color-mix(in srgb, var(--fintheon-bearish) 10%, transparent)"
                      : "color-mix(in srgb, var(--fintheon-muted) 10%, transparent)",
                }}
              >
                ↕ {Math.round(m.kalshiDivergence.divergencePct)}% vs Kalshi
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
