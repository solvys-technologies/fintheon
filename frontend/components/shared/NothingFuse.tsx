// [claude-code 2026-04-25] S42-T8: Nothing-design pass — drop the .nothing-fuse-shimmer
//   overlay, slow the fill transition from 520ms to 600ms ease-out, and document the
//   primitive contract in JSDoc so other tracks (T3 AgentActivityRail, T7 mount perf)
//   can adopt without touching internals. Segmented anatomy preserved: continuous fill
//   with N-1 perpendicular tick dividers cut into the bar so it reads as 10 discrete
//   steps. Severity-coloured fill stays (callers depend on it). No glow, no gradient,
//   no shimmer, no drop-shadow.
// [claude-code 2026-04-20] `animateIn` — when true, the fuse mounts at 0 and
//   transitions to `value` on the next frame, so new items arriving in the
//   feed visibly "charge up". Vertical orientation fills bottom-up (matches
//   the mobile segmented bar); horizontal fills left→right.
import { useEffect, useState, type CSSProperties } from "react";
import {
  type FusePalette,
  type FuseSeverity,
  colorForSeverity,
  colorForScore,
  DEFAULT_FUSE_PALETTE,
} from "../../lib/fuse-palette";

type Orientation = "horizontal" | "vertical";

/**
 * NothingFuse — Nothing-design segmented fuse bar.
 *
 * Used by activity rails (T3), RiskFlow cards, BlendedVIXCard, InstrumentFusesPanel,
 * NextSessionForecastCard, NarrativeCanvas IV displays, and any caller that needs a
 * thin "charging" indicator anchored to a 0-1 value.
 *
 * Visual contract:
 * - Filled portion: severity-resolved colour (defaults to accent #c79f4a via the
 *   shared fuse-palette). For non-severity callers the resolved colour is accent.
 * - Empty track: opaque `--fintheon-surface` so the segments read as cuts in solid
 *   material rather than painted-on lines.
 * - Tick dividers: N-1 thin perpendicular cuts coloured `--fintheon-bg`, giving the
 *   bar a discrete 10-step ruler look while the underlying fill stays continuous.
 * - Fill transition: 600ms ease-out — deliberate, not snappy. Animates whenever
 *   `value` changes (not just on mount).
 *
 * Banned ornaments (do not re-add): gradient fills, drop-shadow, inner glow,
 * shimmer overlays, AI-sparkle effects.
 *
 * Layout: `thickness` controls the cross-axis dimension; the long axis fills its
 * container (100%). Width/height props preserved for caller layout stability.
 */
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

const FILL_TRANSITION = "600ms cubic-bezier(0.16, 0.8, 0.24, 1)";

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

  const trackStyle: CSSProperties = isHorizontal
    ? { height: thickness, width: "100%" }
    : { width: thickness, height: "100%" };

  // Animate value changes deliberately (600ms), not just first mount.
  const fillStyle: CSSProperties = isHorizontal
    ? {
        width: pct,
        height: "100%",
        background: resolvedColor,
        position: "absolute",
        left: 0,
        top: 0,
        transition: `width ${FILL_TRANSITION}`,
      }
    : {
        width: "100%",
        height: pct,
        background: resolvedColor,
        position: "absolute",
        left: 0,
        bottom: 0,
        transition: `height ${FILL_TRANSITION}`,
      };

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
      <div className="rounded-[2px]" style={fillStyle} />
      {ticks}
    </div>
  );
}
