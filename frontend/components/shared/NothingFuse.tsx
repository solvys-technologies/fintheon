// [claude-code 2026-04-19] v5.22 S1: Nothing-design fuse bar. Sharp 2px corners, opaque
//   --fintheon-surface track, no inner glow, slow 4.2s shimmer with ~1s dead time between
//   sweeps. Color resolves from the shared fuse-palette via colorForSeverity / colorForScore.
// [claude-code 2026-04-19] RiskFlow card polish: segmented ruler ticks inside the fuse.
//   When `segments` is set (default 10 on both orientations), renders N-1 perpendicular
//   divider lines at equal intervals over the continuous fill. Shimmer is preserved on the
//   filled portion; the ticks sit above as a thin divider overlay so the bar reads as a
//   discrete 10-step scale while retaining the continuous shimmer. This matches the
//   vertical fuse anatomy on Fintheon Mobile RiskFlow cards.
import type { CSSProperties } from "react";
import {
  type FusePalette,
  type FuseSeverity,
  colorForSeverity,
  colorForScore,
  DEFAULT_FUSE_PALETTE,
} from "../../lib/fuse-palette";

type Orientation = "horizontal" | "vertical";

export interface NothingFuseProps {
  /** Fill percent, 0-1. */
  value: number;
  /** Explicit color override; takes precedence over severity/score. */
  color?: string;
  /** Severity-based color (uses palette). */
  severity?: FuseSeverity;
  /** Score 0-10; maps to severity through palette thresholds. */
  score?: number;
  palette?: FusePalette;
  orientation?: Orientation;
  /** Bar thickness in pixels (height for horizontal, width for vertical). */
  thickness?: number;
  /** Number of discrete segments to show via ruler tick dividers. Default 10.
   *  Pass 0 to disable ticks (continuous bar). */
  segments?: number;
  className?: string;
}

export function NothingFuse({
  value,
  color,
  severity,
  score,
  palette = DEFAULT_FUSE_PALETTE,
  orientation = "horizontal",
  thickness = 4,
  segments = 10,
  className,
}: NothingFuseProps) {
  const resolvedColor =
    color ??
    (severity !== undefined
      ? colorForSeverity(severity, palette)
      : score !== undefined
        ? colorForScore(score, palette)
        : colorForSeverity("neutral", palette));

  const clamped = Math.max(0, Math.min(1, value));
  const pct = `${clamped * 100}%`;
  const isHorizontal = orientation === "horizontal";

  const trackStyle: CSSProperties = isHorizontal
    ? { height: thickness, width: "100%" }
    : { width: thickness, height: "100%" };

  const fillStyle: CSSProperties = isHorizontal
    ? {
        width: pct,
        height: "100%",
        background: resolvedColor,
        position: "absolute",
        left: 0,
        top: 0,
      }
    : {
        width: "100%",
        height: pct,
        background: resolvedColor,
        position: "absolute",
        left: 0,
        bottom: 0,
      };

  // Ruler ticks — N-1 thin perpendicular dividers at equal intervals across the track.
  // Color is the fuse track color so they read as "cuts" in the bar rather than painted on.
  const tickCount = segments > 1 ? segments - 1 : 0;
  const ticks = Array.from({ length: tickCount }, (_, i) => {
    const offsetPct = ((i + 1) / segments) * 100;
    const tickStyle: CSSProperties = isHorizontal
      ? {
          position: "absolute",
          top: 0,
          bottom: 0,
          left: `${offsetPct}%`,
          width: 1,
          background: "var(--fintheon-bg, #050402)",
          pointerEvents: "none",
        }
      : {
          position: "absolute",
          left: 0,
          right: 0,
          bottom: `${offsetPct}%`,
          height: 1,
          background: "var(--fintheon-bg, #050402)",
          pointerEvents: "none",
        };
    return <span key={i} style={tickStyle} aria-hidden />;
  });

  return (
    <div
      className={`relative rounded-[2px] bg-[var(--fintheon-surface)] overflow-hidden${className ? ` ${className}` : ""}`}
      style={trackStyle}
    >
      <div className="rounded-[2px]" style={fillStyle}>
        <span className="nothing-fuse-shimmer" aria-hidden />
      </div>
      {ticks}
    </div>
  );
}
