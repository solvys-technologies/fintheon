// [claude-code 2026-03-23] Auditorium theses — dashboard-grade expanded cards
import type { MiroFishScenario, MiroFishCategoryScore } from '../../types/mirofish';
import { COMPOSITE_COLOR } from '../../types/mirofish';

interface AuditoriumThesesProps {
  scenarios: MiroFishScenario[];
  categoryScores: MiroFishCategoryScore[];
  expanded?: boolean;
}

function getScoreColor(score: number): string {
  if (score >= 7) return 'var(--fintheon-severe)';
  if (score >= 5) return 'var(--fintheon-neutral-severe)';
  return 'var(--fintheon-low)';
}

function getConfidenceColor(conf: number): string {
  if (conf >= 0.7) return 'var(--fintheon-low)';
  if (conf >= 0.5) return 'var(--fintheon-neutral-severe)';
  return 'var(--fintheon-severe)';
}

export function AuditoriumTheses({ scenarios, categoryScores, expanded }: AuditoriumThesesProps) {
  const compositeAvg = categoryScores.length > 0
    ? categoryScores.reduce((s, c) => s + c.ivScore, 0) / categoryScores.length
    : 5;

  const sorted = [...scenarios]
    .sort((a, b) => Math.abs(b.projectedScore - compositeAvg) - Math.abs(a.projectedScore - compositeAvg))
    .slice(0, expanded ? 10 : 5);

  if (sorted.length === 0) {
    return (
      <div className="text-sm text-[var(--fintheon-muted)]/40 text-center py-8 italic">
        No prediction theses available
      </div>
    );
  }

  return (
    <div className={`grid gap-3 ${expanded ? 'grid-cols-1 xl:grid-cols-2' : 'grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3'}`}>
      {sorted.map((thesis, idx) => {
        const volatility = Math.abs(thesis.projectedScore - compositeAvg);
        const volatilityPct = Math.min(100, (volatility / 10) * 100);
        const confidencePct = (thesis.probability ?? 0.5) * 100;
        const isTop = idx === 0;

        return (
          <div
            key={thesis.label + idx}
            className={`rounded border p-4 transition-colors ${
              isTop
                ? 'border-[var(--fintheon-accent)]/40 bg-[var(--fintheon-accent)]/5'
                : 'border-[var(--fintheon-border)]/15 bg-[var(--fintheon-surface)]/40'
            }`}
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1 min-w-0 mr-3">
                <div className="flex items-center gap-2">
                  {isTop && (
                    <span className="text-[8px] font-mono font-bold px-1.5 py-0.5 rounded bg-[var(--fintheon-accent)]/15 text-[var(--fintheon-accent)]">
                      TOP
                    </span>
                  )}
                  <span className="text-xs text-[var(--fintheon-text)] font-medium truncate">
                    {thesis.label}
                  </span>
                </div>
                {thesis.description && expanded && (
                  <p className="text-[10px] text-[var(--fintheon-muted)]/50 mt-1 line-clamp-2">
                    {thesis.description}
                  </p>
                )}
              </div>
              <div className="flex flex-col items-end">
                <span
                  className="text-lg font-mono font-bold"
                  style={{ color: getScoreColor(thesis.projectedScore) }}
                >
                  {thesis.projectedScore.toFixed(1)}
                </span>
                <span className="text-[9px] text-[var(--fintheon-muted)]/60 font-mono">
                  {(thesis.probability * 100).toFixed(0)}% prob
                </span>
              </div>
            </div>

            {/* Bars */}
            <div className="flex flex-col gap-2">
              {/* Confidence */}
              <div className="flex items-center gap-3">
                <span className="text-[9px] text-[var(--fintheon-muted)]/50 w-[60px] shrink-0">
                  Confidence
                </span>
                <div className="flex-1 h-[5px] rounded-full bg-[var(--fintheon-border)]/10 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${confidencePct}%`,
                      backgroundColor: getConfidenceColor(thesis.probability),
                    }}
                  />
                </div>
                <span className="text-[9px] font-mono text-[var(--fintheon-muted)]/50 w-[32px] text-right">
                  {confidencePct.toFixed(0)}%
                </span>
              </div>

              {/* Volatility */}
              <div className="flex items-center gap-3">
                <span className="text-[9px] text-[var(--fintheon-muted)]/50 w-[60px] shrink-0">
                  Volatility
                </span>
                <div className="flex-1 h-[5px] rounded-full bg-[var(--fintheon-border)]/10 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${volatilityPct}%`,
                      backgroundColor: COMPOSITE_COLOR,
                      opacity: 0.8,
                    }}
                  />
                </div>
                <span className="text-[9px] font-mono text-[var(--fintheon-muted)]/50 w-[32px] text-right">
                  {volatility.toFixed(1)}
                </span>
              </div>

              {/* Agent consensus if available */}
              {thesis.agentConsensus != null && (
                <div className="flex items-center gap-3">
                  <span className="text-[9px] text-[var(--fintheon-muted)]/50 w-[60px] shrink-0">
                    Consensus
                  </span>
                  <div className="flex-1 h-[5px] rounded-full bg-[var(--fintheon-border)]/10 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min(100, (thesis.agentConsensus / 5) * 100)}%`,
                        backgroundColor: '#8B5CF6',
                        opacity: 0.7,
                      }}
                    />
                  </div>
                  <span className="text-[9px] font-mono text-[var(--fintheon-muted)]/50 w-[32px] text-right">
                    {thesis.agentConsensus}/5
                  </span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
