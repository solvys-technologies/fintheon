// [claude-code 2026-03-16] T4: SVG ER trend line chart — replaces sparkline in HumanPsychTab
import { useMemo } from 'react';

interface ERTrendChartProps {
  /** ER scores over time (oldest first), range roughly -5 to +5 mapped to 0-10 */
  data: number[];
  width?: number;
  height?: number;
}

const PAD = { top: 16, right: 12, bottom: 24, left: 36 };

export function ERTrendChart({ data, width = 440, height = 200 }: ERTrendChartProps) {
  const hasData = data.length >= 2;
  const chartW = width - PAD.left - PAD.right;
  const chartH = height - PAD.top - PAD.bottom;

  // Normalize raw ER scores (-5..+5) into 0..10 display range
  const normalized = useMemo(
    () => data.map(v => Math.max(0, Math.min(10, 5 + v))),
    [data],
  );

  const { points, areaPoints, gridLines } = useMemo(() => {
    if (!hasData) return { points: '', areaPoints: '', gridLines: [] as number[] };

    const toX = (i: number) => PAD.left + (i / (normalized.length - 1)) * chartW;
    const toY = (v: number) => PAD.top + chartH - (v / 10) * chartH;

    const pts = normalized.map((v, i) => `${toX(i)},${toY(v)}`).join(' ');

    // Area fill under the line
    const bottomY = PAD.top + chartH;
    const area =
      `${PAD.left},${bottomY} ` +
      normalized.map((v, i) => `${toX(i)},${toY(v)}`).join(' ') +
      ` ${toX(normalized.length - 1)},${bottomY}`;

    // Grid at 0, 2.5, 5, 7.5, 10
    const lines = [0, 2.5, 5, 7.5, 10];

    return { points: pts, areaPoints: area, gridLines: lines };
  }, [normalized, hasData, chartW, chartH]);

  const toY = (v: number) => PAD.top + chartH - (v / 10) * chartH;

  // Color: green if latest above 5, red if below 3, accent otherwise
  const latest = normalized.length > 0 ? normalized[normalized.length - 1] : 5;
  const lineColor = latest >= 6 ? '#34D399' : latest <= 3 ? '#EF4444' : 'var(--fintheon-accent)';

  return (
    <div className="bg-[var(--fintheon-surface)] border border-[var(--fintheon-accent)]/15 rounded-lg p-3">
      <div className="text-[10px] text-[var(--fintheon-muted)] mb-1">ER Trend (0–10)</div>
      <svg
        width={width}
        height={height}
        className="w-full"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Grid */}
        {gridLines.map((v, i) => (
          <g key={i}>
            <line
              x1={PAD.left}
              y1={toY(v)}
              x2={width - PAD.right}
              y2={toY(v)}
              stroke="var(--fintheon-accent)"
              strokeOpacity={0.08}
              strokeDasharray="4 4"
            />
            <text
              x={PAD.left - 6}
              y={toY(v)}
              textAnchor="end"
              dominantBaseline="central"
              fill="var(--fintheon-muted)"
              fontSize={8}
              fontFamily="monospace"
            >
              {v}
            </text>
          </g>
        ))}

        {/* Midline (5 = neutral) */}
        <line
          x1={PAD.left}
          y1={toY(5)}
          x2={width - PAD.right}
          y2={toY(5)}
          stroke="var(--fintheon-muted)"
          strokeOpacity={0.25}
          strokeWidth={0.5}
        />

        {hasData ? (
          <>
            {/* Area fill */}
            <polygon points={areaPoints} fill={lineColor} fillOpacity={0.06} />
            {/* Line */}
            <polyline
              points={points}
              fill="none"
              stroke={lineColor}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </>
        ) : (
          <line
            x1={PAD.left}
            y1={toY(5)}
            x2={width - PAD.right}
            y2={toY(5)}
            stroke="var(--fintheon-muted)"
            strokeOpacity={0.3}
            strokeDasharray="6 4"
          />
        )}

        {/* Y-axis label */}
        <text
          x={8}
          y={height / 2}
          textAnchor="middle"
          dominantBaseline="central"
          fill="var(--fintheon-muted)"
          fontSize={8}
          fontFamily="monospace"
          transform={`rotate(-90, 8, ${height / 2})`}
        >
          ER (0–10)
        </text>
      </svg>
    </div>
  );
}
