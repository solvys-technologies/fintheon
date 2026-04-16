// [claude-code 2026-04-15] Full-width segmented filter strip — Nothing design, edge-to-edge, no pills
import type { AlertSeverity } from "@frontend/lib/riskflow-feed";

type SeverityFilter = "all" | AlertSeverity;

interface RiskFlowFilterBarProps {
  activeSeverity: SeverityFilter;
  onSeverityChange: (level: SeverityFilter) => void;
  counts: {
    all: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}

const CHIPS: { label: string; value: SeverityFilter }[] = [
  { label: "ALL", value: "all" },
  { label: "CRIT", value: "critical" },
  { label: "HIGH", value: "high" },
  { label: "MED", value: "medium" },
  { label: "LOW", value: "low" },
];

export function RiskFlowFilterBar({
  activeSeverity,
  onSeverityChange,
  counts,
}: RiskFlowFilterBarProps) {
  return (
    <div
      style={{
        display: "flex",
        width: "100%",
        borderBottom: "1px solid var(--border)",
      }}
    >
      {CHIPS.map(({ label, value }) => {
        const isActive = activeSeverity === value;
        const count = counts[value];
        return (
          <button
            key={value}
            type="button"
            onClick={() => onSeverityChange(value)}
            style={{
              flex: 1,
              fontFamily: "var(--font-data)",
              fontSize: 11,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: isActive ? "var(--text-display)" : "var(--text-secondary)",
              background: isActive ? "var(--surface-raised)" : "transparent",
              border: "none",
              borderBottom: isActive
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
            {count > 0 && (
              <span
                style={{
                  fontSize: 10,
                  color: isActive
                    ? "var(--text-primary)"
                    : "var(--text-disabled)",
                }}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
