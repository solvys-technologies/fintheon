// [claude-code 2026-04-16] S16-T3: Risk Signal cards — full-border severity coloring, solvys-feels polish
// [claude-code 2026-05-03] Solvys cleanup: chevron rows + fading rulers, no card borders.
import { useState, useEffect, useRef, useCallback } from "react";
import { ChevronDown, ChevronRight, Loader2, ShieldAlert } from "lucide-react";
import { FadingRuler } from "../shared/FadingRuler";
import { AgenticFeedbackControls } from "../shared/AgenticFeedbackControls";
import { NothingFuse } from "../shared/NothingFuse";
import {
  emptyCachedSignals,
  formatAge,
  isFreshGenerated,
  type CachedSignals,
  type RiskSignal,
  type RiskSignalPayload,
} from "./risk-signal-card-utils";
import {
  formatDriftLabel,
  inferSignalDirection,
  useRiskSignalDrift,
} from "./useRiskSignalDrift";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";
const CACHE_KEY = "fintheon:risk-signals";
const POLL_INTERVAL = 120_000;
const LEGACY_FALLBACK_COPY =
  "Recent RiskFlow input cleared the signal threshold before the AI refinement layer produced a card.";

function displayAnalysis(signal: RiskSignal): string {
  if (signal.analysis.includes(LEGACY_FALLBACK_COPY)) {
    return "Pending Agentic Desk refinement. This catalyst met the desk-watch threshold and needs Herald/CAO synthesis before it should be treated as a full Risk Signal.";
  }
  return signal.analysis;
}

function isPendingRefinement(signal: RiskSignal): boolean {
  return (
    signal.refinementStatus === "pending-refinement" ||
    signal.analysis.includes(LEGACY_FALLBACK_COPY)
  );
}

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

  const driftData = useRiskSignalDrift(signals);

  const textSize = compact
    ? "text-[10.5px] max-[767px]:text-[12px]"
    : "text-[11.5px]";
  const titleSize = compact
    ? "text-[11.5px] max-[767px]:text-[13px]"
    : "text-[12.5px]";
  const metaSize = compact
    ? "text-[9px] max-[767px]:text-[10px]"
    : "text-[9.5px]";
  const microSize = compact
    ? "text-[8px] max-[767px]:text-[9px]"
    : "text-[8.5px]";
  const padding = compact
    ? "px-1.5 py-2.5 max-[767px]:px-2 max-[767px]:py-3"
    : "px-2.5 py-3";

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
        const direction = inferSignalDirection(signal);
        const driftLabel = formatDriftLabel(driftData[signal.id]?.label);
        const directionColor =
          direction === "BULLISH"
            ? "var(--fintheon-bullish)"
            : direction === "BEARISH"
              ? "var(--fintheon-bearish)"
              : "var(--fintheon-muted)";

        return (
          <div key={signal.id} className="min-w-0">
            {index > 0 && <FadingRuler className="my-1" />}
            <button
              type="button"
              onClick={() => setExpandedId(expanded ? null : signal.id)}
              className={`w-full min-w-0 cursor-pointer rounded-md text-left transition-colors hover:text-[var(--fintheon-accent)] ${
                expanded ? "text-[var(--fintheon-accent)]" : ""
              } ${freshness.stale ? "opacity-70" : ""} ${padding}`}
            >
              <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_5.25rem] items-center gap-2 max-[767px]:grid-cols-[auto_minmax(0,1fr)_6.35rem] max-[767px]:gap-2.5">
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
                <span className="flex min-w-0 items-center justify-end gap-1.5 text-right font-mono leading-tight max-[767px]:gap-2">
                  <ChevronRight
                    className="h-3 w-3 shrink-0"
                    style={{
                      color: directionColor,
                      transform:
                        direction === "BULLISH"
                          ? "rotate(-90deg)"
                          : direction === "BEARISH"
                            ? "rotate(90deg)"
                            : "rotate(0deg)",
                    }}
                  />
                  <span className="block w-[4.35rem] shrink-0 max-[767px]:w-[5.2rem]">
                    <span
                      className={`mb-1 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-1 ${metaSize} text-[var(--fintheon-muted)]/50`}
                    >
                      <span className="min-w-0 truncate whitespace-nowrap">
                        {driftLabel}
                      </span>
                      <span className="whitespace-nowrap tabular-nums">
                        {signal.score.toFixed(1)}
                      </span>
                    </span>
                    <NothingFuse
                      value={Math.max(0, Math.min(1, signal.score / 10))}
                      score={signal.score}
                      thickness={2}
                      segments={5}
                    />
                  </span>
                </span>
              </div>
            </button>
            <div
              aria-hidden={!expanded}
              className={`grid transition-[grid-template-rows,opacity,transform,filter] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${
                expanded
                  ? "translate-y-0 opacity-100 blur-none"
                  : "pointer-events-none -translate-y-1 opacity-0 blur-[1px]"
              }`}
              style={{ gridTemplateRows: expanded ? "1fr" : "0fr" }}
            >
              <div className="min-h-0 overflow-hidden">
                <div className="relative ml-5 mt-2 space-y-2 px-2 py-2 pr-16 max-[767px]:ml-4 max-[767px]:pr-3">
                  <FadingRuler />
                  <p
                    className={`${textSize} text-[var(--fintheon-text)]/70 leading-relaxed max-[767px]:text-[var(--fintheon-text)]/78`}
                  >
                    {displayAnalysis(signal)}
                  </p>

                  {isPendingRefinement(signal) && (
                    <div
                      className={`${microSize} uppercase tracking-[0.16em] text-[var(--fintheon-accent)]/55`}
                    >
                      Pending Agentic Desk refinement
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <span
                      className={`${microSize} text-[var(--fintheon-muted)]/30 uppercase tracking-wider`}
                    >
                      Estimated Drift
                    </span>
                    {driftData[signal.id]?.loading ? (
                      <span className="h-3 w-20 rounded-sm bg-[var(--fintheon-accent)]/10 animate-pulse" />
                    ) : (
                      <span
                        className={`${metaSize} text-[var(--fintheon-accent)] font-mono font-medium`}
                      >
                        {driftData[signal.id]?.label ?? "—"}
                      </span>
                    )}
                  </div>

                  {signal.relatedHeadlines.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span
                          className={`${microSize} text-[var(--fintheon-muted)]/30 uppercase tracking-wider`}
                        >
                          Related Headlines
                        </span>
                        <span
                          className={`${microSize} text-[var(--fintheon-muted)]/30`}
                        >
                          {formatAge(signal.generatedAt)}
                        </span>
                      </div>
                      {signal.relatedHeadlines.map((h, i) => (
                        <div
                          key={i}
                          className={`${textSize} text-[var(--fintheon-muted)]/50 line-clamp-1 max-[767px]:text-[var(--fintheon-muted)]/62`}
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
                          className={`${microSize} text-[var(--fintheon-accent)]/70`}
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                  {expanded && (
                    <AgenticFeedbackControls
                      surface="risk-signals"
                      itemId={signal.id}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
