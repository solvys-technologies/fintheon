// [claude-code 2026-03-28] S8-T4: Removed Simulation History — replaced by Agent Scorecards in Page 2
// [claude-code 2026-03-23] Active Narratives — Page 2
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { SanctumNarrative } from '../../types/miroshark';

interface SanctumNarrativesProps {
  narratives?: SanctumNarrative[];
  expanded?: boolean;
}

function directionIcon(bias: string) {
  if (bias === 'bullish') return <TrendingUp className="w-3.5 h-3.5 text-[var(--fintheon-low)]" />;
  if (bias === 'bearish') return <TrendingDown className="w-3.5 h-3.5 text-[var(--fintheon-severe)]" />;
  return <Minus className="w-3.5 h-3.5 text-[var(--fintheon-neutral-severe)]" />;
}

function healthColor(score: number): string {
  if (score >= 70) return 'var(--fintheon-low)';
  if (score >= 40) return 'var(--fintheon-neutral-severe)';
  return 'var(--fintheon-severe)';
}

function NarrativeCard({ narrative }: { narrative: SanctumNarrative }) {
  return (
    <div className="rounded border border-[var(--fintheon-border)]/15 bg-[var(--fintheon-surface)]/40 p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 min-w-0">
          {directionIcon(narrative.directionBias)}
          <span className="text-xs text-[var(--fintheon-text)] font-medium truncate">
            {narrative.title}
          </span>
        </div>
        <span className="text-[9px] px-1.5 py-0.5 rounded font-mono font-bold bg-[var(--fintheon-border)]/10 text-[var(--fintheon-muted)]/60 shrink-0">
          {narrative.category}
        </span>
      </div>

      {/* Health bar */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[8px] text-[var(--fintheon-muted)]/40 uppercase w-[40px] shrink-0">Health</span>
        <div className="flex-1 h-[4px] rounded-full bg-[var(--fintheon-border)]/10 overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${narrative.healthScore}%`, backgroundColor: healthColor(narrative.healthScore) }}
          />
        </div>
        <span className="text-[9px] font-mono text-[var(--fintheon-muted)]/50 w-[24px] text-right">
          {narrative.healthScore}
        </span>
      </div>

      {/* Instruments */}
      {narrative.instruments.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {narrative.instruments.slice(0, 5).map(inst => (
            <span key={inst} className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-[var(--fintheon-accent)]/8 text-[var(--fintheon-accent)]/70">
              {inst}
            </span>
          ))}
        </div>
      )}

      {/* Status + date */}
      <div className="flex items-center gap-2 mt-2 text-[8px] text-[var(--fintheon-muted)]/30 font-mono">
        <span className="uppercase">{narrative.status}</span>
        <span>·</span>
        <span>{narrative.dateRange.start.slice(5)}</span>
      </div>
    </div>
  );
}

export function SanctumNarratives({ narratives, expanded }: SanctumNarrativesProps) {
  const hasNarratives = narratives && narratives.length > 0;

  return (
    <div>
      {hasNarratives ? (
        <div className={`grid gap-3 ${expanded ? 'grid-cols-1 xl:grid-cols-2' : 'grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3'}`}>
          {narratives!.map(n => <NarrativeCard key={n.id} narrative={n} />)}
        </div>
      ) : (
        <div className="rounded border border-[var(--fintheon-border)]/10 bg-[var(--fintheon-surface)]/20 p-6 text-center">
          <p className="text-[10px] text-[var(--fintheon-muted)]/30">
            Connect Narrative Flow to track active market narratives
          </p>
          <p className="text-[9px] text-[var(--fintheon-muted)]/20 mt-1">
            Create lanes in the Narratives tab to populate this view
          </p>
        </div>
      )}
    </div>
  );
}
