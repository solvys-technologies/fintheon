import { useVIX } from '../contexts/VIXContext';
import type { VIXDataPoint } from '../lib/vix-feed';

/** Tiny inline SVG sparkline */
function Sparkline({ points }: { points: VIXDataPoint[] }) {
  if (points.length < 2) return null;
  const vals = points.map((p) => p.value);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const range = max - min || 1;
  const w = 64;
  const h = 20;
  const step = w / (vals.length - 1);

  const d = vals
    .map((v, i) => {
      const x = i * step;
      const y = h - ((v - min) / range) * h;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  // Color based on last value
  const last = vals[vals.length - 1];
  const color = last >= 30 ? '#ef4444' : last >= 20 ? '#eab308' : '#22c55e';

  return (
    <svg width={w} height={h} className="flex-shrink-0">
      <path d={d} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function VIXTicker() {
  const { data } = useVIX();

  if (!data) {
    return (
      <div className="bg-[#050500] border border-zinc-800 rounded-lg px-3 py-1.5 flex items-center gap-2 animate-pulse">
        <span className="text-[9px] text-gray-500 uppercase tracking-wider">VIX</span>
        <span className="text-xs font-mono text-gray-500">—</span>
      </div>
    );
  }

  const { value, change, changePercent, intraday } = data;

  // Color tiers: green < 20, yellow 20-30, red > 30
  const color =
    value >= 30
      ? 'text-red-400'
      : value >= 20
        ? 'text-yellow-400'
        : 'text-green-400';

  const borderColor =
    value >= 30
      ? 'border-red-500/30'
      : value >= 20
        ? 'border-yellow-500/30'
        : 'border-green-500/30';

  const sign = change >= 0 ? '+' : '';

  return (
    <div
      className={`bg-[#050500] border ${borderColor} rounded-lg px-3 py-1.5 flex items-center gap-2.5`}
    >
      {/* Label */}
      <div className="flex flex-col items-center leading-none">
        <span className="text-[8px] text-gray-500 uppercase tracking-[0.15em]">Fear</span>
        <span className="text-[8px] text-gray-500 uppercase tracking-[0.15em]">Gauge</span>
      </div>

      {/* Value */}
      <span className={`text-base font-mono font-bold ${color}`}>
        {value.toFixed(2)}
      </span>

      {/* Change */}
      <div className="flex flex-col items-end leading-tight">
        <span className={`text-[10px] font-mono ${color}`}>
          {sign}{change.toFixed(2)}
        </span>
        <span className={`text-[9px] font-mono ${color}`}>
          {sign}{changePercent.toFixed(2)}%
        </span>
      </div>

      {/* Sparkline */}
      <Sparkline points={intraday} />
    </div>
  );
}
