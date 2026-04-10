// [claude-code 2026-03-16] T4: SVG P&L line chart for journal dashboard — last 30 days cumulative
import { useMemo } from "react";

interface PnLChartProps {
  /** Array of daily P&L values (oldest first) */
  data: number[];
  /** Chart width */
  width?: number;
  /** Chart height */
  height?: number;
}

const PAD = { top: 16, right: 12, bottom: 24, left: 48 };

export function PnLChart({ data, width = 440, height = 200 }: PnLChartProps) {
  const cumulative = useMemo(() => {
    const out: number[] = [];
    let sum = 0;
    for (const v of data) {
      sum += v;
      out.push(sum);
    }
    return out;
  }, [data]);

  const hasData = cumulative.length >= 2;

  const chartW = width - PAD.left - PAD.right;
  const chartH = height - PAD.top - PAD.bottom;

  const { min, max, points, zeroY, gridLines } = useMemo(() => {
    if (!hasData) {
      return {
        min: -100,
        max: 100,
        points: "",
        zeroY: chartH / 2,
        gridLines: [] as number[],
      };
    }
    let lo = Math.min(0, ...cumulative);
    let hi = Math.max(0, ...cumulative);
    const range = hi - lo || 1;
    // Pad Y range by 10%
    lo -= range * 0.1;
    hi += range * 0.1;
    const totalRange = hi - lo;

    const toY = (v: number) =>
      PAD.top + chartH - ((v - lo) / totalRange) * chartH;

    const pts = cumulative
      .map((v, i) => {
        const x = PAD.left + (i / (cumulative.length - 1)) * chartW;
        const y = toY(v);
        return `${x},${y}`;
      })
      .join(" ");

    // Grid lines: ~4 evenly spaced
    const step = totalRange / 4;
    const lines: number[] = [];
    for (let i = 0; i <= 4; i++) {
      lines.push(lo + step * i);
    }

    return { min: lo, max: hi, points: pts, zeroY: toY(0), gridLines: lines };
  }, [cumulative, hasData, chartW, chartH]);

  const toY = (v: number) => {
    const totalRange = max - min || 1;
    return PAD.top + chartH - ((v - min) / totalRange) * chartH;
  };

  const formatDollar = (v: number) => {
    if (Math.abs(v) >= 1000) return `$${(v / 1000).toFixed(1)}k`;
    return `$${v.toFixed(0)}`;
  };

  return (
    <div className="bg-[var(--fintheon-surface)] border border-[var(--fintheon-accent)]/15 rounded-lg p-3">
      <div className="text-[10px] text-[var(--fintheon-muted)] mb-1">
        P&amp;L ($) — Last 30 Days
      </div>
      <svg
        width={width}
        height={height}
        className="w-full"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Grid lines */}
        {gridLines.map((v, i) => {
          const y = toY(v);
          return (
            <g key={i}>
              <line
                x1={PAD.left}
                y1={y}
                x2={width - PAD.right}
                y2={y}
                stroke="var(--fintheon-accent)"
                strokeOpacity={0.08}
                strokeDasharray="4 4"
              />
              <text
                x={PAD.left - 6}
                y={y}
                textAnchor="end"
                dominantBaseline="central"
                fill="var(--fintheon-muted)"
                fontSize={8}
                fontFamily="monospace"
              >
                {formatDollar(v)}
              </text>
            </g>
          );
        })}

        {/* Zero line */}
        {hasData && (
          <line
            x1={PAD.left}
            y1={zeroY}
            x2={width - PAD.right}
            y2={zeroY}
            stroke="var(--fintheon-muted)"
            strokeOpacity={0.25}
            strokeWidth={0.5}
          />
        )}

        {/* Data line or placeholder */}
        {hasData ? (
          <polyline
            points={points}
            fill="none"
            stroke="var(--fintheon-accent)"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ) : (
          <line
            x1={PAD.left}
            y1={height / 2}
            x2={width - PAD.right}
            y2={height / 2}
            stroke="var(--fintheon-muted)"
            strokeOpacity={0.3}
            strokeDasharray="6 4"
          />
        )}

        {/* Y-axis label */}
        <text
          x={10}
          y={height / 2}
          textAnchor="middle"
          dominantBaseline="central"
          fill="var(--fintheon-muted)"
          fontSize={8}
          fontFamily="monospace"
          transform={`rotate(-90, 10, ${height / 2})`}
        >
          P&amp;L ($)
        </text>
      </svg>
    </div>
  );
}
