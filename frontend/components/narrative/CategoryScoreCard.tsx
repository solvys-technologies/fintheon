// [claude-code 2026-03-24] Extracted CategoryScoreCard — 30% bigger with neon-edge glow
import { RISK_CATEGORY_COLORS, RISK_CATEGORY_LABELS } from '../../types/mirofish';

type MiroFishRiskCategory = 'geopolitical' | 'political' | 'monetary-policy' | 'earnings-corporate' | 'market-structure' | 'black-swan';

export function CategoryScoreCard({ category, score, delta, confidence }: {
  category: MiroFishRiskCategory; score: number; delta: number; confidence: number;
}) {
  const color = RISK_CATEGORY_COLORS[category];
  const label = RISK_CATEGORY_LABELS[category];
  const deltaColor = delta > 0 ? '#EF4444' : delta < 0 ? '#34D399' : 'var(--fintheon-muted)';
  const deltaSign = delta > 0 ? '+' : '';
  const confPct = Math.round(confidence * 100);

  return (
    <div
      className="rounded border border-[var(--fintheon-border)]/15 bg-[var(--fintheon-surface)]/40 px-5 py-4 min-h-[88px] border-l-2"
      style={{
        borderLeftColor: color,
        boxShadow: `0 0 8px rgba(212, 175, 55, 0.15)`,
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
          <span className="text-[11px] font-mono text-[var(--fintheon-text)]/80 uppercase tracking-wider">{label}</span>
        </div>
        <span className="text-[11px] font-mono font-bold" style={{ color: deltaColor }}>
          {deltaSign}{delta.toFixed(1)}
        </span>
      </div>
      <div className="flex items-end justify-between">
        <span
          className="text-3xl font-mono font-bold"
          style={{ color, textShadow: `0 0 12px ${color}40` }}
        >
          {score.toFixed(1)}
        </span>
        <div className="flex flex-col items-end gap-0.5">
          <span className="text-[8px] text-[var(--fintheon-muted)]/40 uppercase">Conf</span>
          <div className="w-20 h-[4px] rounded-full bg-[var(--fintheon-border)]/10 overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{
                width: `${confPct}%`,
                backgroundColor: confPct >= 70 ? '#34D399' : confPct >= 50 ? '#F59E0B' : '#EF4444',
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
