// [claude-code 2026-04-15] S19: KPI display card — Nothing design, Doto values, Space Mono labels
import { SegmentedBar } from "./SegmentedBar";

interface KPICardProps {
  label: string;
  value: string;
  /** Optional 0-100 value for segmented bar */
  barValue?: number;
  barColor?: string;
  /** Stale/unavailable state */
  stale?: boolean;
}

export function KPICard({
  label,
  value,
  barValue,
  barColor = "var(--accent)",
  stale,
}: KPICardProps) {
  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-data)",
          fontSize: 10,
          letterSpacing: "0.12em",
          color: "var(--text-secondary)",
          textTransform: "uppercase",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 24,
          lineHeight: 1.1,
          color: stale ? "var(--text-disabled)" : "var(--text-display)",
        }}
      >
        {stale ? "[--]" : value}
      </span>
      {barValue !== undefined && (
        <SegmentedBar
          value={stale ? 0 : barValue}
          segments={5}
          color={barColor}
          size="compact"
        />
      )}
    </div>
  );
}

interface KPIRowProps {
  children: React.ReactNode;
}

export function KPIRow({ children }: KPIRowProps) {
  return (
    <div
      style={{
        display: "flex",
        gap: 16,
        padding: "0 4px",
      }}
    >
      {children}
    </div>
  );
}
