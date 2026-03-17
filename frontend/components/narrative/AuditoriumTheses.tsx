// [claude-code 2026-03-16] Top 5 most volatile prediction theses — regime-tracker card style
import type { MiroFishScenario, MiroFishCategoryScore } from '../../types/mirofish';
import { COMPOSITE_COLOR } from '../../types/mirofish';

interface AuditoriumThesesProps {
  scenarios: MiroFishScenario[];
  categoryScores: MiroFishCategoryScore[];
}

function getScoreColor(score: number): string {
  if (score >= 7) return '#EF4444';
  if (score >= 5) return '#F59E0B';
  return '#34D399';
}

function getConfidenceColor(conf: number): string {
  if (conf >= 0.7) return '#34D399';
  if (conf >= 0.5) return '#F59E0B';
  return '#EF4444';
}

export function AuditoriumTheses({ scenarios, categoryScores }: AuditoriumThesesProps) {
  // Calculate composite average for volatility sorting
  const compositeAvg = categoryScores.length > 0
    ? categoryScores.reduce((s, c) => s + c.ivScore, 0) / categoryScores.length
    : 5;

  // Sort by volatility (distance from composite) and take top 5
  const sorted = [...scenarios]
    .sort((a, b) => Math.abs(b.projectedScore - compositeAvg) - Math.abs(a.projectedScore - compositeAvg))
    .slice(0, 5);

  if (sorted.length === 0) {
    return (
      <div className="text-[10px] text-[var(--fintheon-muted)]/40 text-center py-4 italic">
        No prediction theses available
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5 max-h-[200px] overflow-y-auto scrollbar-thin">
      {sorted.map((thesis, idx) => {
        const volatility = Math.abs(thesis.projectedScore - compositeAvg);
        const volatilityPct = Math.min(100, (volatility / 10) * 100);
        const confidencePct = (thesis.probability ?? 0.5) * 100;
        const isTop = idx === 0;

        return (
          <div
            key={thesis.label + idx}
            className={`px-3 py-2 rounded border transition-colors ${
              isTop
                ? 'border-[var(--fintheon-accent)]/50 bg-[var(--fintheon-accent)]/5'
                : 'border-[var(--fintheon-border)]/15 bg-[var(--fintheon-bg)]/40'
            }`}
          >
            {/* Header: label + probability + projected score */}
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-[10px] text-[var(--fintheon-text)] font-medium truncate">
                  {thesis.label}
                </span>
                <span className="text-[9px] text-[var(--fintheon-muted)]/60 font-mono shrink-0">
                  {(thesis.probability * 100).toFixed(0)}%
                </span>
              </div>
              <span
                className="text-[11px] font-mono font-bold shrink-0 ml-2"
                style={{ color: getScoreColor(thesis.projectedScore) }}
              >
                {thesis.projectedScore.toFixed(1)}
              </span>
            </div>

            {/* Confidence bar */}
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[8px] text-[var(--fintheon-muted)]/50 w-[52px] shrink-0">
                Confidence
              </span>
              <div className="flex-1 h-[4px] rounded-full bg-[var(--fintheon-border)]/10 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${confidencePct}%`,
                    backgroundColor: getConfidenceColor(thesis.probability),
                  }}
                />
              </div>
              <span className="text-[8px] font-mono text-[var(--fintheon-muted)]/50 w-[28px] text-right">
                {confidencePct.toFixed(0)}%
              </span>
            </div>

            {/* Volatility bar */}
            <div className="flex items-center gap-2">
              <span className="text-[8px] text-[var(--fintheon-muted)]/50 w-[52px] shrink-0">
                Volatility
              </span>
              <div className="flex-1 h-[4px] rounded-full bg-[var(--fintheon-border)]/10 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${volatilityPct}%`,
                    backgroundColor: COMPOSITE_COLOR,
                    opacity: 0.7,
                  }}
                />
              </div>
              <span className="text-[8px] font-mono text-[var(--fintheon-muted)]/50 w-[28px] text-right">
                {volatility.toFixed(1)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
