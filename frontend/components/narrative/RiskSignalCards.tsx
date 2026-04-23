// [claude-code 2026-04-16] S16-T3: Risk Signal cards — full-border severity coloring, solvys-feels polish
import { useState, useEffect, useRef, useCallback } from "react";
import {
  ChevronDown,
  ChevronRight,
  Loader2,
  ShieldAlert,
} from "lucide-react";

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

const SEVERITY_BORDER: Record<string, string> = {
  critical: "var(--fintheon-bearish)",
  high: "var(--fintheon-bearish)",
  medium: "var(--fintheon-accent)",
  low: "var(--fintheon-muted)",
};

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
  const padding = compact ? "px-3 py-2" : "px-4 py-3";

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
    <div ref={containerRef} className="flex flex-col gap-2 py-2">
      {signals.map((signal) => {
        const expanded = expandedId === signal.id;
        const borderColor = SEVERITY_BORDER[signal.severity];
        const badgeColor = scoreColor(signal.score);

        return (
          <button
            key={signal.id}
            type="button"
            onClick={() => setExpandedId(expanded ? null : signal.id)}
            className={`w-full text-left rounded-lg transition-colors ${padding}`}
            style={{
              border: `1px solid ${borderColor}`,
              backgroundColor:
                "color-mix(in srgb, var(--fintheon-surface) 80%, transparent)",
            }}
          >
            {/* Collapsed: title + score badge + source tag */}
            <div className="flex items-center gap-2">
              {expanded ? (
                <ChevronDown className="w-3 h-3 text-[var(--fintheon-muted)]/40 flex-shrink-0" />
              ) : (
                <ChevronRight className="w-3 h-3 text-[var(--fintheon-muted)]/40 flex-shrink-0" />
              )}
              <span
                className={`${titleSize} font-semibold text-[var(--fintheon-text)] flex-1 line-clamp-1`}
              >
                {signal.title}
              </span>
              <span
                className="text-[8px] font-mono font-bold px-1.5 py-0.5 rounded flex-shrink-0"
                style={{
                  color: badgeColor,
                  backgroundColor: `color-mix(in srgb, ${badgeColor} 12%, transparent)`,
                }}
              >
                {signal.score.toFixed(1)}
              </span>
              <span className="text-[7px] text-[var(--fintheon-muted)]/40 uppercase tracking-wider flex-shrink-0">
                {SOURCE_LABEL[signal.source] || signal.source}
              </span>
            </div>

            {/* Summary always visible */}
            <div
              className={`${textSize} text-[var(--fintheon-muted)]/50 mt-1 line-clamp-1`}
            >
              {signal.summary}
            </div>

            {/* Expanded: analysis + headlines + threads */}
            {expanded && (
              <div className="mt-2 pt-2 border-t border-[var(--fintheon-border)]/10 space-y-2">
                <p
                  className={`${textSize} text-[var(--fintheon-text)]/70 leading-relaxed`}
                >
                  {signal.analysis}
                </p>

                {signal.relatedHeadlines.length > 0 && (
                  <div>
                    <div className="text-[7px] text-[var(--fintheon-muted)]/30 uppercase tracking-wider mb-1">
                      Related Headlines
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
                  <div className="flex flex-wrap gap-1">
                    {signal.narrativeThreads.map((t) => (
                      <span
                        key={t}
                        className="text-[7px] px-1.5 py-0.5 rounded-full border"
                        style={{
                          color: "var(--fintheon-accent)",
                          borderColor:
                            "color-mix(in srgb, var(--fintheon-accent) 20%, transparent)",
                          backgroundColor:
                            "color-mix(in srgb, var(--fintheon-accent) 5%, transparent)",
                        }}
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
