// [claude-code 2026-04-26] S45-T2: DriftIndicator — 6px dot in Strategium header.
//   4 visual states derived from DriftStatus = {inWindow, kind, ...}. Tooltip
//   shows the Harper-voiced message. No animation for in-window / drift_alert;
//   slow pulse on tilt_stop and dead_volume.
import { useDriftStatus } from "../../hooks/useDriftStatus";
import type { DriftKind } from "../../types/day-plan";

const DOT_SIZE = 6;

type DriftVisualState = "in-window" | DriftKind;

const STATE_STYLES: Record<
  DriftVisualState,
  { color: string; pulse: boolean; label: string }
> = {
  "in-window": {
    color: "rgba(240, 234, 214, 0.3)",
    pulse: false,
    label: "In window",
  },
  drift_alert: {
    color: "rgba(199, 159, 74, 0.85)",
    pulse: false,
    label: "Drift alert",
  },
  tilt_stop: {
    color: "rgba(220, 80, 80, 0.95)",
    pulse: true,
    label: "Tilt stop",
  },
  dead_volume: {
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

  const visual: DriftVisualState =
    data.kind ?? (data.inWindow ? "in-window" : "in-window");
  const cfg = STATE_STYLES[visual];
  if (!cfg) return null;
  const tooltip = data.message ?? cfg.label;

  return (
    <span
      className={className}
      title={tooltip}
      aria-label={`${cfg.label} — ${tooltip}`}
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
