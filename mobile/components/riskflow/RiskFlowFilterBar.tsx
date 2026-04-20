// [claude-code 2026-04-15] Full-width segmented filter strip — Nothing design, edge-to-edge, no pills
// [claude-code 2026-04-19] Polish pass: tabs are now multi-select. Tap CRIT/HIGH/MED/LOW to
//   toggle each priority on or off independently; ALL clears the selection. Empty selection
//   keeps the ALL tab as the active visual. Selection persists via useRiskFlowFilters.
// [claude-code 2026-04-19] Source trigger added on the right edge — opens the
//   5-bucket bottom sheet. `sourceActive` drives the active visual when any
//   bucket is selected.
import type { AlertSeverity } from "@frontend/lib/riskflow-feed";

interface RiskFlowFilterBarProps {
  activeSeverities: Set<AlertSeverity>;
  onToggleSeverity: (level: AlertSeverity) => void;
  onClearSeverities: () => void;
  onOpenSourceSheet?: () => void;
  sourceActive?: boolean;
  counts: {
    all: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}

const LEVEL_TABS: { label: string; value: AlertSeverity }[] = [
  { label: "CRIT", value: "critical" },
  { label: "HIGH", value: "high" },
  { label: "MED", value: "medium" },
  { label: "LOW", value: "low" },
];

export function RiskFlowFilterBar({
  activeSeverities,
  onToggleSeverity,
  onClearSeverities,
  onOpenSourceSheet,
  sourceActive,
  counts,
}: RiskFlowFilterBarProps) {
  const allActive = activeSeverities.size === 0;

  return (
    <div
      style={{
        display: "flex",
        width: "100%",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <FilterTab
        label="ALL"
        count={counts.all}
        active={allActive}
        onClick={() => onClearSeverities()}
      />
      {LEVEL_TABS.map(({ label, value }) => (
        <FilterTab
          key={value}
          label={label}
          count={counts[value]}
          active={activeSeverities.has(value)}
          onClick={() => onToggleSeverity(value)}
        />
      ))}
      {onOpenSourceSheet && (
        <FilterTab
          label="SRC"
          active={Boolean(sourceActive)}
          onClick={onOpenSourceSheet}
        />
      )}
    </div>
  );
}

function FilterTab({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count?: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: 1,
        fontFamily: "var(--font-data)",
        fontSize: 11,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        color: active ? "var(--text-display)" : "var(--text-secondary)",
        background: active ? "var(--surface-raised)" : "transparent",
        border: "none",
        borderBottom: active
          ? "2px solid var(--text-display)"
          : "2px solid transparent",
        padding: "0 4px",
        minHeight: 44,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
        transition: "color 150ms, background 150ms, border-color 150ms",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      {label}
      {count != null && count > 0 && (
        <span
          style={{
            fontSize: 10,
            color: active ? "var(--text-primary)" : "var(--text-disabled)",
            fontFamily:
              "'Doto', 'Readable Digits', var(--font-data, monospace)",
            letterSpacing: "0.02em",
          }}
        >
          {count}
        </span>
      )}
    </button>
  );
}
