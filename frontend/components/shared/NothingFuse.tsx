// [claude-code 2026-04-30] "solvys fuses" baseline — every horizontal/vertical
//   fuse renders linear ruler increments on the shared primitive.
// [claude-code 2026-04-20] `animateIn` — when true, the fuse mounts at 0 and
//   transitions to `value` on the next frame, so new items arriving in the
//   feed visibly "charge up". Vertical orientation fills bottom-up (matches
//   the mobile segmented bar); horizontal fills left→right.
// [claude-code 2026-04-19] v5.22 S1: Nothing-design fuse bar. Sharp 2px corners, opaque
//   --fintheon-surface track, no inner glow, slow 4.2s shimmer with ~1s dead time between
//   sweeps. Color resolves from the shared fuse-palette via colorForSeverity / colorForScore.
// [claude-code 2026-04-19] RiskFlow card polish: segmented ruler ticks inside the fuse.
//   When `segments` is set (default 10 on both orientations), renders N-1 perpendicular
//   divider lines at equal intervals over the continuous fill. Shimmer is preserved on the
//   filled portion; the ticks sit above as a thin divider overlay so the bar reads as a
//   discrete 10-step scale while retaining the continuous shimmer. This matches the
//   vertical fuse anatomy on Fintheon Mobile RiskFlow cards.
import { useEffect, useState, type CSSProperties } from "react";
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
  /** When true, the fill mounts at 0 and transitions to `value` on the next frame. */
  animateIn?: boolean;
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
  animateIn = false,
  className,
}: NothingFuseProps) {
  const resolvedColor =
    color ??
    (severity !== undefined
      ? colorForSeverity(severity, palette)
      : score !== undefined
        ? colorForScore(score, palette)
        : colorForSeverity("neutral", palette));

  // Mount-charge state — start at 0, flip to `value` on the next frame so
  // the CSS transition animates the fill from empty to target.
  const [charged, setCharged] = useState(!animateIn);
  useEffect(() => {
    if (!animateIn || charged) return;
    const raf = requestAnimationFrame(() => setCharged(true));
    return () => cancelAnimationFrame(raf);
  }, [animateIn, charged]);

  const clamped = Math.max(0, Math.min(1, charged ? value : 0));
  const pct = `${clamped * 100}%`;
  const isHorizontal = orientation === "horizontal";
  const incrementStroke =
    "var(--solvys-fuse-increment, var(--fintheon-bg, #050402))";

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
        transition: "width 520ms cubic-bezier(0.16, 0.8, 0.24, 1)",
      }
    : {
        width: "100%",
        height: pct,
        background: resolvedColor,
        position: "absolute",
        left: 0,
        bottom: 0,
        transition: "height 520ms cubic-bezier(0.16, 0.8, 0.24, 1)",
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
          background: incrementStroke,
          pointerEvents: "none",
        }
      : {
          position: "absolute",
          left: 0,
          right: 0,
          bottom: `${offsetPct}%`,
          height: 1,
          background: incrementStroke,
          pointerEvents: "none",
        };
    return <span key={i} style={tickStyle} aria-hidden />;
  });

  return (
    <div
      className={`relative rounded-[2px] bg-[var(--fintheon-surface)] overflow-hidden${className ? ` ${className}` : ""}`}
      style={trackStyle}
      data-solvys-fuse="true"
    >
      <div className="rounded-[2px]" style={fillStyle}>
        <span className="nothing-fuse-shimmer" aria-hidden />
      </div>
      {ticks}
    </div>
  );
}
