// [claude-code 2026-04-25] S42-T8: Nothing-design pass — replaced setInterval
//   step-walk with a WAAPI rotation. Eight NothingFuse-style segments arranged
//   on a tight disc; the whole disc rotates clockwise at 1200ms in discrete
//   steps so the lead segment walks segment-by-segment. No glow, no fade beyond
//   per-segment opacity. Outer bounding box stays at (2*size + gap) px to match
//   the prior 2x2-grid layout — callers like ThinkingIndicator depend on it.
// [claude-code 2026-04-15] T8: Nothing-style loading spinner
import { useEffect, useRef } from "react";

interface SegmentedSpinnerProps {
  /** Cell size in px. Default 8. Outer bounding box is (2*size + gap). */
  size?: number;
  /** Gap between cells in px. Default 2. Used to compute outer bounding box. */
  gap?: number;
}

const SEGMENT_COUNT = 8;
const ROTATION_PERIOD_MS = 1200;

export function SegmentedSpinner({
  size = 8,
  gap = 2,
}: SegmentedSpinnerProps) {
  const wheelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = wheelRef.current;
    if (!node) return;
    const reduced = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduced) return;
    const animation = node.animate(
      [{ transform: "rotate(0deg)" }, { transform: "rotate(360deg)" }],
      {
        duration: ROTATION_PERIOD_MS,
        iterations: Infinity,
        // steps() walks discretely segment-by-segment so the spinner reads as
        // a sequential clockwise fill rather than a smooth blur.
        easing: `steps(${SEGMENT_COUNT}, end)`,
      },
    );
    return () => animation.cancel();
  }, []);

  const diameter = size * 2 + gap;
  const radius = diameter / 2;
  const segLen = Math.max(2, Math.round(size * 0.7));
  const segWidth = Math.max(1, Math.round(size * 0.28));

  return (
    <div
      role="status"
      aria-label="Loading"
      style={{ width: diameter, height: diameter, position: "relative" }}
    >
      <div
        ref={wheelRef}
        style={{
          width: "100%",
          height: "100%",
          position: "relative",
          transformOrigin: "50% 50%",
        }}
      >
        {Array.from({ length: SEGMENT_COUNT }, (_, i) => {
          const angle = (360 / SEGMENT_COUNT) * i;
          const opacity = i === 0 ? 1 : i === 1 ? 0.5 : i === 2 ? 0.25 : 0.15;
          return (
            <span
              key={i}
              style={{
                position: "absolute",
                top: 0,
                left: "50%",
                width: segWidth,
                height: segLen,
                marginLeft: -segWidth / 2,
                background: "var(--text-display, #f0ead6)",
                opacity,
                transformOrigin: `${segWidth / 2}px ${radius}px`,
                transform: `rotate(${angle}deg)`,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
