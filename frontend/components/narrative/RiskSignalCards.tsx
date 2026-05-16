// [claude-code 2026-04-16] S16-T3: Risk Signal cards — full-border severity coloring, solvys-feels polish
// [claude-code 2026-05-03] Solvys cleanup: chevron rows + fading rulers, no card borders.
import { useState, useEffect, useRef, useCallback } from "react";
import { ChevronDown, ChevronRight, Loader2, ShieldAlert } from "lucide-react";
import { FadingRuler } from "../shared/FadingRuler";
import {
  emptyCachedSignals,
  formatAge,
  isFreshGenerated,
  scoreColor,
  SOURCE_LABEL,
  type CachedSignals,
  type RiskSignal,
  type RiskSignalPayload,
} from "./risk-signal-card-utils";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";
const CACHE_KEY = "fintheon:risk-signals";
const POLL_INTERVAL = 120_000;

function loadCached(): CachedSignals {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) throw new Error("empty");
    const parsed = JSON.parse(raw);
    const signals = Array.isArray(parsed) ? parsed : (parsed.signals ?? []);
    const generatedAt =
      (Array.isArray(parsed) ? signals[0]?.generatedAt : parsed.generatedAt) ??
      signals[0]?.generatedAt ??
      null;
    return {
      signals,
      generatedAt,
      stale: !isFreshGenerated(generatedAt) || Boolean(parsed.stale),
      freshnessStatus: parsed.freshnessStatus ?? "fresh",
    };
  } catch {
    return emptyCachedSignals();
  }
}

function saveCached(payload: CachedSignals): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
  } catch {
    /* silent */
  }
}

export function RiskSignalCards({ compact = false }: { compact?: boolean }) {
  const cached = loadCached();
  const [signals, setSignals] = useState<RiskSignal[]>(cached.signals);
  const [freshness, setFreshness] = useState<CachedSignals>(cached);
  const [loading, setLoading] = useState(cached.signals.length === 0);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [driftData, setDriftData] = useState<
    Record<string, { label: string; loading: boolean }>
  >({});
  const [visible, setVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchSignals = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/riskflow/risk-signals`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as RiskSignalPayload;
      const freshItems = data.signals ?? [];
      const staleItems = data.staleSignals ?? [];
      const items = freshItems.length > 0 ? freshItems : staleItems;
      const generatedAt =
        data.generatedAt ?? items[0]?.generatedAt ?? cached.generatedAt;
      const nextFreshness: CachedSignals = {
        signals: items,
        generatedAt,
        stale:
          Boolean(data.stale) ||
          freshItems.length === 0 ||
          !isFreshGenerated(generatedAt),
        freshnessStatus: data.freshnessStatus ?? "empty",
      };
      setSignals(items);
      setFreshness(nextFreshness);
      saveCached(nextFreshness);
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

  useEffect(() => {
    if (!expandedId) return;
    if (driftData[expandedId]) return;
    setDriftData((prev) => ({ ...prev, [expandedId]: { label: "", loading: true } }));
    fetch(
      `${API_BASE}/api/riskflow/risk-signals/estimated-drift?signalId=${expandedId}`,
    )
      .then((res) => res.json())
      .then((data) => {
        setDriftData((prev) => ({
          ...prev,
          [expandedId]: {
            label: String(data.label ?? data.drift ?? "N/A"),
            loading: false,
          },
        }));
      })
      .catch(() => {
        setDriftData((prev) => ({
          ...prev,
          [expandedId]: { label: "Unavailable", loading: false },
        }));
      });
  }, [expandedId]);

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
          {freshness.freshnessStatus === "generation-error"
            ? "Risk signals unavailable"
            : "No fresh risk signals"}
        </div>
        <div className="mt-1 text-[8px] text-[var(--fintheon-muted)]/30">
          Inputs checked {formatAge(freshness.generatedAt)}
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex flex-col py-1">
      {freshness.stale && (
        <div className="px-2 pb-1 text-[8px] text-[var(--fintheon-muted)]/35">
          Last generated {formatAge(freshness.generatedAt)}
        </div>
      )}
      {signals.map((signal, index) => {
        const expanded = expandedId === signal.id;
        const badgeColor = scoreColor(signal.score);

        return (
          <div key={signal.id} className="min-w-0">
            {index > 0 && <FadingRuler className="my-1" />}
            <button
              type="button"
              onClick={() => setExpandedId(expanded ? null : signal.id)}
              className={`w-full min-w-0 cursor-pointer rounded-md text-left transition-colors hover:bg-[var(--fintheon-accent)]/5 ${
                expanded ? "bg-[var(--fintheon-accent)]/5" : ""
              } ${freshness.stale ? "opacity-70" : ""} ${padding}`}
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
                  className="shrink-0 text-[9px] text-[var(--fintheon-muted)]/50 line-clamp-1 max-w-[160px]"
                  title={signal.summary}
                >
                  {signal.summary?.length > 60
                    ? signal.summary.slice(0, 60) + "..."
                    : signal.summary}
                </span>
              </div>

              <div
                className={`${textSize} ml-5 mt-1 min-w-0 text-[var(--fintheon-muted)]/50 line-clamp-1`}
              >
                {signal.summary}
              </div>

              {expanded && (
                <div className="ml-5 mt-2 space-y-2 rounded-md bg-[var(--fintheon-accent)]/[0.035] px-2 py-2">
                  <FadingRuler />
                  <p
                    className={`${textSize} text-[var(--fintheon-text)]/70 leading-relaxed`}
                  >
                    {signal.analysis}
                  </p>

                  <div className="flex items-center gap-2">
                    <span className="text-[7px] text-[var(--fintheon-muted)]/30 uppercase tracking-wider">
                      Estimated Drift
                    </span>
                    {driftData[signal.id]?.loading ? (
                      <span className="h-3 w-20 rounded-sm bg-[var(--fintheon-accent)]/10 animate-pulse" />
                    ) : (
                      <span className="text-[9px] text-[var(--fintheon-accent)] font-mono font-medium">
                        {driftData[signal.id]?.label ?? "—"}
                      </span>
                    )}
                  </div>

                  {signal.relatedHeadlines.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[7px] text-[var(--fintheon-muted)]/30 uppercase tracking-wider">
                          Related Headlines
                        </span>
                        <span className="text-[7px] text-[var(--fintheon-muted)]/30">
                          {formatAge(signal.generatedAt)}
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
