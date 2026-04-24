// [claude-code 2026-04-24] S34-T2: NotchedFuse — vertical-ruler fuse, swap-in for GroupSensitivityDial. Same -1..+1 contract; Doto readout; flat panel + accent border, no glass / no gradient.
import {
  useCallback,
  useRef,
  type ChangeEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { SensitivityGroup } from "./GroupSensitivityDial";

const GROUP_LABELS: Record<SensitivityGroup, string> = {
  macro: "Macro",
  geopolitical: "Geopolitical",
  corporate: "Corporate",
  technical: "Technical",
  speaker: "Speaker",
};

const GROUP_HINTS: Record<SensitivityGroup, string> = {
  macro: "CPI, NFP, FOMC, GDP",
  geopolitical: "Geo events, conflicts, sanctions",
  corporate: "Earnings, M&A, downgrades",
  technical: "Breakouts, levels, flows",
  speaker: "Powell, Trump, Bessent, etc.",
};

function tierLabel(value: number): string {
  if (value <= -0.66) return "Conservative";
  if (value <= -0.15) return "Cautious";
  if (value <= 0.15) return "Neutral";
  if (value <= 0.66) return "Responsive";
  return "Aggressive";
}

const MAJOR_TICKS = [0, 25, 50, 75, 100];
const MINOR_TICKS = [10, 20, 30, 40, 60, 70, 80, 90];

export function NotchedFuse({
  group,
  value,
  onChange,
  disabled,
}: {
  group: SensitivityGroup;
  value: number;
  onChange: (group: SensitivityGroup, value: number) => void;
  disabled?: boolean;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const percent = ((value + 1) / 2) * 100;
  const isNeutral = Math.abs(value) < 0.05;

  const setFromPointer = useCallback(
    (clientX: number) => {
      const el = trackRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const ratio = Math.max(
        0,
        Math.min(1, (clientX - rect.left) / rect.width),
      );
      const next = Math.round((ratio * 2 - 1) * 20) / 20;
      onChange(group, next);
    },
    [group, onChange],
  );

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (disabled) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      setFromPointer(e.clientX);
    },
    [disabled, setFromPointer],
  );

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (disabled) return;
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        setFromPointer(e.clientX);
      }
    },
    [disabled, setFromPointer],
  );

  const handleRange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      onChange(group, Number(e.target.value));
    },
    [group, onChange],
  );

  const readoutValue = value > 0 ? `+${value.toFixed(2)}` : value.toFixed(2);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        padding: "10px 0",
        opacity: disabled ? 0.55 : 1,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 1,
            minWidth: 0,
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 12,
              fontWeight: 600,
              color: "var(--fintheon-text)",
              letterSpacing: "0.02em",
            }}
          >
            {GROUP_LABELS[group]}
          </span>
          <span
            style={{
              fontFamily: "var(--font-data)",
              fontSize: 9,
              color: "var(--fintheon-muted)",
              letterSpacing: "0.04em",
            }}
          >
            {GROUP_HINTS[group]}
          </span>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            gap: 1,
          }}
        >
          <span
            style={{
              fontFamily: "Doto, var(--font-data)",
              fontVariationSettings: "'wght' 600",
              fontSize: 18,
              lineHeight: 1,
              letterSpacing: "0.04em",
              color: isNeutral
                ? "var(--fintheon-muted)"
                : "var(--fintheon-accent)",
            }}
          >
            {readoutValue}
          </span>
          <span
            style={{
              fontFamily: "var(--font-data)",
              fontSize: 9,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: isNeutral
                ? "var(--fintheon-muted)"
                : "var(--fintheon-accent)",
            }}
          >
            {tierLabel(value)}
          </span>
        </div>
      </div>

      <div
        ref={trackRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        role="presentation"
        style={{
          position: "relative",
          height: 32,
          border: "1px solid var(--fintheon-accent)",
          background: "var(--fintheon-bg)",
          cursor: disabled ? "not-allowed" : "pointer",
          touchAction: "none",
        }}
      >
        {MINOR_TICKS.map((p) => (
          <div
            key={`min-${p}`}
            aria-hidden
            style={{
              position: "absolute",
              left: `${p}%`,
              top: 6,
              bottom: 6,
              width: 1,
              transform: "translateX(-0.5px)",
              background: "var(--fintheon-accent)",
              opacity: 0.12,
              pointerEvents: "none",
            }}
          />
        ))}
        {MAJOR_TICKS.map((p) => (
          <div
            key={`maj-${p}`}
            aria-hidden
            style={{
              position: "absolute",
              left: `${p}%`,
              top: 0,
              bottom: 0,
              width: 1,
              transform: "translateX(-0.5px)",
              background: "var(--fintheon-accent)",
              opacity: 0.45,
              pointerEvents: "none",
            }}
          />
        ))}
        <div
          aria-hidden
          style={{
            position: "absolute",
            left: "50%",
            top: -2,
            bottom: -2,
            width: 1,
            transform: "translateX(-0.5px)",
            background: "var(--fintheon-accent)",
            opacity: 0.7,
            pointerEvents: "none",
          }}
        />
        <div
          aria-hidden
          style={{
            position: "absolute",
            left: `${percent}%`,
            top: -3,
            bottom: -3,
            width: 3,
            transform: "translateX(-1.5px)",
            background: isNeutral
              ? "var(--fintheon-muted)"
              : "var(--fintheon-accent)",
            pointerEvents: "none",
            transition: "left 90ms linear",
          }}
        />
      </div>

      <input
        type="range"
        min="-1"
        max="1"
        step="0.05"
        value={value}
        onChange={handleRange}
        disabled={disabled}
        aria-label={`${GROUP_LABELS[group]} sensitivity`}
        style={{
          position: "absolute",
          width: 1,
          height: 1,
          padding: 0,
          margin: -1,
          overflow: "hidden",
          clip: "rect(0,0,0,0)",
          whiteSpace: "nowrap",
          border: 0,
        }}
      />

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontFamily: "var(--font-data)",
          fontSize: 9,
          color: "var(--fintheon-muted)",
          letterSpacing: "0.06em",
          textTransform: "uppercase",
        }}
      >
        <span>−1.0</span>
        <span>0</span>
        <span>+1.0</span>
      </div>
    </div>
  );
}
