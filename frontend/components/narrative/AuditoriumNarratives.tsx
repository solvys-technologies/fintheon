// [claude-code 2026-03-23] Active Narratives & Large Moves — Page 3
import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Minus, History, Zap } from 'lucide-react';
import type { AuditoriumNarrative, MiroFishRunRecord } from '../../types/mirofish';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080';

interface AuditoriumNarrativesProps {
  narratives?: AuditoriumNarrative[];
  expanded?: boolean;
}

function directionIcon(bias: string) {
  if (bias === 'bullish') return <TrendingUp className="w-3.5 h-3.5 text-[#34D399]" />;
  if (bias === 'bearish') return <TrendingDown className="w-3.5 h-3.5 text-[#EF4444]" />;
  return <Minus className="w-3.5 h-3.5 text-[#F59E0B]" />;
}

function healthColor(score: number): string {
  if (score >= 70) return '#34D399';
  if (score >= 40) return '#F59E0B';
  return '#EF4444';
}

function NarrativeCard({ narrative }: { narrative: AuditoriumNarrative }) {
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

function RunHistoryRow({ run }: { run: MiroFishRunRecord }) {
  return (
    <div className="flex items-center gap-3 rounded border border-[var(--fintheon-border)]/10 bg-[var(--fintheon-bg)]/60 px-3 py-2">
      <Zap className="w-3 h-3 text-[var(--fintheon-accent)]/40 shrink-0" />
      <span className="text-[9px] font-mono text-[var(--fintheon-muted)]/50 w-[60px] shrink-0">
        {new Date(run.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
      </span>
      <span className="text-[9px] font-mono text-[var(--fintheon-accent)]/60 w-[70px] shrink-0">
        {run.preset}
      </span>
      <span className="text-xs font-mono font-bold text-[var(--fintheon-text)]">
        IV {run.composite_iv?.toFixed(1) ?? '—'}
      </span>
      <span className="text-[9px] font-mono text-[var(--fintheon-muted)]/40">
        conf {((run.confidence ?? 0) * 100).toFixed(0)}%
      </span>
      {(run.regime_shift_probability ?? 0) >= 0.3 && (
        <span className="text-[8px] font-mono font-bold px-1 py-0.5 rounded bg-[#EF4444]/10 text-[#EF4444]">
          REGIME
        </span>
      )}
    </div>
  );
}

export function AuditoriumNarratives({ narratives, expanded }: AuditoriumNarrativesProps) {
  const [history, setHistory] = useState<MiroFishRunRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function fetchHistory() {
      try {
        const res = await fetch(`${API_BASE}/api/mirofish/history?limit=15`);
        if (!res.ok) throw new Error(`${res.status}`);
        const data = await res.json();
        if (!cancelled && Array.isArray(data.runs)) setHistory(data.runs);
      } catch {
        // silently fail
      } finally {
        if (!cancelled) setLoadingHistory(false);
      }
    }
    fetchHistory();
    return () => { cancelled = true; };
  }, []);

  const hasNarratives = narratives && narratives.length > 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Active Narratives */}
      <div>
        <div className="text-[9px] text-[var(--fintheon-muted)]/40 font-mono mb-2 uppercase tracking-wider">
          Active Narratives
        </div>
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

      {/* Run History */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <History className="w-3 h-3 text-[var(--fintheon-muted)]/30" />
          <span className="text-[9px] text-[var(--fintheon-muted)]/40 font-mono uppercase tracking-wider">
            Simulation History
          </span>
        </div>
        {loadingHistory ? (
          <p className="text-[10px] text-[var(--fintheon-muted)]/30 text-center py-4">
            Loading history...
          </p>
        ) : history.length === 0 ? (
          <p className="text-[10px] text-[var(--fintheon-muted)]/30 text-center py-4">
            No simulation runs recorded yet
          </p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {history.map(run => <RunHistoryRow key={run.id} run={run} />)}
          </div>
        )}
      </div>
    </div>
  );
}
