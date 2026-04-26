// [claude-code 2026-04-25] S42-T8: Nothing-design pass — replaced the 8-segment
//   framer-motion radar with a single thin SVG line sweeping clockwise at 1500ms.
//   Driven by WAAPI (element.animate()) per the SVG-animation memory rule. No
//   trail, no fade, no glow. Caller API preserved (size, color).
// [claude-code 2026-04-16] Circular radar sweep spinner — Nothing Design
import { useEffect, useRef } from "react";

interface RadarSpinnerProps {
  size?: number;
  color?: string;
}

const SWEEP_PERIOD_MS = 1500;

export function RadarSpinner({
  size = 22,
  color = "var(--fintheon-accent, #c79f4a)",
}: RadarSpinnerProps) {
  const lineRef = useRef<SVGLineElement | null>(null);

  useEffect(() => {
    const node = lineRef.current;
    if (!node) return;
    const reduced = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduced) return;
    const animation = node.animate(
      [{ transform: "rotate(0deg)" }, { transform: "rotate(360deg)" }],
      { duration: SWEEP_PERIOD_MS, iterations: Infinity, easing: "linear" },
    );
    return () => animation.cancel();
  }, []);

  const half = size / 2;
  // Sweep line runs from centre to outer edge, leaving a small inset so it
  // doesn't kiss the container boundary.
  const inset = Math.max(1, Math.round(size * 0.08));
  const tip = half - inset;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="status"
      aria-label="Loading"
    >
      <line
        ref={lineRef}
        x1={half}
        y1={half}
        x2={half}
        y2={inset}
        stroke={color}
        strokeWidth={1.25}
        strokeLinecap="square"
        style={{ transformOrigin: `${half}px ${half}px` }}
      />
      <circle
        cx={half}
        cy={half}
        r={tip}
        fill="none"
        stroke={color}
        strokeWidth={0.75}
        opacity={0.25}
      />
    </svg>
  );
}
