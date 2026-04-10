// [claude-code 2026-03-16] T4: KPI card with mini pie chart for journal dashboard
import type { ReactNode } from "react";

interface PieData {
  value: number;
  max: number;
}

interface KPICardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  pieData?: PieData;
  accentColor?: string;
}

function MiniPie({ value, max, color }: PieData & { color: string }) {
  const pct = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  const r = 16;
  const circumference = 2 * Math.PI * r;
  const dashLen = pct * circumference;

  return (
    <svg width={40} height={40} viewBox="0 0 40 40" className="flex-shrink-0">
      {/* Background ring */}
      <circle
        cx={20}
        cy={20}
        r={r}
        fill="none"
        stroke="var(--fintheon-accent)"
        strokeOpacity={0.1}
        strokeWidth={4}
      />
      {/* Value ring */}
      <circle
        cx={20}
        cy={20}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={4}
        strokeDasharray={`${dashLen} ${circumference - dashLen}`}
        strokeDashoffset={circumference * 0.25}
        strokeLinecap="round"
        className="transition-all duration-700"
      />
      {/* Center text */}
      <text
        x={20}
        y={20}
        textAnchor="middle"
        dominantBaseline="central"
        fill={color}
        fontSize={9}
        fontFamily="monospace"
        fontWeight={600}
      >
        {Math.round(pct * 100)}
      </text>
    </svg>
  );
}

export function KPICard({
  label,
  value,
  subtitle,
  pieData,
  accentColor,
}: KPICardProps) {
  const color = accentColor || "var(--fintheon-text)";

  return (
    <div className="bg-[var(--fintheon-surface)] border border-[var(--fintheon-accent)]/15 rounded-lg p-3 flex items-center justify-between gap-2 min-w-0">
      {/* Left: text */}
      <div className="min-w-0 flex-1">
        <div className="text-[10px] text-[var(--fintheon-muted)] truncate">
          {label}
        </div>
        <div
          className="text-lg font-bold font-mono mt-0.5 truncate"
          style={{ color }}
        >
          {value}
        </div>
        {subtitle && (
          <div className="text-[9px] text-[var(--fintheon-muted)] truncate mt-0.5">
            {subtitle}
          </div>
        )}
      </div>

      {/* Right: mini pie */}
      {pieData && (
        <MiniPie value={pieData.value} max={pieData.max} color={color} />
      )}
    </div>
  );
}
