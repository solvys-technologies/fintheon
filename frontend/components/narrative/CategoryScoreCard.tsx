// [claude-code 2026-03-29] Layout overhaul: center-justify score+delta, right-justify confidence, add description
// [claude-code 2026-03-24] Heat-map colors — ivHeatColor(score) replaces static RISK_CATEGORY_COLORS
import { RISK_CATEGORY_LABELS, ivHeatColor } from '../../types/miroshark';

type MiroSharkRiskCategory = 'geopolitical' | 'political' | 'monetary-policy' | 'earnings-corporate' | 'market-structure' | 'black-swan';

export function CategoryScoreCard({ category, score, delta, confidence, description }: {
  category: MiroSharkRiskCategory; score: number; delta: number; confidence: number; description?: string;
}) {
  const color = ivHeatColor(score);
  const label = RISK_CATEGORY_LABELS[category];
  const deltaColor = delta > 0 ? '#EF4444' : delta < 0 ? '#34D399' : 'var(--fintheon-muted)';
  const deltaSign = delta > 0 ? '+' : '';
  const confPct = Math.round(confidence * 100);
  const confColor = confPct >= 70 ? '#34D399' : confPct >= 50 ? '#F59E0B' : '#EF4444';

  return (
    <div
      className="rounded-lg bg-[var(--fintheon-surface)]/40 px-5 py-4 min-h-[88px] iv-card-shimmer"
      style={{
        border: `1px solid ${color}30`,
        boxShadow: `0 0 8px ${color}15`,
      }}
    >
      {/* Header: label + delta */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
          <span className="text-[11px] font-mono text-[var(--fintheon-text)] uppercase tracking-wider">{label}</span>
        </div>
        <span className="text-[11px] font-mono font-bold" style={{ color: deltaColor }}>
          {deltaSign}{delta.toFixed(1)}
        </span>
      </div>

      {/* Description one-liner — full width */}
      {description && (
        <p className="text-[9px] italic text-[var(--fintheon-muted)]/50 mb-2 leading-relaxed">
          {description}
        </p>
      )}

      {/* Score (center) + Confidence (right) */}
      <div className="flex items-end">
        {/* Center-justified score + delta */}
        <div className="flex-1 flex flex-col items-center">
          <span
            className="text-3xl font-mono font-bold"
            style={{ color, textShadow: `0 0 12px ${color}40` }}
          >
            {score.toFixed(1)}
          </span>
        </div>

        {/* Right-justified confidence */}
        <div className="flex flex-col items-end gap-1">
          <span className="text-[11px] font-mono font-bold" style={{ color: confColor }}>
            {confPct}%
          </span>
          {/* Volatility fuse — progress bar showing IV score */}
          <div className="w-20 h-[3px] rounded-full bg-[var(--fintheon-border)]/10 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(score * 10, 100)}%`,
                backgroundColor: color,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
