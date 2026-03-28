// [claude-code 2026-03-28] S7: 5 forward-looking prediction cards under TradingView in Aquarium
import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Minus, Loader2 } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080';

interface InstrumentOutlook {
  symbol: string;
  name: string;
  ivScore: number;
  lean: 'bullish' | 'bearish' | 'neutral';
  range: [number, number];
  conviction: 'low' | 'moderate' | 'elevated';
  drivers: string[];
  scoredItemCount: number;
}

const LEAN_CONFIG = {
  bullish: { icon: TrendingUp, color: 'var(--fintheon-bullish)', label: 'Bullish' },
  bearish: { icon: TrendingDown, color: 'var(--fintheon-bearish)', label: 'Bearish' },
  neutral: { icon: Minus, color: 'var(--fintheon-muted)', label: 'Neutral' },
};

const CONVICTION_COLOR: Record<string, string> = {
  low: 'var(--fintheon-muted)',
  moderate: 'var(--fintheon-accent)',
  elevated: 'var(--fintheon-bearish)',
};

function IVHeatBar({ score }: { score: number }) {
  const pct = Math.min(100, (score / 10) * 100);
  const hue = score >= 7 ? 0 : score >= 5 ? 30 : score >= 3 ? 45 : 120;
  return (
    <div className="w-full h-[3px] rounded-full bg-[var(--fintheon-border)]/10 overflow-hidden">
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${pct}%`, backgroundColor: `hsl(${hue}, 70%, 50%)` }}
      />
    </div>
  );
}

export function AquariumPredictionCards() {
  const [outlook, setOutlook] = useState<InstrumentOutlook[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/predictions/outlook`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!cancelled) setOutlook(data.instruments ?? []);
      } catch (err) {
        console.warn('[Predictions] fetch failed:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="w-4 h-4 text-[var(--fintheon-accent)]/40 animate-spin" />
      </div>
    );
  }

  if (outlook.length === 0) {
    return (
      <div className="text-center py-3 text-[9px] text-[var(--fintheon-muted)]/40">
        No prediction data available — scored items needed
      </div>
    );
  }

  return (
    <div className="flex gap-2 px-4 py-3 overflow-x-auto scrollbar-none">
      {outlook.map(inst => {
        const leanCfg = LEAN_CONFIG[inst.lean];
        const LeanIcon = leanCfg.icon;
        return (
          <div
            key={inst.symbol}
            className="flex-shrink-0 w-[180px] rounded-lg border p-3 flex flex-col gap-2"
            style={{
              backgroundColor: 'color-mix(in srgb, var(--fintheon-surface) 80%, transparent)',
              borderColor: 'color-mix(in srgb, var(--fintheon-border) 20%, transparent)',
              backdropFilter: 'blur(12px)',
            }}
          >
            {/* Header: symbol + lean */}
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono font-bold text-[var(--fintheon-accent)]">
                {inst.symbol}
              </span>
              <div className="flex items-center gap-1">
                <LeanIcon className="w-3 h-3" style={{ color: leanCfg.color }} />
                <span className="text-[8px] font-semibold uppercase" style={{ color: leanCfg.color }}>
                  {leanCfg.label}
                </span>
              </div>
            </div>

            {/* IV Heat bar */}
            <div>
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[7px] text-[var(--fintheon-muted)]/50 uppercase">Heat</span>
                <span className="text-[8px] font-mono text-[var(--fintheon-text)]">{inst.ivScore.toFixed(1)}</span>
              </div>
              <IVHeatBar score={inst.ivScore} />
            </div>

            {/* Range */}
            <div className="flex items-center justify-between">
              <span className="text-[7px] text-[var(--fintheon-muted)]/50 uppercase">Range</span>
              <span className="text-[9px] font-mono text-[var(--fintheon-text)]">
                {inst.range[0] > 0 ? '+' : ''}{inst.range[0]} to {inst.range[1] > 0 ? '+' : ''}{inst.range[1]} pts
              </span>
            </div>

            {/* Conviction */}
            <div className="flex items-center justify-between">
              <span className="text-[7px] text-[var(--fintheon-muted)]/50 uppercase">Conviction</span>
              <span
                className="text-[8px] font-semibold uppercase px-1.5 py-0.5 rounded"
                style={{
                  color: CONVICTION_COLOR[inst.conviction],
                  backgroundColor: `color-mix(in srgb, ${CONVICTION_COLOR[inst.conviction]} 10%, transparent)`,
                }}
              >
                {inst.conviction}
              </span>
            </div>

            {/* Drivers */}
            {inst.drivers.length > 0 && (
              <div className="pt-1 border-t border-[var(--fintheon-border)]/10">
                {inst.drivers.slice(0, 2).map((d, i) => (
                  <p key={i} className="text-[7px] text-[var(--fintheon-muted)]/40 truncate">{d}</p>
                ))}
              </div>
            )}

            {/* Data points */}
            <div className="text-[6px] text-[var(--fintheon-muted)]/25 text-right">
              {inst.scoredItemCount} data points
            </div>
          </div>
        );
      })}
    </div>
  );
}
