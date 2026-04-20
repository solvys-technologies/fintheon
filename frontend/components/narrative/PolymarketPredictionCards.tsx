// [claude-code 2026-04-15] S16-T2: Enhanced with FUSE confidence, severity borders, expand/collapse, price delta, full-width grid
import { useState, useEffect, useRef } from "react";
import {
  Loader2,
  ChevronDown,
  ChevronUp,
  ArrowUp,
  ArrowDown,
} from "@/components/shared/iso-icons";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";

interface PolymarketOutlook {
  slug: string;
  question: string;
  yesPrice: number;
  priceProposedAt?: number;
  fuseConfidence?: number;
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

function fuseColor(score: number): string {
  if (score > 80) return "var(--fintheon-bullish)";
  if (score > 60) return "var(--fintheon-accent)";
  if (score > 40) return "var(--fintheon-caution, orange)";
  return "var(--fintheon-bearish)";
}

function severityBorderColor(score: number | undefined): string {
  if (score === undefined) return "var(--fintheon-border)";
  if (score > 80) return "var(--fintheon-bullish)";
  if (score > 60) return "var(--fintheon-accent)";
  if (score > 40) return "var(--fintheon-caution, orange)";
  return "var(--fintheon-bearish)";
}

function relativeTime(dateStr: string): string {
  const diff = new Date(dateStr).getTime() - Date.now();
  if (diff < 0) return "closed";
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  if (days > 0) return `${days}d left`;
  if (hours > 0) return `${hours}h left`;
  return "<1h left";
}

export function PolymarketPredictionCards() {
  const cached = loadCached();
  const [markets, setMarkets] = useState<PolymarketOutlook[]>(cached);
  const [loading, setLoading] = useState(cached.length === 0);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
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

  const toggle = (slug: string) =>
    setExpanded((prev) => ({ ...prev, [slug]: !prev[slug] }));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2
          className="w-4 h-4 animate-spin"
          style={{ color: "var(--fintheon-accent)", opacity: 0.4 }}
        />
      </div>
    );
  }

  if (markets.length === 0) {
    return (
      <div
        className="text-center py-3 text-[9px]"
        style={{ color: "var(--fintheon-muted)", opacity: 0.4 }}
      >
        No prediction market data available
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 px-4 py-3">
      {markets.map((m) => {
        const pct = Math.round(m.yesPrice * 100);
        const barColor = probabilityColor(m.yesPrice);
        const isExpanded = expanded[m.slug] ?? false;
        const borderColor = severityBorderColor(m.fuseConfidence);
        const closeRel = m.closeTime ? relativeTime(m.closeTime) : null;

        // Price delta
        const hasDelta =
          m.priceProposedAt !== undefined &&
          Math.abs(m.yesPrice - m.priceProposedAt) > 0.005;
        const delta = hasDelta ? m.yesPrice - m.priceProposedAt! : 0;
        const deltaUp = delta > 0;

        return (
          <div
            key={m.slug}
            className="rounded-lg border p-3 flex flex-col gap-2 cursor-pointer transition-all"
            style={{
              backgroundColor:
                "color-mix(in srgb, var(--fintheon-surface) 80%, transparent)",
              borderColor:
                "color-mix(in srgb, var(--fintheon-border) 20%, transparent)",
              borderLeftWidth: "2px",
              borderLeftColor: borderColor,
              backdropFilter: "blur(12px)",
            }}
            onClick={() => toggle(m.slug)}
          >
            {/* Header: category + FUSE badge + close time */}
            <div className="flex items-center justify-between gap-2">
              <span
                className="text-[8px] font-semibold uppercase tracking-wider"
                style={{ color: "var(--fintheon-accent)" }}
              >
                {m.category}
              </span>
              <div className="flex items-center gap-1.5">
                {m.fuseConfidence !== undefined && (
                  <span
                    className="text-[7px] font-bold px-1.5 py-0.5 rounded"
                    style={{
                      color: fuseColor(m.fuseConfidence),
                      backgroundColor: `color-mix(in srgb, ${fuseColor(m.fuseConfidence)} 12%, transparent)`,
                    }}
                  >
                    FUSE {m.fuseConfidence}
                  </span>
                )}
                {closeRel && (
                  <span
                    className="text-[7px]"
                    style={{ color: "var(--fintheon-muted)", opacity: 0.5 }}
                  >
                    {closeRel}
                  </span>
                )}
              </div>
            </div>

            {/* Question — truncated when collapsed, full when expanded */}
            <p
              className={`text-[10px] leading-tight min-h-[28px] ${isExpanded ? "" : "line-clamp-2"}`}
              style={{ color: "var(--fintheon-text)" }}
            >
              {m.question}
            </p>

            {/* Probability bar */}
            <div
              className="w-full h-[4px] rounded-full overflow-hidden"
              style={{
                backgroundColor:
                  "color-mix(in srgb, var(--fintheon-border) 10%, transparent)",
              }}
            >
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${pct}%`, backgroundColor: barColor }}
              />
            </div>

            {/* Price + volume */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span
                  className="text-[16px] font-mono font-bold"
                  style={{ color: barColor }}
                >
                  {pct}%
                </span>
                {hasDelta && (
                  <span
                    className="flex items-center gap-0.5 text-[8px] font-semibold"
                    style={{
                      color: deltaUp
                        ? "var(--fintheon-bullish)"
                        : "var(--fintheon-bearish)",
                    }}
                  >
                    {deltaUp ? (
                      <ArrowUp className="w-2.5 h-2.5" />
                    ) : (
                      <ArrowDown className="w-2.5 h-2.5" />
                    )}
                    {Math.abs(Math.round(delta * 100))}pt
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <span
                  className="text-[7px]"
                  style={{ color: "var(--fintheon-muted)", opacity: 0.5 }}
                >
                  Vol: {formatVolume(m.volume)}
                </span>
                {isExpanded ? (
                  <ChevronUp
                    className="w-3 h-3"
                    style={{ color: "var(--fintheon-muted)", opacity: 0.4 }}
                  />
                ) : (
                  <ChevronDown
                    className="w-3 h-3"
                    style={{ color: "var(--fintheon-muted)", opacity: 0.4 }}
                  />
                )}
              </div>
            </div>

            {/* Expanded details */}
            {isExpanded && (
              <div
                className="flex flex-col gap-1.5 pt-1.5 mt-0.5"
                style={{
                  borderTop:
                    "1px solid color-mix(in srgb, var(--fintheon-border) 10%, transparent)",
                }}
              >
                {/* Price proposed at vs current */}
                {m.priceProposedAt !== undefined && (
                  <div className="flex items-center justify-between text-[8px]">
                    <span style={{ color: "var(--fintheon-muted)" }}>
                      Proposed: {Math.round(m.priceProposedAt * 100)}%
                    </span>
                    <span style={{ color: "var(--fintheon-muted)" }}>
                      Current: {pct}%
                    </span>
                    {hasDelta && (
                      <span
                        className="font-semibold"
                        style={{
                          color: deltaUp
                            ? "var(--fintheon-bullish)"
                            : "var(--fintheon-bearish)",
                        }}
                      >
                        {deltaUp ? "+" : ""}
                        {Math.round(delta * 100)}pt
                      </span>
                    )}
                  </div>
                )}

                {/* Category badge */}
                <div className="flex items-center gap-2 text-[8px]">
                  <span
                    className="px-1.5 py-0.5 rounded font-semibold uppercase tracking-wider"
                    style={{
                      color: "var(--fintheon-accent)",
                      backgroundColor:
                        "color-mix(in srgb, var(--fintheon-accent) 10%, transparent)",
                    }}
                  >
                    {m.category}
                  </span>
                  {closeRel && (
                    <span style={{ color: "var(--fintheon-muted)" }}>
                      Closes: {closeRel}
                    </span>
                  )}
                </div>

                {/* Kalshi divergence (when > 10%) */}
                {m.kalshiDivergence &&
                  m.kalshiDivergence.divergencePct > 10 && (
                    <div
                      className="flex items-center justify-between text-[8px] font-semibold px-2 py-1 rounded"
                      style={{
                        color: "var(--fintheon-bearish)",
                        backgroundColor:
                          "color-mix(in srgb, var(--fintheon-bearish) 8%, transparent)",
                      }}
                    >
                      <span>Poly: {Math.round(m.yesPrice * 100)}%</span>
                      <span>
                        Kalshi:{" "}
                        {Math.round(m.kalshiDivergence.kalshiPrice * 100)}%
                      </span>
                      <span
                        className="px-1 py-0.5 rounded"
                        style={{
                          backgroundColor:
                            "color-mix(in srgb, var(--fintheon-bearish) 15%, transparent)",
                        }}
                      >
                        {Math.round(m.kalshiDivergence.divergencePct)}% div
                      </span>
                    </div>
                  )}
              </div>
            )}

            {/* Collapsed divergence badge (when > 5%, not expanded) */}
            {!isExpanded &&
              m.kalshiDivergence &&
              m.kalshiDivergence.divergencePct > 5 && (
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
