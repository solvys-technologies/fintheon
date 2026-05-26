// [claude-code 2026-05-16] S68-T1: Theme status badge — Active=gold, Decaying=amber, Resolved=muted
import type { ThemeStatus } from "../../hooks/useThemes";

interface ThemeStatusBadgeProps {
  status: ThemeStatus;
}

const STATUS_COLORS: Record<ThemeStatus, string> = {
  Active: "var(--fintheon-accent)",
  Decaying: "var(--fintheon-bearish)",
  Resolved: "var(--fintheon-muted)",
};

const STATUS_LABELS: Record<ThemeStatus, string> = {
  Active: "Active",
  Decaying: "Decaying",
  Resolved: "Resolved",
};

export function ThemeStatusBadge({ status }: ThemeStatusBadgeProps) {
  const color = STATUS_COLORS[status];
  const dotColor =
    status === "Active"
      ? "var(--fintheon-accent)"
      : status === "Decaying"
        ? "#f59e0b"
        : "var(--fintheon-muted)";

  return (
    <span
      className="inline-flex items-center gap-1.5 text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5"
      style={{
        color,
        backgroundColor: `${color}10`,
        border: `1px solid ${color}20`,
      }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{
          backgroundColor: dotColor,
          ...(status === "Active"
            ? { animation: "pulse 2s ease-in-out infinite" }
            : {}),
        }}
      />
      {STATUS_LABELS[status]}
    </span>
  );
}
