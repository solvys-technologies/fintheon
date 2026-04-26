// [claude-code 2026-04-26] S45-T2: DriftIndicator — 6px dot in Strategium header.
//   4 visual states gated by useDriftStatus. Tooltip shows the Harper-voiced
//   message text. No animation for in-window / drift-alert; slow pulse on
//   tilt-stop and dead-volume.
import { useDriftStatus } from "../../hooks/useDriftStatus";
import type { DriftState } from "../../types/day-plan";

const DOT_SIZE = 6;

const STATE_STYLES: Record<
  DriftState,
  { color: string; pulse: boolean; label: string }
> = {
  "in-window": {
    color: "rgba(240, 234, 214, 0.3)",
    pulse: false,
    label: "In window",
  },
  "drift-alert": {
    color: "rgba(199, 159, 74, 0.85)",
    pulse: false,
    label: "Drift alert",
  },
  "tilt-stop": {
    color: "rgba(220, 80, 80, 0.95)",
    pulse: true,
    label: "Tilt stop",
  },
  "dead-volume": {
    color: "rgba(199, 159, 74, 0.95)",
    pulse: true,
    label: "Dead volume",
  },
};

interface DriftIndicatorProps {
  className?: string;
}

export function DriftIndicator({ className }: DriftIndicatorProps) {
  const { data, isLoading } = useDriftStatus();
  if (isLoading || !data) return null;
  const cfg = STATE_STYLES[data.state];
  if (!cfg) return null;

  return (
    <span
      className={className}
      title={data.message}
      aria-label={`${cfg.label} — ${data.message}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: DOT_SIZE + 6,
        height: DOT_SIZE + 6,
        position: "relative",
      }}
    >
      <span
        aria-hidden
        style={{
          width: DOT_SIZE,
          height: DOT_SIZE,
          borderRadius: "50%",
          background: cfg.color,
          animation: cfg.pulse
            ? "drift-pulse 1.8s ease-in-out infinite"
            : undefined,
          display: "inline-block",
        }}
      />
      <style>
        {`
          @keyframes drift-pulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50%      { opacity: 0.45; transform: scale(0.85); }
          }
        `}
      </style>
    </span>
  );
}
