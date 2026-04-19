// [claude-code 2026-04-19] v5.22 S1: Nothing-design fuse bar. Sharp 2px corners, opaque
//   --fintheon-surface track, no inner glow, slow 4.2s shimmer with ~1s dead time between
//   sweeps. Color resolves from the shared fuse-palette via colorForSeverity / colorForScore.
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

  return (
    <div
      className={`relative rounded-[2px] bg-[var(--fintheon-surface)] overflow-hidden${className ? ` ${className}` : ""}`}
      style={trackStyle}
    >
      <div className="rounded-[2px]" style={fillStyle}>
        <span className="nothing-fuse-shimmer" aria-hidden />
      </div>
    </div>
  );
}
