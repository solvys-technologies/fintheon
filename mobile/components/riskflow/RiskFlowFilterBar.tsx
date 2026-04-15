// [claude-code 2026-04-15] T5: Horizontal pill filter bar — severity chips, Space Mono ALL CAPS
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
      className="flex gap-2 px-4 py-3 overflow-x-auto"
      style={{ WebkitOverflowScrolling: "touch" }}
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
              fontFamily: "var(--font-data)",
              fontSize: "11px",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: isActive ? "var(--text-display)" : "var(--text-secondary)",
              border: `1px solid ${isActive ? "var(--text-display)" : "var(--border-visible)"}`,
              borderRadius: "999px",
              padding: "6px 14px",
              background: "transparent",
              whiteSpace: "nowrap",
              cursor: "pointer",
              minHeight: "44px",
              display: "flex",
              alignItems: "center",
              gap: "4px",
              transition: "color 150ms, border-color 150ms",
            }}
          >
            {label}
            {count > 0 && (
              <span
                style={{
                  color: isActive
                    ? "var(--text-primary)"
                    : "var(--text-disabled)",
                  fontSize: "10px",
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
