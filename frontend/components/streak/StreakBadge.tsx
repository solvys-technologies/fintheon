// [claude-code 2026-04-26] S45-T2: StreakBadge — Doto numeral, gold pulse on
//   milestone crossings (5/10/21/50). Pulse uses solvys-transitions t-badge
//   keyframe on the inline ring. The numeral itself reuses DigitGroup so it
//   matches every other Doto count in the app (IV stack, RiskFlow card, etc.).
import { useEffect, useRef, useState } from "react";
import { DigitGroup } from "../shared/DigitGroup";

const MILESTONES = [5, 10, 21, 50] as const;

interface StreakBadgeProps {
  /** Current green-day streak. */
  current: number;
  /** Most recent milestone crossed — pulse fires when this changes. */
  lastMilestone?: number | null;
  /** Numeral font size in px. Default 18. */
  fontSize?: number;
  className?: string;
}

export function StreakBadge({
  current,
  lastMilestone = null,
  fontSize = 18,
  className,
}: StreakBadgeProps) {
  const previousMilestone = useRef<number | null>(lastMilestone);
  const [pulsing, setPulsing] = useState(false);

  useEffect(() => {
    if (lastMilestone == null) return;
    if (previousMilestone.current === lastMilestone) return;
    if (!MILESTONES.includes(lastMilestone as (typeof MILESTONES)[number])) {
      previousMilestone.current = lastMilestone;
      return;
    }
    previousMilestone.current = lastMilestone;
    setPulsing(true);
    const t = window.setTimeout(() => setPulsing(false), 1400);
    return () => window.clearTimeout(t);
  }, [lastMilestone]);

  return (
    <span
      className={
        className
          ? `inline-flex items-center gap-1.5 ${className}`
          : "inline-flex items-center gap-1.5"
      }
      style={{ position: "relative" }}
      aria-label={`Streak ${current}`}
    >
      {pulsing && (
        <span
          aria-hidden
          style={{
            position: "absolute",
            inset: -3,
            borderRadius: 6,
            boxShadow:
              "0 0 0 0 rgba(199, 159, 74, 0.55), 0 0 12px rgba(199, 159, 74, 0.35)",
            animation: "streak-milestone-pulse 1.2s ease-out forwards",
            pointerEvents: "none",
          }}
        />
      )}
      <span
        style={{
          fontSize: 9,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: "var(--fintheon-muted, #908774)",
          fontFamily: "var(--font-data, monospace)",
        }}
      >
        Streak
      </span>
      <DigitGroup
        value={String(current)}
        style={{
          fontFamily: "'Doto', 'Readable Digits', var(--font-data, monospace)",
          fontSize,
          fontWeight: 600,
          color: "var(--fintheon-accent, #c79f4a)",
          fontVariantNumeric: "tabular-nums",
          letterSpacing: "0.04em",
          lineHeight: 1,
        }}
      />
      <style>
        {`
          @keyframes streak-milestone-pulse {
            0%   { box-shadow: 0 0 0 0 rgba(199, 159, 74, 0.65), 0 0 0 rgba(199, 159, 74, 0); }
            55%  { box-shadow: 0 0 0 6px rgba(199, 159, 74, 0.0),  0 0 22px rgba(199, 159, 74, 0.55); }
            100% { box-shadow: 0 0 0 0 rgba(199, 159, 74, 0),     0 0 0 rgba(199, 159, 74, 0); }
          }
        `}
      </style>
    </span>
  );
}
