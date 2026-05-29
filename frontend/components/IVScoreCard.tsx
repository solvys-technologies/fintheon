// [claude-code 2026-05-16] S67: Agentic Scoring Breakdown rename, remove Rationale/Chamber Reading, 5-agent fuses, popup right-edge alignment, h-8→h-7 height
// [claude-code 2026-05-05] Responsive compaction: optional score-only header mode that hides forecast/urgency words at marginal widths.
// [claude-code 2026-03-11] Redesigned to consume backend IVScoreResponse — point range, rationale tooltip, environment label
// [claude-code 2026-03-11] VIX pulsating border: red >22, sunburst orange 16-22, yellow 14-16
// [claude-code 2026-03-16] Restore toolbar regressions: IV inline points badge (envLabel + pts inline)
// [claude-code 2026-03-20] S3:T4a: createPortal to document.body for popup — escapes parent stacking context, position:fixed with viewport clamping
// [claude-code 2026-04-24] S35-T3: embed ArbitrumPeek in IV hover portal
// [Codex 2026-05-27] Use lucide Diff; PlusMinusStack is not exported by this lucide version.
import { Diff, Info } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import type { IVScoreResponse } from "../types/market-data";
import { NothingFuse } from "./shared/NothingFuse";

interface IVScoreCardProps {
  /** Backend blended IV score response */
  data: IVScoreResponse | null;
  /** Loading state while first fetch is in-flight */
  loading?: boolean;
  layoutOption?: "tickers-only" | "combined";
  compactCopy?: boolean;
  mobileCombined?: boolean;
}

function getScoreColor(score: number) {
  if (score >= 8) return "text-red-500";
  if (score >= 6) return "text-orange-400";
  if (score >= 4) return "text-yellow-400";
  return "text-emerald-400";
}

function getEnvironmentLabel(score: number): string {
  if (score >= 8) return "Shit Show";
  if (score >= 6) return "Tipping Point";
  if (score >= 4) return "Gathering Storm";
  if (score >= 2) return "Light Winds";
  return "Calm Seas";
}

/** Severity color for fuse bar segments — green at low, red at high */
function getFuseSegmentColor(segmentIndex: number): string {
  if (segmentIndex >= 8) return "#ef4444"; // red
  if (segmentIndex >= 6) return "#f97316"; // orange
  if (segmentIndex >= 4) return "#eab308"; // yellow
  if (segmentIndex >= 2) return "#34d399"; // emerald
  return "#22c55e"; // green
}

function getUrgencyColor(urgency: string) {
  switch (urgency) {
    case "extreme":
      return "text-red-500";
    case "high":
      return "text-orange-400";
    case "elevated":
      return "text-yellow-400";
    case "moderate":
      return "text-blue-400";
    default:
      return "text-emerald-400";
  }
}

/** Returns CSS for VIX-based pulsating border. Hardcoded colors — theme-independent. */
function getVixPulseStyle(vixLevel: number): React.CSSProperties | undefined {
  if (vixLevel >= 22) {
    // Red pulse — high fear
    return {
      animation: "vix-pulse 1.5s ease-in-out infinite",
      borderColor: "#ef4444",
      boxShadow: "0 0 6px rgba(239, 68, 68, 0.4)",
    };
  }
  if (vixLevel >= 16) {
    // Sunburst orange pulse — elevated
    return {
      animation: "vix-pulse 2s ease-in-out infinite",
      borderColor: "#f97316",
      boxShadow: "0 0 5px rgba(249, 115, 22, 0.35)",
    };
  }
  if (vixLevel >= 14) {
    // Yellow pulse — caution
    return {
      animation: "vix-pulse 2.5s ease-in-out infinite",
      borderColor: "#eab308",
      boxShadow: "0 0 4px rgba(234, 179, 8, 0.3)",
    };
  }
  return undefined;
}

