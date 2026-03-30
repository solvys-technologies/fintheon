// [claude-code 2026-03-23] FRED macro indicator strip — VIX + 5 FRED indicators with stress colors
import type { SimulationContext } from '../../types/miroshark';

interface SanctumMacroStripProps {
  context: SimulationContext | null;
}

interface IndicatorDef {
  key: string;
  label: string;
  unit: string;
  stress: (v: number) => 'low' | 'moderate' | 'elevated' | 'high';
}

const STRESS_COLORS = {
  low: '#34D399',
  moderate: '#F59E0B',
  elevated: '#F97316',
  high: '#EF4444',
} as const;

const INDICATORS: IndicatorDef[] = [
  {
    key: '_vix', label: 'VIX', unit: '',
    stress: v => v >= 30 ? 'high' : v >= 20 ? 'elevated' : v >= 15 ? 'moderate' : 'low',
  },
  {
    key: 'hyOasSpread', label: 'HY OAS', unit: '%',
    stress: v => v >= 5 ? 'high' : v >= 4 ? 'elevated' : v >= 3 ? 'moderate' : 'low',
  },
  {
    key: 'yieldCurve2s10s', label: '2s10s', unit: '%',
    stress: v => v < 0 ? 'high' : v < 0.3 ? 'elevated' : v < 0.8 ? 'moderate' : 'low',
  },
  {
    key: 'tedSpread', label: 'TED', unit: '%',
    stress: v => v >= 0.5 ? 'high' : v >= 0.35 ? 'elevated' : v >= 0.2 ? 'moderate' : 'low',
  },
  {
    key: 'fedFundsRate', label: 'Fed Funds', unit: '%',
    stress: () => 'low', // display only
  },
];

function Pill({ label, value, unit, stressLevel }: {
  label: string; value: string; unit: string; stressLevel: 'low' | 'moderate' | 'elevated' | 'high';
}) {
  const color = STRESS_COLORS[stressLevel];
  return (
    <div className="flex items-center gap-2 rounded border border-[var(--fintheon-border)]/15 bg-[var(--fintheon-surface)]/40 px-3 py-2">
      <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
      <div className="flex flex-col">
        <span className="text-[8px] text-[var(--fintheon-muted)]/50 uppercase tracking-wider leading-none">
          {label}
        </span>
        <span className="text-xs font-mono font-bold text-[var(--fintheon-text)]">
          {value}{unit}
        </span>
      </div>
    </div>
  );
}

export function SanctumMacroStrip({ context }: SanctumMacroStripProps) {
  if (!context) {
    return (
      <div className="flex items-center gap-2 text-[10px] text-[var(--fintheon-muted)]/30 italic">
        Awaiting market context...
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {INDICATORS.map(ind => {
        const raw = ind.key === '_vix'
          ? context.vixLevel
          : context.fredIndicators[ind.key];

        if (raw == null) return null;

        const stressLevel = ind.stress(raw);
        return (
          <Pill
            key={ind.key}
            label={ind.label}
            value={raw.toFixed(ind.key === '_vix' ? 1 : 2)}
            unit={ind.unit}
            stressLevel={stressLevel}
          />
        );
      })}
      {context.fredFetchedAt && (
        <span className="text-[8px] text-[var(--fintheon-muted)]/25 font-mono ml-1">
          FRED: {new Date(context.fredFetchedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      )}
    </div>
  );
}
