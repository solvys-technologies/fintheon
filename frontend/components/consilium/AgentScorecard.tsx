// [claude-code 2026-03-22] Theme-consistent styling — CSS vars, no hardcoded hex
// [claude-code 2026-03-19] Per-agent win rate dashboard for Consilium
import { useState, useEffect } from 'react';
import { AgentBadge, type BoardroomAgent } from './AgentBadge';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080';

interface AgentScorecardData {
  agent: BoardroomAgent;
  totalPredictions: number;
  correctCount: number;
  incorrectCount: number;
  partialCount: number;
  winRate: number;
  avgPnlPerPrediction: number;
  streakCurrent: number;
  bestStreak: number;
}

function formatCurrency(n: number): string {
  const sign = n >= 0 ? '+' : '';
  return `${sign}$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function AgentScorecard() {
  const [scorecards, setScorecards] = useState<AgentScorecardData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchScorecards = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/boardroom/scorecards`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setScorecards(data.scorecards || []);
      } catch {
        setScorecards([]);
      } finally {
        setIsLoading(false);
      }
    };
    fetchScorecards();
  }, []);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-[180px] animate-pulse rounded-xl border border-[var(--fintheon-accent)]/15 bg-[var(--fintheon-bg)]" />
        ))}
      </div>
    );
  }

  if (scorecards.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-8">
        <span className="text-sm text-[var(--fintheon-accent)]/40">No predictions tracked yet</span>
        <span className="text-center text-xs text-[var(--fintheon-text)]/20">
          Post trade ideas to start tracking agent performance
        </span>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 overflow-y-auto p-4 sm:grid-cols-2">
      {scorecards.map((sc) => (
        <div key={sc.agent} className="rounded-xl border border-[var(--fintheon-accent)]/15 bg-[var(--fintheon-bg)] p-4">
          {/* Header */}
          <div className="mb-3">
            <AgentBadge agent={sc.agent} size="md" />
          </div>

          {/* Stats grid */}
          <div className="mb-3 grid grid-cols-2 gap-3">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-[var(--fintheon-text)]/30">Win Rate</div>
              <div className="text-2xl font-bold text-[var(--fintheon-accent)]">
                {Math.round(sc.winRate)}<span className="text-sm">%</span>
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-[var(--fintheon-text)]/30">Total</div>
              <div className="text-lg font-medium text-[var(--fintheon-text)]/80">{sc.totalPredictions}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-[var(--fintheon-text)]/30">Streak</div>
              <div className="text-lg font-medium text-[var(--fintheon-text)]/80">
                {sc.streakCurrent}
                <span className="ml-1 text-[10px] text-[var(--fintheon-text)]/30">best: {sc.bestStreak}</span>
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-[var(--fintheon-text)]/30">Avg P&L</div>
              <div className={`text-lg font-medium ${sc.avgPnlPerPrediction >= 0 ? 'text-[var(--fintheon-accent)]' : 'text-red-400/80'}`}>
                {formatCurrency(sc.avgPnlPerPrediction)}
              </div>
            </div>
          </div>

          {/* Win rate bar */}
          <div className="mb-1.5 h-1 overflow-hidden rounded-full bg-[var(--fintheon-accent)]/10">
            <div
              className="h-full rounded-full bg-[var(--fintheon-accent)]"
              style={{ width: `${Math.min(sc.winRate, 100)}%` }}
            />
          </div>
          <div className="flex gap-3 text-[10px] text-[var(--fintheon-text)]/30">
            <span>{sc.correctCount} correct</span>
            <span>{sc.incorrectCount} incorrect</span>
            <span>{sc.partialCount} partial</span>
          </div>
        </div>
      ))}
    </div>
  );
}
