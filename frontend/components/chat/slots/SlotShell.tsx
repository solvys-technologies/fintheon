// [claude-code 2026-04-23] S32-T5 streamdown + TV charts
// Shared visual shell for every chat slot. "Invisible panel" treatment per
// brief: dark alpha background, thin accent border, flat surfaces only.
// Row + column dividers use mask-image to produce fading edges.

import type { CSSProperties, ReactNode } from "react";

interface SlotShellProps {
  label?: string;
  children: ReactNode;
  style?: CSSProperties;
  muted?: boolean;
}

const SHELL: CSSProperties = {
  background: "rgba(10, 9, 5, 0.7)",
  border: "1px solid rgba(199, 159, 74, 0.15)",
  borderRadius: 10,
  padding: "10px 12px",
  margin: "8px 0",
  fontFamily: "var(--font-body, ui-sans-serif, system-ui)",
  color: "var(--fintheon-text, #f0ead6)",
};

const LABEL: CSSProperties = {
  fontFamily: "var(--font-data, ui-monospace, monospace)",
  fontSize: 9,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: "var(--fintheon-accent, #c79f4a)",
  marginBottom: 6,
  opacity: 0.85,
};

export function SlotShell({ label, children, style, muted }: SlotShellProps) {
  return (
    <div
      style={{
        ...SHELL,
        ...(muted ? { opacity: 0.55 } : null),
        ...style,
      }}
    >
      {label && <div style={LABEL}>{label}</div>}
      {children}
    </div>
  );
}

// Horizontal fading ruler (row divider). mask-image fades the edges so the
// divider reads as a whisper, never a hard line. No blur, no shadow.
export const FADING_RULE: CSSProperties = {
  height: 1,
  background: "rgba(199, 159, 74, 0.25)",
  maskImage:
    "linear-gradient(to right, transparent, black 10%, black 90%, transparent)",
  WebkitMaskImage:
    "linear-gradient(to right, transparent, black 10%, black 90%, transparent)",
  margin: "6px 0",
};

// Vertical fading ruler (column divider). Same mask trick, rotated axis.
export const FADING_RULE_V: CSSProperties = {
  width: 1,
  alignSelf: "stretch",
  background: "rgba(199, 159, 74, 0.25)",
  maskImage:
    "linear-gradient(to bottom, transparent, black 10%, black 90%, transparent)",
  WebkitMaskImage:
    "linear-gradient(to bottom, transparent, black 10%, black 90%, transparent)",
};

export function SlotSkeleton({
  label,
  lines = 2,
}: {
  label?: string;
  lines?: number;
}) {
  return (
    <SlotShell label={label} muted>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          style={{
            height: 10,
            marginBottom: 6,
            borderRadius: 4,
            background: "rgba(199, 159, 74, 0.1)",
            animation: "p 1.5s ease-in-out infinite",
            animationDelay: `${i * 120}ms`,
          }}
        />
      ))}
    </SlotShell>
  );
}

export function SlotError({
  label,
  reason,
}: {
  label?: string;
  reason: string;
}) {
  return (
    <SlotShell label={label ?? "slot error"}>
      <div
        style={{
          fontFamily: "var(--font-data, ui-monospace, monospace)",
          fontSize: 10,
          color: "rgba(216, 79, 79, 0.9)",
        }}
      >
        {reason}
      </div>
    </SlotShell>
  );
}

// Reveal helper: once a slot flips from pending→ok, children fade in over
// 200ms so the transition from skeleton is calm, not snappy.
export function SlotReveal({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        animation: "slotReveal 200ms ease-out",
      }}
    >
      {children}
    </div>
  );
}