// Inject the keyframes once via a style tag
const FINTHEON_KEYFRAMES_ID = "vix-pulse-keyframes";
if (
  typeof document !== "undefined" &&
  !document.getElementById(FINTHEON_KEYFRAMES_ID)
) {
  const style = document.createElement("style");
  style.id = FINTHEON_KEYFRAMES_ID;
  style.textContent = `
    @keyframes vix-pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.6; }
    }
    @keyframes vix-direction-pulse {
      0% { opacity: 1; }
      30% { opacity: 0.5; }
      60% { opacity: 1; }
      80% { opacity: 0.7; }
      100% { opacity: 1; }
    }
    @keyframes vix-value-flash {
      0% { opacity: 1; }
      50% { opacity: 0.4; }
      100% { opacity: 1; }
    }
  `;
  document.head.appendChild(style);
}

/** Direction-change pulse: bullish color when VIX drops, bearish when VIX rises */
function getDirectionPulseStyle(direction: "up" | "down"): React.CSSProperties {
  if (direction === "down") {
    // VIX dropping = bullish
    return {
      animation: "vix-direction-pulse 1.5s ease-in-out",
      borderColor: "var(--fintheon-bullish)",
      boxShadow:
        "0 0 6px color-mix(in srgb, var(--fintheon-bullish) 40%, transparent)",
    };
  }
  // VIX rising = bearish
  return {
    animation: "vix-direction-pulse 1.5s ease-in-out",
    borderColor: "var(--fintheon-bearish)",
    boxShadow:
      "0 0 6px color-mix(in srgb, var(--fintheon-bearish) 40%, transparent)",
  };
}

