// [claude-code 2026-03-20] 8f: Bloomberg-style P&L chart — gold gradient line, trade dots, volume bars
import { useMemo, useState, useRef, useCallback } from 'react';

export type ChartPeriod = '7D' | '30D' | '90D' | 'YTD' | 'ALL';
export type ChartMetric = 'pnl' | 'winrate' | 'rr';

interface TradePoint {
  date: string;
  pnl: number;
  isWin: boolean;
  volume?: number;
}

interface BloombergChartProps {
  data: number[];
  trades?: TradePoint[];
  period: ChartPeriod;
  metric: ChartMetric;
  onPeriodChange: (p: ChartPeriod) => void;
  onMetricChange: (m: ChartMetric) => void;
}

const PAD = { top: 12, right: 12, bottom: 32, left: 52 };
const VOLUME_HEIGHT = 28;

export function BloombergChart({
  data,
  trades,
  period,
  metric,
  onPeriodChange,
  onMetricChange,
}: BloombergChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);

  // Cumulative P&L
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

  // We use percentages for responsive sizing via viewBox
  const W = 600;
  const H = 240;
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom - VOLUME_HEIGHT;

  const { pnlMin, pnlMax, pnlRange, toX, toPnlY, gridLines } = useMemo(() => {
    if (!hasData) {
      return {
        pnlMin: -100,
        pnlMax: 100,
        pnlRange: 200,
        toX: () => PAD.left,
        toPnlY: () => H / 2,
        gridLines: [] as number[],
      };
    }
    let lo = Math.min(0, ...cumulative);
    let hi = Math.max(0, ...cumulative);
    const range = hi - lo || 1;
    lo -= range * 0.12;
    hi += range * 0.12;
    const total = hi - lo;

    const toX_ = (i: number) => PAD.left + (i / (cumulative.length - 1)) * chartW;
    const toPnlY_ = (v: number) => PAD.top + chartH - ((v - lo) / total) * chartH;

    const step = total / 4;
    const lines: number[] = [];
    for (let i = 0; i <= 4; i++) lines.push(lo + step * i);

    return { pnlMin: lo, pnlMax: hi, pnlRange: total, toX: toX_, toPnlY: toPnlY_, gridLines: lines };
  }, [cumulative, hasData, chartW, chartH]);

  const zeroY = hasData ? toPnlY(0) : H / 2;

  // Line path and area path
  const { linePath, areaPath } = useMemo(() => {
    if (!hasData) return { linePath: '', areaPath: '' };
    const pts = cumulative.map((v, i) => ({ x: toX(i), y: toPnlY(v) }));
    const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
    const lastX = pts[pts.length - 1].x;
    const firstX = pts[0].x;
    const area = `${line} L${lastX},${zeroY} L${firstX},${zeroY} Z`;
    return { linePath: line, areaPath: area };
  }, [cumulative, hasData, toX, toPnlY, zeroY]);

  // Volume bars (daily P&L as bars at bottom)
  const maxAbsVol = useMemo(() => {
    if (data.length === 0) return 1;
    return Math.max(1, ...data.map(Math.abs));
  }, [data]);

  const volBaseY = H - PAD.bottom;

  // Hover handler
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (!hasData || !svgRef.current) return;
      const rect = svgRef.current.getBoundingClientRect();
      const svgX = ((e.clientX - rect.left) / rect.width) * W;
      const dataX = svgX - PAD.left;
      if (dataX < 0 || dataX > chartW) {
        setHoverIdx(null);
        return;
      }
      const idx = Math.round((dataX / chartW) * (cumulative.length - 1));
      setHoverIdx(Math.max(0, Math.min(cumulative.length - 1, idx)));
    },
    [hasData, chartW, cumulative.length],
  );

  const formatDollar = (v: number) => {
    if (Math.abs(v) >= 1000) return `$${(v / 1000).toFixed(1)}k`;
    return `$${v.toFixed(0)}`;
  };

  const periods: ChartPeriod[] = ['7D', '30D', '90D', 'YTD', 'ALL'];
  const metrics: { value: ChartMetric; label: string }[] = [
    { value: 'pnl', label: 'P&L' },
    { value: 'winrate', label: 'Win Rate' },
    { value: 'rr', label: 'R:R' },
  ];

  return (
    <div className="relative bg-[var(--fintheon-surface)] border border-[var(--fintheon-accent)]/15 rounded-lg overflow-hidden">
      {/* Filter dropdown — floats top-right inside chart card */}
      <div className="absolute top-2 right-2 z-10 flex items-center gap-1">
        {/* Period pills */}
        <div className="flex items-center gap-0.5 bg-black/50 backdrop-blur-sm rounded px-1 py-0.5">
          {periods.map(p => (
            <button
              key={p}
              onClick={() => onPeriodChange(p)}
              className={`px-1.5 py-0.5 text-[8px] font-mono font-semibold rounded transition-colors ${
                period === p
                  ? 'bg-[var(--fintheon-accent)]/20 text-[var(--fintheon-accent)]'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {p}
            </button>
          ))}
        </div>

        {/* Metric toggle */}
        <div className="relative">
          <button
            onClick={() => setFilterOpen(v => !v)}
            className="flex items-center gap-0.5 px-1.5 py-0.5 text-[8px] font-mono font-semibold bg-black/50 backdrop-blur-sm rounded text-[var(--fintheon-accent)] hover:bg-black/70 transition-colors"
          >
            {metrics.find(m => m.value === metric)?.label}
            <svg className={`w-2 h-2 transition-transform ${filterOpen ? 'rotate-180' : ''}`} fill="currentColor" viewBox="0 0 12 12">
              <path d="M3 5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" fill="none" />
            </svg>
          </button>
          {filterOpen && (
            <div className="absolute top-full right-0 mt-0.5 bg-[var(--fintheon-surface)] border border-[var(--fintheon-accent)]/20 rounded shadow-lg min-w-[60px] z-20">
              {metrics.map(m => (
                <button
                  key={m.value}
                  onClick={() => { onMetricChange(m.value); setFilterOpen(false); }}
                  className={`block w-full text-left px-2 py-1 text-[9px] font-mono transition-colors ${
                    m.value === metric
                      ? 'text-[var(--fintheon-accent)] bg-[var(--fintheon-accent)]/5'
                      : 'text-zinc-400 hover:bg-[var(--fintheon-accent)]/5'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <svg
        ref={svgRef}
        className="w-full"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid meet"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoverIdx(null)}
      >
        <defs>
          {/* Gold gradient fill for area under curve */}
          <linearGradient id="pnl-area-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#c79f4a" stopOpacity={0.25} />
            <stop offset="100%" stopColor="#c79f4a" stopOpacity={0.02} />
          </linearGradient>
        </defs>

        {/* Grid lines — gold 10% opacity */}
        {gridLines.map((v, i) => {
          const y = toPnlY(v);
          return (
            <g key={i}>
              <line
                x1={PAD.left} y1={y} x2={W - PAD.right} y2={y}
                stroke="#c79f4a" strokeOpacity={0.1} strokeDasharray="3 3"
              />
              <text
                x={PAD.left - 6} y={y}
                textAnchor="end" dominantBaseline="central"
                fill="#f0ead6" fillOpacity={0.6} fontSize={8} fontFamily="'Geist Mono', monospace"
              >
                {formatDollar(v)}
              </text>
            </g>
          );
        })}

        {/* Zero line */}
        {hasData && (
          <line
            x1={PAD.left} y1={zeroY} x2={W - PAD.right} y2={zeroY}
            stroke="#c79f4a" strokeOpacity={0.2} strokeWidth={0.5}
          />
        )}

        {/* Gradient area fill */}
        {hasData && (
          <path d={areaPath} fill="url(#pnl-area-gradient)" />
        )}

        {/* P&L line — gold */}
        {hasData && (
          <path
            d={linePath}
            fill="none"
            stroke="#c79f4a"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}

        {/* Trade dots — green (win) / red (loss) */}
        {hasData && data.map((dailyPnl, i) => {
          if (i >= cumulative.length) return null;
          const x = toX(i);
          const y = toPnlY(cumulative[i]);
          const isWin = dailyPnl >= 0;
          // Only show dots for non-zero trades
          if (dailyPnl === 0) return null;
          return (
            <circle
              key={`trade-${i}`}
              cx={x} cy={y}
              r={hoverIdx === i ? 4 : 2.5}
              fill={isWin ? '#34D399' : '#EF4444'}
              stroke={hoverIdx === i ? '#fff' : 'none'}
              strokeWidth={1}
              className="transition-all duration-100"
            />
          );
        })}

        {/* Volume bars at bottom */}
        {data.map((dailyPnl, i) => {
          if (cumulative.length < 2) return null;
          const x = toX(i);
          const barH = (Math.abs(dailyPnl) / maxAbsVol) * VOLUME_HEIGHT;
          const barW = Math.max(2, chartW / data.length * 0.6);
          return (
            <rect
              key={`vol-${i}`}
              x={x - barW / 2}
              y={volBaseY - barH}
              width={barW}
              height={barH}
              fill={dailyPnl >= 0 ? '#34D399' : '#EF4444'}
              fillOpacity={hoverIdx === i ? 0.6 : 0.2}
              rx={1}
            />
          );
        })}

        {/* Hover crosshair + tooltip */}
        {hoverIdx !== null && hasData && (
          <>
            <line
              x1={toX(hoverIdx)} y1={PAD.top}
              x2={toX(hoverIdx)} y2={volBaseY}
              stroke="#c79f4a" strokeOpacity={0.3} strokeDasharray="2 2"
            />
            <rect
              x={toX(hoverIdx) - 36} y={2}
              width={72} height={16}
              rx={3} fill="#0a0906" stroke="#c79f4a" strokeOpacity={0.3}
            />
            <text
              x={toX(hoverIdx)} y={12}
              textAnchor="middle" dominantBaseline="central"
              fill="#f0ead6" fontSize={8} fontFamily="'Geist Mono', monospace"
            >
              {formatDollar(cumulative[hoverIdx])} | {data[hoverIdx] >= 0 ? '+' : ''}{formatDollar(data[hoverIdx])}
            </text>
          </>
        )}

        {/* Placeholder line when no data */}
        {!hasData && (
          <>
            <line
              x1={PAD.left} y1={H / 2 - VOLUME_HEIGHT / 2}
              x2={W - PAD.right} y2={H / 2 - VOLUME_HEIGHT / 2}
              stroke="#c79f4a" strokeOpacity={0.15} strokeDasharray="6 4"
            />
            <text
              x={W / 2} y={H / 2 - VOLUME_HEIGHT / 2 + 16}
              textAnchor="middle" fill="#c79f4a" fillOpacity={0.3} fontSize={10}
              fontFamily="'Geist Mono', monospace"
            >
              No P&amp;L data
            </text>
          </>
        )}
      </svg>
    </div>
  );
}
