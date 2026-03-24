// [claude-code 2026-03-23] Geopolitical & fiscal risk section for Page 2
import type { RiskFlowCatalyst, MiroFishCategoryScore } from '../../types/mirofish';
import { RISK_CATEGORY_LABELS, ivHeatColor } from '../../types/mirofish';

interface AuditoriumRiskAssessmentProps {
  riskflowItems: RiskFlowCatalyst[];
  categoryScores?: MiroFishCategoryScore[];
}

const RISK_CATEGORIES = ['geopolitical', 'political'] as const;

function sentimentColor(s: string): string {
  if (s === 'bearish') return 'var(--fintheon-severe)';
  if (s === 'bullish') return 'var(--fintheon-low)';
  return 'var(--fintheon-neutral-severe)';
}

function macroLevelLabel(level: number): string {
  if (level >= 4) return 'CRITICAL';
  if (level >= 3) return 'HIGH';
  return 'MEDIUM';
}

export function AuditoriumRiskAssessment({ riskflowItems, categoryScores }: AuditoriumRiskAssessmentProps) {
  const geoItems = riskflowItems.filter(item => {
    const cat = item.category?.toLowerCase() ?? '';
    return cat.includes('geopolitical') || cat.includes('political') || cat.includes('fiscal')
      || item.title.toLowerCase().match(/tariff|sanction|war|election|regulation|congress|trade.*deal/);
  }).slice(0, 8);

  const relevantScores = (categoryScores ?? []).filter(cs =>
    RISK_CATEGORIES.includes(cs.category as typeof RISK_CATEGORIES[number]),
  );

  if (geoItems.length === 0 && relevantScores.length === 0) {
    return (
      <div className="text-[10px] text-[var(--fintheon-muted)]/30 italic text-center py-4">
        No geopolitical or fiscal risk signals in current window
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Category score headers */}
      {relevantScores.length > 0 && (
        <div className="flex gap-3">
          {relevantScores.map(cs => (
            <div
              key={cs.category}
              className="flex items-center gap-3 rounded border border-[var(--fintheon-border)]/15 bg-[var(--fintheon-surface)]/40 px-4 py-2"
            >
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: ivHeatColor(cs.ivScore) }} />
              <span className="text-[10px] font-mono text-[var(--fintheon-text)]/80 uppercase tracking-wider">
                {RISK_CATEGORY_LABELS[cs.category]}
              </span>
              <span className="text-lg font-mono font-bold" style={{ color: ivHeatColor(cs.ivScore) }}>
                {cs.ivScore.toFixed(1)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Headline list */}
      <div className="flex flex-col gap-1.5">
        {geoItems.map(item => (
          <div
            key={item.id}
            className="flex items-center gap-3 rounded border border-[var(--fintheon-border)]/10 bg-[var(--fintheon-bg)]/60 px-3 py-2"
          >
            <div
              className="w-1.5 h-6 rounded-full shrink-0"
              style={{ backgroundColor: sentimentColor(item.sentiment) }}
            />
            <div className="flex-1 min-w-0">
              <span className="text-[10px] text-[var(--fintheon-text)]/80 font-medium truncate block">
                {item.title}
              </span>
              {item.summary && (
                <span className="text-[9px] text-[var(--fintheon-muted)]/40 truncate block">
                  {item.summary}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[8px] font-mono font-bold" style={{ color: sentimentColor(item.sentiment) }}>
                {item.sentiment.toUpperCase()}
              </span>
              <span className="text-[8px] font-mono text-[var(--fintheon-muted)]/50">
                IV {item.iv_score.toFixed(0)}
              </span>
              <span className={`text-[7px] font-mono font-bold px-1 py-0.5 rounded ${
                item.macro_level >= 4 ? 'bg-[var(--fintheon-severe)]/15 text-[var(--fintheon-severe)]' :
                item.macro_level >= 3 ? 'bg-[var(--fintheon-neutral-severe)]/15 text-[var(--fintheon-neutral-severe)]' :
                'bg-[var(--fintheon-border)]/10 text-[var(--fintheon-muted)]/50'
              }`}>
                {macroLevelLabel(item.macro_level)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
