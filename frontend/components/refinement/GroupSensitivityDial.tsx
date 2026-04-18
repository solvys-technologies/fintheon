// [claude-code 2026-04-18] S24-T4: Group-sensitivity dial — 5 replace 40 sliders
import type { ChangeEvent } from "react";

export type SensitivityGroup =
  | "macro"
  | "geopolitical"
  | "corporate"
  | "technical"
  | "speaker";

export interface SensitivityValues {
  macro: number;
  geopolitical: number;
  corporate: number;
  technical: number;
  speaker: number;
}

export const SENSITIVITY_DEFAULTS: SensitivityValues = {
  macro: 0,
  geopolitical: 0,
  corporate: 0,
  technical: 0,
  speaker: 0,
};

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

export function GroupSensitivityDial({
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
  const handle = (e: ChangeEvent<HTMLInputElement>) => {
    const next = Number(e.target.value);
    onChange(group, next);
  };

  const percent = Math.round(((value + 1) / 2) * 100);
  const isNeutral = Math.abs(value) < 0.05;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        padding: "8px 0",
        opacity: disabled ? 0.55 : 1,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
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
        <span
          style={{
            fontFamily: "var(--font-data)",
            fontSize: 10,
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
      <div style={{ position: "relative" }}>
        <input
          type="range"
          min="-1"
          max="1"
          step="0.05"
          value={value}
          onChange={handle}
          disabled={disabled}
          aria-label={`${GROUP_LABELS[group]} sensitivity`}
          style={{
            width: "100%",
            accentColor: "var(--fintheon-accent)",
            cursor: disabled ? "not-allowed" : "pointer",
          }}
        />
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            top: "50%",
            left: `${percent}%`,
            transform: "translate(-50%, -50%)",
            width: 2,
            height: 10,
            background: "var(--fintheon-accent)",
            pointerEvents: "none",
            opacity: isNeutral ? 0 : 0.4,
          }}
        />
      </div>
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
