// [claude-code 2026-05-16] S68-T2: Drift bubble — color-coded, confidence-sized,
// pulse on high magnitude, tooltip on hover.

import { useState, useRef } from "react";

export interface DriftBubbleData {
  magnitude: number;
  direction: "positive" | "negative" | "neutral";
  confidence: number;
}

const DIRECTION_COLORS: Record<string, string> = {
  positive: "#c79f4a",
  negative: "#ef4444",
  neutral: "#6b7280",
};

const DIRECTION_LABELS: Record<string, string> = {
  positive: "Positive Drift",
  negative: "Negative Drift",
  neutral: "Neutral",
};

function clampRadius(magnitude: number): number {
  return Math.min(Math.max(magnitude * 12, 4), 12);
}

interface DriftBubbleProps {
  drift: DriftBubbleData;
  size?: "sm" | "md";
}

export default function DriftBubble({ drift, size = "md" }: DriftBubbleProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const color = DIRECTION_COLORS[drift.direction];
  const radius =
    size === "sm"
      ? clampRadius(drift.magnitude) * 0.6
      : clampRadius(drift.magnitude);
  const label = DIRECTION_LABELS[drift.direction];

  function handleEnter() {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setShowTooltip(true);
  }

  function handleLeave() {
    timeoutRef.current = setTimeout(() => setShowTooltip(false), 150);
  }

  return (
    <span
      className="relative inline-flex items-center"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      <span
        className="rounded-full"
        style={{
          width: radius * 2,
          height: radius * 2,
          backgroundColor: color,
          opacity: 0.4 + drift.confidence * 0.6,
          animation:
            drift.magnitude > 0.5
              ? "drift-pulse 2s ease-in-out infinite"
              : undefined,
        }}
      />
      {showTooltip && (
        <span
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-50 whitespace-nowrap rounded px-2 py-1 text-[10px] font-medium leading-tight"
          style={{
            backgroundColor: "rgba(5,4,2,0.95)",
            color: "var(--fintheon-text, #f0ead6)",
            border: "1px solid rgba(199,159,74,0.25)",
          }}
        >
          {label}
          <br />
          Mag: {(drift.magnitude * 100).toFixed(0)}% &middot; Conf:{" "}
          {(drift.confidence * 100).toFixed(0)}%
        </span>
      )}
    </span>
  );
}
