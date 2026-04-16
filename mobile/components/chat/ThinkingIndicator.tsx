// [claude-code 2026-04-15] Nothing-styled thinking indicator — segmented spinner + rotating phrases
import { useState, useEffect } from "react";
import { SegmentedSpinner } from "../shared/SegmentedSpinner";

const THINKING_PHRASES = [
  "Surveying the arena...",
  "Running risk models...",
  "Reviewing the legion's positions...",
  "Consulting the Consilium...",
  "Analyzing macro data...",
  "Checking volatility surface...",
  "Evaluating sentiment...",
  "Processing market signals...",
  "Cross-referencing events...",
  "Calculating exposure...",
  "Mapping liquidity pockets...",
  "Tracking implied vol drift...",
  "Pricing catalyst risk...",
  "Calibrating entry zones...",
  "Stress-testing conviction...",
];

interface ThinkingIndicatorProps {
  isThinking: boolean;
}

export function ThinkingIndicator({ isThinking }: ThinkingIndicatorProps) {
  const [phrase, setPhrase] = useState(THINKING_PHRASES[0]);

  useEffect(() => {
    if (!isThinking) return;
    let idx = 0;
    setPhrase(THINKING_PHRASES[0]);
    const interval = setInterval(() => {
      idx = (idx + 1) % THINKING_PHRASES.length;
      setPhrase(THINKING_PHRASES[idx]);
    }, 2000);
    return () => clearInterval(interval);
  }, [isThinking]);

  if (!isThinking) return null;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 16px",
      }}
    >
      <SegmentedSpinner size={6} gap={2} />
      <span
        style={{
          fontFamily: "var(--font-data)",
          fontSize: 11,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "var(--text-secondary)",
        }}
      >
        {phrase}
      </span>
    </div>
  );
}
