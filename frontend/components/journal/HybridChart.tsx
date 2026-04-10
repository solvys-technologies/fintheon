// [claude-code 2026-03-16] T4: Dual-axis hybrid chart overlaying P&L ($) and ER (0-10)
import { useMemo } from "react";

interface HybridChartProps {
  pnlData: number[];
  erData: number[];
  width?: number;
  height?: number;
}

const PAD = { top: 16, right: 44, bottom: 24, left: 48 };

export function HybridChart({
  pnlData,
  erData,
  width = 440,
  height = 200,
}: HybridChartProps) {
  const chartW = width - PAD.left - PAD.right;
  const chartH = height - PAD.top - PAD.bottom;

  // Cumulative P&L
  const cumPnl = useMemo(() => {
    const out: number[] = [];
    let sum = 0;
    for (const v of pnlData) {
      sum += v;
      out.push(sum);
    }
    return out;
  }, [pnlData]);

  // Normalize ER scores to 0-10
  const erNorm = useMemo(
    () => erData.map((v) => Math.max(0, Math.min(10, 5 + v))),
    [erData],
  );

  const maxLen = Math.max(cumPnl.length, erNorm.length, 2);

  // P&L Y scale
  const pnlMin = cumPnl.length > 0 ? Math.min(0, ...cumPnl) * 1.1 : -100;
  const pnlMax = cumPnl.length > 0 ? Math.max(0, ...cumPnl) * 1.1 : 100;
  const pnlRange = pnlMax - pnlMin || 1;

  const toX = (i: number, len: number) =>
    PAD.left + (i / (len - 1 || 1)) * chartW;
  const toPnlY = (v: number) =>
    PAD.top + chartH - ((v - pnlMin) / pnlRange) * chartH;
  const toErY = (v: number) => PAD.top + chartH - (v / 10) * chartH;

  const pnlPoints = cumPnl
    .map((v, i) => `${toX(i, cumPnl.length)},${toPnlY(v)}`)
    .join(" ");
  const erPoints = erNorm
    .map((v, i) => `${toX(i, erNorm.length)},${toErY(v)}`)
    .join(" ");

  const formatDollar = (v: number) => {
    if (Math.abs(v) >= 1000) return `$${(v / 1000).toFixed(1)}k`;
    return `$${v.toFixed(0)}`;
  };

  // Grid lines for P&L (left axis)
  const pnlGrid = Array.from(
    { length: 5 },
    (_, i) => pnlMin + (pnlRange / 4) * i,
  );
  // Grid lines for ER (right axis)
  const erGrid = [0, 2.5, 5, 7.5, 10];

  return (
    <div className="bg-[var(--fintheon-surface)] border border-[var(--fintheon-accent)]/15 rounded-lg p-3">
      <div className="flex items-center gap-3 mb-1">
        <div className="text-[10px] text-[var(--fintheon-muted)]">
          Hybrid — P&amp;L + ER
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <span className="flex items-center gap-1 text-[9px] text-[var(--fintheon-accent)]">
            <span className="w-3 h-[2px] bg-[var(--fintheon-accent)] inline-block rounded" />{" "}
            P&amp;L
          </span>
          <span className="flex items-center gap-1 text-[9px] text-emerald-400">
            <span className="w-3 h-[2px] bg-emerald-400 inline-block rounded" />{" "}
            ER
          </span>
        </div>
      </div>
      <svg
        width={width}
        height={height}
        className="w-full"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
      >
        {/* P&L grid (left) */}
        {pnlGrid.map((v, i) => (
          <g key={`pnl-${i}`}>
            <line
              x1={PAD.left}
              y1={toPnlY(v)}
              x2={width - PAD.right}
              y2={toPnlY(v)}
              stroke="var(--fintheon-accent)"
              strokeOpacity={0.06}
              strokeDasharray="4 4"
            />
            <text
              x={PAD.left - 6}
              y={toPnlY(v)}
              textAnchor="end"
              dominantBaseline="central"
              fill="var(--fintheon-accent)"
              fontSize={7}
              fontFamily="monospace"
              opacity={0.6}
            >
              {formatDollar(v)}
            </text>
          </g>
        ))}

        {/* ER grid labels (right) */}
        {erGrid.map((v, i) => (
          <text
            key={`er-${i}`}
            x={width - PAD.right + 6}
            y={toErY(v)}
            textAnchor="start"
            dominantBaseline="central"
            fill="#34D399"
            fontSize={7}
            fontFamily="monospace"
            opacity={0.6}
          >
            {v}
          </text>
        ))}

        {/* P&L line */}
        {cumPnl.length >= 2 && (
          <polyline
            points={pnlPoints}
            fill="none"
            stroke="var(--fintheon-accent)"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}

        {/* ER line */}
        {erNorm.length >= 2 && (
          <polyline
            points={erPoints}
            fill="none"
            stroke="#34D399"
            strokeWidth={1.5}
            strokeLinejoin="round"
            strokeLinecap="round"
            strokeDasharray="6 3"
          />
        )}

        {/* Axis labels */}
        <text
          x={10}
          y={height / 2}
          textAnchor="middle"
          dominantBaseline="central"
          fill="var(--fintheon-accent)"
          fontSize={7}
          fontFamily="monospace"
          transform={`rotate(-90, 10, ${height / 2})`}
          opacity={0.7}
        >
          P&amp;L ($)
        </text>
        <text
          x={width - 6}
          y={height / 2}
          textAnchor="middle"
          dominantBaseline="central"
          fill="#34D399"
          fontSize={7}
          fontFamily="monospace"
          transform={`rotate(90, ${width - 6}, ${height / 2})`}
          opacity={0.7}
        >
          ER (0–10)
        </text>
      </svg>
    </div>
  );
}
