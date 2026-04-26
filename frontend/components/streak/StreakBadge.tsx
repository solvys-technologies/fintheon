// [claude-code 2026-04-26] S45-T2: StreakBadge — Doto numeral, gold pulse on
//   milestone crossings (5/10/21/50). Detects milestone by watching the streak
//   count change and firing the pulse only when the new value HITS one of the
//   milestone numbers (i.e. green-day landed exactly on it). Reuses DigitGroup
//   so the count matches every other Doto count in the app.
import { useEffect, useRef, useState } from "react";
import { DigitGroup } from "../shared/DigitGroup";

const MILESTONES = [5, 10, 21, 50] as const;

interface StreakBadgeProps {
  /** Current green-day streak. */
  current: number;
  /** Numeral font size in px. Default 18. */
  fontSize?: number;
  className?: string;
}

export function StreakBadge({
  current,
  fontSize = 18,
  className,
}: StreakBadgeProps) {
  const previous = useRef<number | null>(null);
  const [pulsing, setPulsing] = useState(false);

  useEffect(() => {
    const prev = previous.current;
    previous.current = current;
    if (prev == null) return; // first paint: don't pulse
    if (current === prev) return;
    if (
      current > prev &&
      MILESTONES.includes(current as (typeof MILESTONES)[number])
    ) {
      setPulsing(true);
      const t = window.setTimeout(() => setPulsing(false), 1400);
      return () => window.clearTimeout(t);
    }
  }, [current]);

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
