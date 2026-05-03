// [claude-code 2026-04-16] S16-T3: Risk Signal cards — full-border severity coloring, solvys-feels polish
// [claude-code 2026-05-03] Solvys cleanup: chevron rows + fading rulers, no card borders.
import { useState, useEffect, useRef, useCallback } from "react";
import { ChevronDown, ChevronRight, Loader2, ShieldAlert } from "lucide-react";
import { FadingRuler } from "../shared/FadingRuler";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";
const CACHE_KEY = "fintheon:risk-signals";
const POLL_INTERVAL = 120_000;

interface RiskSignal {
  id: string;
  title: string;
  summary: string;
  analysis: string;
  score: number;
  severity: "critical" | "high" | "medium" | "low";
  source: "bulletin" | "catalyst-watch" | "risk-detector";
  relatedHeadlines: string[];
  narrativeThreads: string[];
  generatedAt: string;
}

function scoreColor(score: number): string {
  if (score >= 8) return "var(--fintheon-bearish)";
  if (score >= 6) return "#f97316"; // orange
  if (score >= 4) return "var(--fintheon-accent)";
  return "var(--fintheon-muted)";
}

const SOURCE_LABEL: Record<string, string> = {
  bulletin: "Bulletin",
  "catalyst-watch": "Catalyst",
  "risk-detector": "Systemic",
};

function loadCached(): RiskSignal[] {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveCached(signals: RiskSignal[]): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(signals));
  } catch {
    /* silent */
  }
}

export function RiskSignalCards({ compact = false }: { compact?: boolean }) {
  const cached = loadCached();
  const [signals, setSignals] = useState<RiskSignal[]>(cached);
  const [loading, setLoading] = useState(cached.length === 0);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchSignals = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/riskflow/risk-signals`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const items = data.signals ?? [];
      if (items.length > 0) {
        setSignals(items);
        saveCached(items);
      }
    } catch (err) {
      console.warn("[RiskSignals] fetch failed:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Visibility-gated polling via IntersectionObserver (root = scroll container)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // Find the nearest scrollable ancestor to use as root
    let scrollRoot: HTMLElement | null = el.parentElement;
    while (scrollRoot) {
      const overflow = getComputedStyle(scrollRoot).overflowY;
      if (overflow === "auto" || overflow === "scroll") break;
      scrollRoot = scrollRoot.parentElement;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setVisible(entry?.isIntersecting ?? false);
      },
      { root: scrollRoot, threshold: 0.1 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Fetch on mount + poll when visible
  useEffect(() => {
    fetchSignals();
  }, [fetchSignals]);

  useEffect(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (visible) {
      pollRef.current = setInterval(fetchSignals, POLL_INTERVAL);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [visible, fetchSignals]);

  const textSize = compact ? "text-[9px]" : "text-[10px]";
  const titleSize = compact ? "text-[10px]" : "text-[11px]";
  const padding = compact ? "px-1 py-2" : "px-2 py-3";

  if (loading) {
    return (
      <div ref={containerRef} className="flex items-center justify-center py-6">
        <Loader2 className="w-4 h-4 text-[var(--fintheon-accent)]/40 animate-spin" />
      </div>
    );
  }

  if (signals.length === 0) {
    return (
      <div ref={containerRef} className="text-center py-4">
        <ShieldAlert className="w-4 h-4 text-[var(--fintheon-muted)]/30 mx-auto mb-1" />
        <div className="text-[9px] text-[var(--fintheon-muted)]/40">
          No risk signals — waiting for bulletins or high-severity catalysts
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex flex-col py-1">
      {signals.map((signal, index) => {
        const expanded = expandedId === signal.id;
        const badgeColor = scoreColor(signal.score);

        return (
          <div key={signal.id} className="min-w-0">
            {index > 0 && <FadingRuler className="my-1" />}
            <button
              type="button"
              onClick={() => setExpandedId(expanded ? null : signal.id)}
              className={`w-full min-w-0 text-left transition-colors hover:bg-[var(--fintheon-accent)]/5 ${padding}`}
            >
              <div className="flex min-w-0 items-center gap-2">
                {expanded ? (
                  <ChevronDown className="h-3 w-3 shrink-0 text-[var(--fintheon-muted)]/45" />
                ) : (
                  <ChevronRight className="h-3 w-3 shrink-0 text-[var(--fintheon-muted)]/45" />
                )}
                <span
                  className={`${titleSize} min-w-0 flex-1 font-semibold text-[var(--fintheon-text)] line-clamp-1`}
                >
                  {signal.title}
                </span>
                <span
                  className="shrink-0 text-[8px] font-mono font-bold tabular-nums"
                  style={{ color: badgeColor }}
                >
                  {signal.score.toFixed(1)}
                </span>
                <span className="shrink-0 text-[7px] text-[var(--fintheon-muted)]/40 uppercase tracking-wider">
                  {SOURCE_LABEL[signal.source] || signal.source}
                </span>
              </div>

              <div
                className={`${textSize} ml-5 mt-1 min-w-0 text-[var(--fintheon-muted)]/50 line-clamp-1`}
              >
                {signal.summary}
              </div>

              {expanded && (
                <div className="ml-5 mt-2 space-y-2">
                  <FadingRuler />
                  <p
                    className={`${textSize} text-[var(--fintheon-text)]/70 leading-relaxed`}
                  >
                    {signal.analysis}
                  </p>

                  {signal.relatedHeadlines.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[7px] text-[var(--fintheon-muted)]/30 uppercase tracking-wider">
                          Related Headlines
                        </span>
                        <span className="text-[7px] text-[var(--fintheon-muted)]/30">
                          {(() => {
                            const h = Math.max(
                              0,
                              (Date.now() -
                                new Date(signal.generatedAt).getTime()) /
                                3_600_000,
                            );
                            if (h < 1) return "just now";
                            if (h < 24) return `${Math.round(h)}h ago`;
                            return `${Math.floor(h / 24)}d ago`;
                          })()}
                        </span>
                      </div>
                      {signal.relatedHeadlines.map((h, i) => (
                        <div
                          key={i}
                          className={`${textSize} text-[var(--fintheon-muted)]/50 line-clamp-1`}
                        >
                          {h}
                        </div>
                      ))}
                    </div>
                  )}

                  {signal.narrativeThreads.length > 0 && (
                    <div className="flex flex-wrap gap-x-2 gap-y-1">
                      {signal.narrativeThreads.map((t) => (
                        <span
                          key={t}
                          className="text-[7px] text-[var(--fintheon-accent)]/70"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </button>
          </div>
        );
      })}
    </div>
  );
}
