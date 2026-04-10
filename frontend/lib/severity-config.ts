// [claude-code 2026-03-05] Shared severity config extracted from RiskFlowPanel
// [claude-code 2026-03-10] Added 'critical' entry for backend-sourced items (T3)
// [claude-code 2026-03-26] Linked severity colors to user theme customization via CSS vars
import type { AlertSeverity } from "./riskflow-feed";

export const SEVERITY_CONFIG: Record<
  AlertSeverity,
  { label: string; bg: string; text: string; border: string; glow?: string }
> = {
  critical: {
    label: "CRIT",
    bg: "bg-[var(--fintheon-severe)]/20",
    text: "text-[var(--fintheon-severe)]",
    border: "border-[var(--fintheon-severe)]/50",
    glow: "shadow-[0_0_10px_color-mix(in_srgb,var(--fintheon-severe)_50%,transparent)]",
  },
  high: {
    label: "HIGH",
    bg: "bg-[var(--fintheon-severe)]/20",
    text: "text-[var(--fintheon-severe)]",
    border: "border-[var(--fintheon-severe)]/40",
    glow: "shadow-[0_0_8px_color-mix(in_srgb,var(--fintheon-severe)_40%,transparent)]",
  },
  medium: {
    label: "MED",
    bg: "bg-[var(--fintheon-neutral-severe)]/20",
    text: "text-[var(--fintheon-neutral-severe)]",
    border: "border-[var(--fintheon-neutral-severe)]/40",
  },
  low: {
    label: "LOW",
    bg: "bg-[var(--fintheon-neutral)]/30",
    text: "text-[var(--fintheon-neutral)]",
    border: "border-[var(--fintheon-neutral)]/40",
  },
};
