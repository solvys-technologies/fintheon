// [claude-code 2026-04-18] v5.22 shared contract — mobile mirror of frontend/lib/fuse-palette.ts
// Kept in sync manually until we can set up a shared workspace package. Any edit here must mirror
// the frontend module byte-for-byte (minus this header) so both platforms render fuses identically.

export type FuseSeverity = "critical" | "high" | "medium" | "low" | "neutral";
export type FusePriority = "p0" | "p1" | "p2" | "p3";

export interface FuseThresholds {
  critical: number;
  high: number;
  medium: number;
  low: number;
}

export interface FusePalette {
  severity: Record<FuseSeverity, string>;
  priority: Record<FusePriority, string>;
  thresholds: FuseThresholds;
}

export const DEFAULT_FUSE_PALETTE: FusePalette = {
  severity: {
    critical: "var(--fintheon-severe, #d84f4f)",
    high: "var(--fintheon-high, #f0b055)",
    medium: "var(--fintheon-accent, #c79f4a)",
    low: "var(--fintheon-low, #b8b09c)",
    neutral: "var(--fintheon-muted, #6b6b6b)",
  },
  priority: {
    p0: "var(--fintheon-severe, #d84f4f)",
    p1: "var(--fintheon-high, #f0b055)",
    p2: "var(--fintheon-accent, #c79f4a)",
    p3: "var(--fintheon-low, #b8b09c)",
  },
  thresholds: { critical: 8, high: 6, medium: 4, low: 2 },
};

export function severityFromScore(
  score: number,
  palette: FusePalette = DEFAULT_FUSE_PALETTE,
): FuseSeverity {
  const t = palette.thresholds;
  if (score >= t.critical) return "critical";
  if (score >= t.high) return "high";
  if (score >= t.medium) return "medium";
  if (score >= t.low) return "low";
  return "neutral";
}

export function colorForSeverity(
  sev: FuseSeverity,
  palette: FusePalette = DEFAULT_FUSE_PALETTE,
): string {
  return palette.severity[sev];
}

export function colorForPriority(
  pri: FusePriority,
  palette: FusePalette = DEFAULT_FUSE_PALETTE,
): string {
  return palette.priority[pri];
}

export function colorForScore(
  score: number,
  palette: FusePalette = DEFAULT_FUSE_PALETTE,
): string {
  return colorForSeverity(severityFromScore(score, palette), palette);
}
