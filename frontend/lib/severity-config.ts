// [claude-code 2026-03-05] Shared severity config extracted from RiskFlowPanel
// [claude-code 2026-03-10] Added 'critical' entry for backend-sourced items (T3)
import type { AlertSeverity } from './riskflow-feed';

export const SEVERITY_CONFIG: Record<AlertSeverity, { label: string; bg: string; text: string; border: string; glow?: string }> = {
  critical: {
    label: 'CRIT',
    bg: 'bg-orange-500/20',
    text: 'text-orange-400',
    border: 'border-orange-500/50',
    glow: 'shadow-[0_0_10px_rgba(249,115,22,0.5)]',
  },
  high: {
    label: 'HIGH',
    bg: 'bg-red-500/20',
    text: 'text-red-400',
    border: 'border-red-500/40',
    glow: 'shadow-[0_0_8px_rgba(239,68,68,0.4)]',
  },
  medium: {
    label: 'MED',
    bg: 'bg-[var(--fintheon-accent)]/20',
    text: 'text-[var(--fintheon-accent)]',
    border: 'border-[var(--fintheon-accent)]/40',
  },
  low: {
    label: 'LOW',
    bg: 'bg-zinc-700/30',
    text: 'text-zinc-500',
    border: 'border-zinc-700/40',
  },
};
