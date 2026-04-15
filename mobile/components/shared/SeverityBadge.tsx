// [claude-code 2026-04-15] T5: Severity indicator chip — pill border in severity color
import { SEVERITY_CONFIG } from "@frontend/lib/severity-config";
import type { AlertSeverity } from "@frontend/lib/riskflow-feed";

interface SeverityBadgeProps {
  severity: AlertSeverity;
}

const SEVERITY_COLORS: Record<AlertSeverity, string> = {
  critical: "var(--fintheon-severe)",
  high: "var(--fintheon-severe)",
  medium: "var(--fintheon-neutral-severe)",
  low: "var(--fintheon-neutral)",
};

export function SeverityBadge({ severity }: SeverityBadgeProps) {
  const color = SEVERITY_COLORS[severity];
  const label = SEVERITY_CONFIG[severity].label;

  return (
    <span
      className="inline-flex items-center px-2 py-[2px] rounded-full"
      style={{
        fontFamily: "var(--font-data)",
        fontSize: "10px",
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        color,
        border: `1px solid ${color}`,
        lineHeight: 1.4,
      }}
    >
      {label}
    </span>
  );
}