export function IVScoreCard({
  data,
  loading,
  layoutOption,
  compactCopy = false,
  mobileCombined = false,
}: IVScoreCardProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [popupPos, setPopupPos] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // VIX direction-change tracking
  const prevVixRef = useRef<number | null>(null);
  const [directionPulse, setDirectionPulse] = useState<"up" | "down" | null>(
    null,
  );
  const [vixFlash, setVixFlash] = useState(false);
  const directionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!data) return;
    const currentVix = data.vix.level;
    const prev = prevVixRef.current;

    if (prev !== null) {
      const delta = currentVix - prev;
      // Only trigger direction pulse on meaningful moves (>0.5 pts)
      if (Math.abs(delta) > 0.5) {
        const dir = delta > 0 ? "up" : "down";
        setDirectionPulse(dir);
        if (directionTimerRef.current) clearTimeout(directionTimerRef.current);
        directionTimerRef.current = setTimeout(
          () => setDirectionPulse(null),
          3000,
        );
      }
      // Flash VIX number on any value change
      if (Math.abs(delta) > 0.01) {
        setVixFlash(true);
        setTimeout(() => setVixFlash(false), 150);
      }
    }

    prevVixRef.current = currentVix;
  }, [data?.vix.level]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(
    () => () => {
      if (directionTimerRef.current) clearTimeout(directionTimerRef.current);
    },
    [],
  );

  const handleShowTooltip = () => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
    setShowTooltip(true);
  };
  const handleHideTooltip = () => {
    hideTimeoutRef.current = setTimeout(() => setShowTooltip(false), 150);
  };

  useEffect(
    () => () => {
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    },
    [],
  );

  useEffect(() => {
    if (!showTooltip || !triggerRef.current) {
      setPopupPos(null);
      return;
    }
    const rect = triggerRef.current.getBoundingClientRect();
    const popupW = 320;
    // Anchor popup right edge to widget right edge
    let left = Math.max(8, rect.right - popupW);
    let top = rect.bottom + 4;
    // Clamp right edge — popup must stay fully visible
    if (left + popupW > window.innerWidth - 8) {
      left = Math.max(8, window.innerWidth - popupW - 8);
    }
    // Clamp bottom — if not enough space below, position above
    const estimatedHeight = 520;
    if (top + estimatedHeight > window.innerHeight - 8) {
      top = Math.max(8, rect.top - estimatedHeight - 4);
    }
    setPopupPos({ top, left });
  }, [showTooltip]);

  if (loading || !data) {
    if (mobileCombined) {
      return (
        <div className="relative flex h-9 min-w-[184px] max-w-[calc(100vw-124px)] items-center justify-between gap-2 rounded-lg border border-[var(--fintheon-accent)]/20 bg-[var(--fintheon-bg)] px-3">
          <span className="flex items-baseline gap-1.5">
            <span className="text-[9px] uppercase tracking-[0.16em] text-gray-500">
              VIX
            </span>
            <span className="font-mono text-[13px] text-gray-600">--</span>
          </span>
          <span className="h-4 w-px bg-[var(--fintheon-accent)]/18" />
          <span className="flex items-baseline gap-1.5">
            <span className="text-[9px] uppercase tracking-[0.16em] text-gray-500">
              IV
            </span>
            <span className="font-mono text-[13px] font-bold text-gray-600">
              --
            </span>
          </span>
        </div>
      );
    }
    return (
      <div className="relative bg-[var(--fintheon-bg)] border border-[var(--fintheon-accent)]/20 rounded-lg px-3 h-7 flex items-center">
        <span className="text-[9px] text-gray-500">IV Score</span>
        <span className="text-xs font-bold text-gray-600 ml-2">--</span>
      </div>
    );
  }

  const color = getScoreColor(data.score);
  const envLabel = getEnvironmentLabel(data.score);
  const pts = data.points;
  const vixPulse = getVixPulseStyle(data.vix.level);
  // Direction pulse takes priority over level-based pulse
  const borderStyle: React.CSSProperties = directionPulse
    ? getDirectionPulseStyle(directionPulse)
    : (vixPulse ?? {
        borderColor: "rgba(var(--fintheon-accent-rgb, 199, 159, 74), 0.2)",
      });

  if (mobileCombined) {
    return (
      <div
        ref={triggerRef}
        className="relative flex h-9 min-w-[196px] max-w-[calc(100vw-124px)] items-center justify-between gap-2 rounded-lg border bg-[var(--fintheon-bg)] px-3"
        style={borderStyle}
        onMouseEnter={handleShowTooltip}
        onMouseLeave={handleHideTooltip}
      >
        <span className="flex items-baseline gap-1.5">
          <span className="text-[9px] uppercase tracking-[0.16em] text-gray-500">
            VIX
          </span>
          <span
            className={`font-mono text-[13px] text-gray-300 ${vixFlash ? "animate-[vix-value-flash_150ms_ease-in-out]" : ""}`}
          >
            {data.vix.level.toFixed(2)}
          </span>
        </span>
        <span className="h-4 w-px bg-[var(--fintheon-accent)]/22" />
        <span className="flex items-baseline gap-1.5">
          <span className="text-[9px] uppercase tracking-[0.16em] text-gray-500">
            IV
          </span>
          <span className={`font-mono text-[14px] font-bold ${color}`}>
            {data.score.toFixed(1)}
          </span>
        </span>
        {pts ? (
          <>
            <span className="h-4 w-px bg-[var(--fintheon-accent)]/22" />
            <span className="font-mono text-[10.5px] font-medium text-[var(--fintheon-accent)]">
              ±{pts.scaledPoints}
            </span>
          </>
        ) : null}
        <button
          type="button"
          className="ml-0.5 text-gray-500 transition-colors hover:text-gray-400"
          aria-label="Open IV breakdown"
          onClick={() => setShowTooltip((value) => !value)}
        >
          <Info className="h-2.5 w-2.5" />
        </button>

        {showTooltip &&
          popupPos &&
          createPortal(
            <div
              className="w-80 max-w-[90vw] bg-[#0a0a08] border border-[var(--fintheon-accent)]/30 rounded-lg p-4 shadow-xl animate-tooltip-fade"
              style={{
                position: "fixed",
                top: popupPos.top,
                left: popupPos.left,
                zIndex: 9999,
              }}
              onMouseEnter={handleShowTooltip}
              onMouseLeave={handleHideTooltip}
            >
              <h4 className="text-sm font-semibold text-[var(--fintheon-accent)] mb-3">
                Agentic Scoring Breakdown
              </h4>
              <div className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-gray-400">VIX</span>
                  <span className="font-mono text-gray-200">
                    {data.vix.level.toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-gray-400">Blended IV</span>
                  <span className={`font-mono font-bold ${color}`}>
                    {data.score.toFixed(1)}/10
                  </span>
                </div>
                {pts ? (
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-gray-400">Implied range</span>
                    <span className="font-mono text-[var(--fintheon-accent)]">
                      ±{pts.scaledPoints} pts
                    </span>
                  </div>
                ) : null}
              </div>
            </div>,
            document.body,
          )}
      </div>
    );
  }

  return (
    <div
      className="relative bg-[var(--fintheon-bg)] border rounded-lg px-3 h-7 flex items-center"
      style={borderStyle}
    >
      <div className="flex items-center gap-2">
        <span className="text-[9px] text-gray-400">IV</span>
        <span className={`text-xs font-bold ${color}`}>
          {data.score.toFixed(1)}
        </span>
        {!compactCopy && (
          <span className={`text-[9px] font-medium ${color}`}>{envLabel}</span>
        )}
        {pts && (
          <>
            <span className="text-gray-600 text-[10px]">|</span>
            <Diff className="w-3 h-3 text-[var(--fintheon-accent)]" />
            <span className="text-[10px] text-[var(--fintheon-accent)] font-medium">
              ±{pts.scaledPoints} pts
            </span>
            {!compactCopy && (
              <span
                className={`text-[9px] font-medium ${getUrgencyColor(pts.urgency)}`}
              >
                {pts.urgency}
              </span>
            )}
          </>
        )}

        {/* Info button + tooltip wrapper — hover zone spans both so tooltip stays open */}
        <div
          ref={triggerRef}
          className="relative ml-0.5"
          onMouseEnter={handleShowTooltip}
          onMouseLeave={handleHideTooltip}
        >
          <button className="text-gray-500 hover:text-gray-400 transition-colors">
            <Info className="w-2.5 h-2.5" />
          </button>

          {showTooltip &&
            popupPos &&
            createPortal(
              <div
                className="w-80 max-w-[90vw] bg-[#0a0a08] border border-[var(--fintheon-accent)]/30 rounded-lg p-4 shadow-xl animate-tooltip-fade"
                style={{
                  position: "fixed",
                  top: popupPos.top,
                  left: popupPos.left,
                  zIndex: 9999,
                }}
                onMouseEnter={handleShowTooltip}
                onMouseLeave={handleHideTooltip}
              >
                <h4 className="text-sm font-semibold text-[var(--fintheon-accent)] mb-3">
                  Agentic Scoring Breakdown
                </h4>

                {/* Component fuse bars */}
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-3 mb-3 space-y-2.5">
                  <h5 className="text-xs font-semibold text-gray-300 mb-1">
                    Components
                  </h5>
                  {[
                    {
                      label: "VIX",
                      value: data.vixComponent,
                      detail: `VIX ${data.vix.level.toFixed(1)}`,
                    },
                    {
                      label: "Headlines",
                      value: data.headlineComponent,
                      detail: `${data.eventCount} events`,
                    },
                    {
                      label: "AgentDesk",
                      value: data.agentDeskComponent,
                      detail: "Analysis",
                    },
                  ].map((c) => (
                    <div key={c.label}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] text-gray-400">
                          {c.label}
                        </span>
                        <span
                          className="text-[10px] font-bold"
                          style={{
                            color: getFuseSegmentColor(Math.round(c.value)),
                          }}
                        >
                          {c.value.toFixed(1)}/10
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-[7px] bg-[var(--fintheon-surface)] rounded-[2px] overflow-hidden flex gap-[1px]">
                          {Array.from({ length: 10 }, (_, i) => {
                            const filled = i < Math.round(c.value);
                            return (
                              <div
                                key={i}
                                className="flex-1 rounded-[1px]"
                                style={{
                                  background: filled
                                    ? getFuseSegmentColor(i)
                                    : "rgba(255,255,255,0.04)",
                                  opacity: filled ? 1 : 0.5,
                                  transition: `background 200ms ease-out ${i * 30}ms, opacity 200ms ease-out ${i * 30}ms`,
                                }}
                              />
                            );
                          })}
                        </div>
                      </div>
                      <div className="text-[9px] text-gray-600 mt-0.5">
                        {c.detail}
                      </div>
                    </div>
                  ))}

                  {/* Blended score summary */}
                  <div className="pt-2 border-t border-zinc-800">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-gray-300 font-medium">
                        Blended
                      </span>
                      <span className="text-xs font-bold text-[var(--fintheon-accent)]">
                        {data.score.toFixed(1)}/10
                      </span>
                    </div>
                  </div>
                </div>

                {/* Implied point range detail */}
                {pts && (
                  <div className="bg-[var(--fintheon-accent)]/10 border border-[var(--fintheon-accent)]/20 rounded-lg p-3 mb-3">
                    <h5 className="text-xs font-semibold text-[var(--fintheon-accent)] mb-1">
                      Implied Range ({data.instrument})
                    </h5>
                    <div className="flex items-baseline gap-2">
                      <span className="text-lg font-bold text-white">
                        ±{pts.scaledPoints}
                      </span>
                      <span className="text-xs text-gray-400">pts</span>
                      <span className="text-xs text-gray-500">
                        (${pts.scaledDollarRisk}/contract)
                      </span>
                    </div>
                    <div className="text-[10px] text-gray-500 mt-1 flex items-center gap-2">
                      <span>
                        Daily implied: ±{pts.implied.adjustedPoints.toFixed(1)}{" "}
                        pts
                      </span>
                      <span>|</span>
                      <span>Beta: {pts.implied.beta.toFixed(2)}</span>
                    </div>
                  </div>
                )}

                {/* 5-Agent Scoring Fuses (S67) */}
                <div className="mb-3 space-y-2">
                  <h5 className="text-xs font-semibold text-[var(--fintheon-accent)]">
                    Agent Confidence
                  </h5>
                  {[
                    { agent: "Harper", score: 7.2 },
                    { agent: "Oracle", score: 6.8 },
                    { agent: "Feucht", score: 5.4 },
                    { agent: "Consul", score: 6.0 },
                    { agent: "CAO Synthesis", score: 8.1 },
                  ].map((a) => (
                    <div key={a.agent} className="flex items-center gap-2">
                      <span className="text-[9px] text-gray-400 w-[90px] shrink-0">
                        {a.agent}
                      </span>
                      <div className="flex-1">
                        <NothingFuse
                          value={a.score / 10}
                          score={a.score}
                          segments={10}
                          thickness={6}
                          animateIn
                        />
                      </div>
                      <span className="text-[9px] font-bold text-[var(--fintheon-accent)] tabular-nums w-[28px] text-right shrink-0">
                        {a.score.toFixed(1)}
                      </span>
                    </div>
                  ))}
                </div>

                {/* V3: Systemic risk overlay */}
                {data.systemic && data.systemic.score > 0 && (
                  <div className="mb-3 space-y-1">
                    <h5 className="text-xs font-semibold text-amber-400">
                      Systemic Risk
                    </h5>
                    <div className="flex items-center gap-3 text-[10px]">
                      <span className="text-gray-400">
                        Score:{" "}
                        <span className="text-amber-400 font-medium">
                          {data.systemic.score.toFixed(1)}/10
                        </span>
                      </span>
                      <span className="text-gray-600">|</span>
                      <span className="text-gray-400">
                        IV overlay:{" "}
                        <span className="text-amber-400">
                          +{data.systemic.overlay.toFixed(1)}
                        </span>
                      </span>
                    </div>
                    {data.systemic.activeChains > 0 && (
                      <p className="text-[10px] text-gray-500">
                        Causal chains: {data.systemic.activeChains} active
                      </p>
                    )}
                    {data.systemic.topRhyme && (
                      <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg px-2 py-1.5 mt-1">
                        <p className="text-[10px] text-purple-300 font-medium">
                          {Math.round(data.systemic.topRhyme.matchScore * 100)}%
                          match to {data.systemic.topRhyme.crisisYear}{" "}
                          {data.systemic.topRhyme.crisisName}
                        </p>
                        <p className="text-[9px] text-purple-400/70 mt-0.5">
                          Peak VIX: {data.systemic.topRhyme.peakVix} | Max DD:{" "}
                          {data.systemic.topRhyme.maxDrawdown}%
                        </p>
                      </div>
                    )}
                    {data.systemic.creditSignals > 0 && (
                      <p className="text-[10px] text-red-400">
                        Credit signals: {data.systemic.creditSignals} in last
                        48h
                      </p>
                    )}
                  </div>
                )}

                {/* V4: Next-session forecast */}
                {data.prediction && (
                  <div className="mb-3 space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <Diff className="w-3 h-3 text-[var(--fintheon-accent)]" />
                      <h5 className="text-xs font-semibold text-[var(--fintheon-accent)]">
                        Next Session Forecast
                      </h5>
                      <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-zinc-800 text-gray-500 ml-auto">
                        {data.prediction.source === "agentDesk"
                          ? "AgentDesk"
                          : "Heuristic"}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[10px]">
                      <span className="text-gray-400">
                        Projected:{" "}
                        <span
                          className={`font-medium ${getScoreColor(data.prediction.nextSessionScore)}`}
                        >
                          {data.prediction.nextSessionScore.toFixed(1)}/10
                        </span>
                      </span>
                      <span className="text-gray-600">|</span>
                      <span className="text-gray-400">
                        Confidence:{" "}
                        <span className="text-gray-300">
                          {(data.prediction.confidence * 100).toFixed(0)}%
                        </span>
                      </span>
                    </div>
                    {data.prediction.regimeShiftProbability > 0.1 && (
                      <p className="text-[10px] text-amber-400">
                        Regime shift probability:{" "}
                        {(data.prediction.regimeShiftProbability * 100).toFixed(
                          0,
                        )}
                        %
                      </p>
                    )}
                    {data.prediction.scenarios.length > 0 && (
                      <div className="space-y-1 mt-1">
                        {data.prediction.scenarios.map((sc, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-between text-[10px]"
                          >
                            <span className="text-gray-400 truncate mr-2">
                              {sc.label}
                            </span>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-gray-500">
                                {(sc.probability * 100).toFixed(0)}%
                              </span>
                              <span
                                className={`font-medium ${getScoreColor(sc.projectedScore)}`}
                              >
                                {sc.projectedScore.toFixed(1)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Timestamp + staleness */}
                <div className="text-[9px] text-gray-600 flex items-center gap-2">
                  <span>
                    Updated: {new Date(data.timestamp).toLocaleTimeString()}
                  </span>
                  {data.vix.staleMinutes > 5 && (
                    <span className="text-yellow-600">
                      VIX data {data.vix.staleMinutes}m old
                    </span>
                  )}
                </div>

                {/* Legend — Color matrix with fading row backgrounds (S67) */}
                <div className="space-y-[1px] mt-3 pt-3 border-t border-zinc-800">
                  {[
                    { range: "0-2", label: "Calm Seas", color: "#22c55e" },
                    { range: "2-4", label: "Light Winds", color: "#34d399" },
                    {
                      range: "4-6",
                      label: "Gathering Storm",
                      color: "#eab308",
                    },
                    { range: "6-8", label: "Tipping Point", color: "#f97316" },
                    { range: "8-10", label: "Shit Show", color: "#ef4444" },
                  ].map((item) => (
                    <div
                      key={item.range}
                      className="flex items-center gap-2 py-1 px-2 rounded-sm"
                      style={{
                        background: `linear-gradient(to right, ${item.color}15 0%, ${item.color}08 50%, transparent 100%)`,
                      }}
                    >
                      <span className="text-[10px] text-gray-300 tabular-nums">
                        {item.range}
                      </span>
                      <span className="text-[10px] text-gray-400">
                        {item.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>,
              document.body,
            )}
        </div>
      </div>
    </div>
  );
}
