// [claude-code 2026-03-13] T2: Past proposals with WIN/LOSS/PENDING pills, real KPI data
import { useState, useEffect, useMemo } from 'react';
import { Bot, Target, TrendingUp, BarChart3, ChevronDown, ChevronUp, History } from 'lucide-react';
import { useBackend } from '../../lib/backend';
import type { JournalEntryItem, JournalSummaryResponse, AgentPerformanceResponse } from '../../lib/services';

interface AgentPerformanceTabProps {
  entries: JournalEntryItem[];
  summary: JournalSummaryResponse | null;
}

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="bg-black/30 border border-[var(--fintheon-accent)]/10 rounded p-2.5">
      <div className="text-[10px] text-[var(--fintheon-muted)]">{label}</div>
      <div className="text-base font-mono mt-0.5" style={{ color: color || 'var(--fintheon-text)' }}>
        {value}
      </div>
      {sub && <div className="text-[9px] text-[var(--fintheon-muted)] mt-0.5">{sub}</div>}
    </div>
  );
}

function ProposalRow({ proposal }: { proposal: NonNullable<JournalEntryItem['proposals']>[number] }) {
  const statusColor = {
    proposed: 'text-[var(--fintheon-accent)]',
    accepted: 'text-emerald-400',
    rejected: 'text-red-400',
    expired: 'text-gray-500',
  }[proposal.status];

  const outcomeColors: Record<string, string> = {
    win: 'text-emerald-400',
    loss: 'text-red-400',
    breakeven: 'text-gray-400',
  };
  const outcomeColor = (proposal.outcome && outcomeColors[proposal.outcome]) ?? 'text-[var(--fintheon-muted)]';

  return (
    <div className="flex items-center justify-between py-1.5 border-b border-[var(--fintheon-accent)]/5 last:border-0">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-mono text-[var(--fintheon-accent)]">{proposal.ticker}</span>
        <span className={`text-[9px] uppercase ${proposal.direction === 'long' ? 'text-emerald-400' : 'text-red-400'}`}>
          {proposal.direction}
        </span>
        <span className={`text-[9px] ${statusColor}`}>{proposal.status}</span>
      </div>
      <div className="flex items-center gap-3 text-[10px]">
        {proposal.entry && (
          <span className="text-[var(--fintheon-muted)] font-mono">{proposal.entry.toFixed(2)}</span>
        )}
        {proposal.outcome && (
          <span className={`font-mono ${outcomeColor}`}>{proposal.outcome}</span>
        )}
        {typeof proposal.pnl === 'number' && (
          <span className={`font-mono ${proposal.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {proposal.pnl >= 0 ? '+' : ''}{proposal.pnl.toFixed(2)}
          </span>
        )}
      </div>
    </div>
  );
}

export function AgentPerformanceTab({ entries, summary }: AgentPerformanceTabProps) {
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const backend = useBackend();
  const [performance, setPerformance] = useState<AgentPerformanceResponse | null>(null);
  const [pastProposals, setPastProposals] = useState<any[]>([]);

  // Fetch combined performance and proposal history from backend
  useEffect(() => {
    backend.agentPerformance.getPerformance(30).then(setPerformance);
    backend.autopilot.getHistory(20).then(res => setPastProposals(res.proposals ?? []));
  }, [backend]);

  const agentEntries = useMemo(
    () => entries.filter(e => e.type === 'agent').slice(0, 14),
    [entries]
  );

  // Use combined performance data when available, fall back to journal aggregation
  const combined = performance?.combined;
  const predictions = performance?.predictions;
  const futuresAgents = performance?.futures ?? [];

  // Aggregate stats — prefer live performance data, fall back to journal summary
  const totalProposals = combined
    ? futuresAgents.reduce((s, f) => s + f.totalProposals, 0) + (predictions?.total ?? 0)
    : agentEntries.reduce((s, e) => s + (e.proposalCount ?? 0), 0);
  const totalAccepted = combined
    ? futuresAgents.reduce((s, f) => s + f.accepted, 0) + (predictions?.resolved ?? 0)
    : agentEntries.reduce((s, e) => s + (e.acceptedCount ?? 0), 0);
  const winRate = combined?.overallWinRate ?? summary?.avgWinRate ?? 0;
  const avgRR = futuresAgents.length > 0
    ? futuresAgents.reduce((s, f) => s + f.avgRR, 0) / futuresAgents.length
    : summary?.avgRR ?? 0;
  const totalPnl = combined?.totalPnl ?? summary?.totalAgentPnl ?? 0;

  return (
    <div className="space-y-4">
      {/* KPI Grid */}
      <div className="grid grid-cols-2 gap-2">
        <StatCard
          label="Win Rate"
          value={`${winRate.toFixed(1)}%`}
          sub={combined ? 'futures + predictions' : '30-day avg'}
          color={winRate >= 50 ? '#34D399' : '#EF4444'}
        />
        <StatCard
          label="Avg R:R"
          value={avgRR.toFixed(2)}
          sub="Risk/Reward"
          color={avgRR >= 1.5 ? '#34D399' : avgRR >= 1 ? 'var(--fintheon-accent)' : '#EF4444'}
        />
        <StatCard
          label="Decisions"
          value={`${totalAccepted}/${totalProposals}`}
          sub="Resolved/Total"
        />
        <StatCard
          label="Agent P&L"
          value={`${totalPnl >= 0 ? '+' : ''}$${totalPnl.toFixed(0)}`}
          sub="30-day net"
          color={totalPnl >= 0 ? '#34D399' : '#EF4444'}
        />
      </div>

      {/* Per-Agent Breakdown (from performance endpoint) */}
      {futuresAgents.length > 0 && (
        <div className="bg-[var(--fintheon-surface)] border border-[var(--fintheon-accent)]/10 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <Target className="w-3.5 h-3.5 text-[var(--fintheon-accent)]" />
            <span className="text-xs font-semibold text-[var(--fintheon-text)]">Per-Agent Stats</span>
          </div>
          <div className="space-y-2">
            {futuresAgents.map(agent => (
              <div key={agent.agentName} className="flex items-center justify-between text-[10px] py-1 border-b border-[var(--fintheon-accent)]/5 last:border-0">
                <span className="text-[var(--fintheon-accent)] font-medium">{agent.agentName}</span>
                <div className="flex items-center gap-3">
                  <span className="text-[var(--fintheon-muted)]">{agent.wins}W/{agent.losses}L</span>
                  <span className={`font-mono ${agent.winRate >= 50 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {agent.winRate.toFixed(0)}%
                  </span>
                  <span className={`font-mono ${agent.totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {agent.totalPnl >= 0 ? '+' : ''}${agent.totalPnl.toFixed(0)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Prediction Markets Stats */}
      {predictions && predictions.total > 0 && (
        <div className="bg-[var(--fintheon-surface)] border border-[var(--fintheon-accent)]/10 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-3.5 h-3.5 text-[var(--fintheon-accent)]" />
            <span className="text-xs font-semibold text-[var(--fintheon-text)]">Prediction Markets</span>
          </div>
          <div className="grid grid-cols-4 gap-2 text-[10px]">
            <div>
              <div className="text-[var(--fintheon-muted)]">Total</div>
              <div className="text-[var(--fintheon-text)] font-mono">{predictions.total}</div>
            </div>
            <div>
              <div className="text-[var(--fintheon-muted)]">Resolved</div>
              <div className="text-[var(--fintheon-text)] font-mono">{predictions.resolved}</div>
            </div>
            <div>
              <div className="text-[var(--fintheon-muted)]">Win Rate</div>
              <div className={`font-mono ${predictions.winRate >= 50 ? 'text-emerald-400' : 'text-red-400'}`}>
                {predictions.winRate.toFixed(0)}%
              </div>
            </div>
            <div>
              <div className="text-[var(--fintheon-muted)]">W/L</div>
              <div className="text-[var(--fintheon-text)] font-mono">{predictions.wins}/{predictions.losses}</div>
            </div>
          </div>
        </div>
      )}

      {/* Proposal Tracker (daily journal entries) */}
      <div className="bg-[var(--fintheon-surface)] border border-[var(--fintheon-accent)]/10 rounded-lg p-3">
        <div className="flex items-center gap-2 mb-2">
          <Bot className="w-3.5 h-3.5 text-[var(--fintheon-accent)]" />
          <span className="text-xs font-semibold text-[var(--fintheon-text)]">Proposal Tracker</span>
        </div>

        {agentEntries.length === 0 ? (
          <div className="text-[10px] text-[var(--fintheon-muted)] py-4 text-center">
            No agent proposals recorded yet
          </div>
        ) : (
          <div className="space-y-1">
            {agentEntries.map(entry => {
              const isExpanded = expandedDate === entry.date;
              return (
                <div key={entry.id} className="bg-black/20 rounded">
                  <button
                    onClick={() => setExpandedDate(isExpanded ? null : entry.date)}
                    className="w-full flex items-center justify-between px-2.5 py-2 text-[11px] hover:bg-[var(--fintheon-accent)]/5 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-[var(--fintheon-muted)] font-mono">{entry.date}</span>
                      {entry.agentName && (
                        <span className="text-[var(--fintheon-accent)]">{entry.agentName}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[var(--fintheon-muted)]">
                        {entry.acceptedCount ?? 0}/{entry.proposalCount ?? 0}
                      </span>
                      {typeof entry.winRate === 'number' && (
                        <span className={`font-mono ${entry.winRate >= 50 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {entry.winRate.toFixed(0)}%
                        </span>
                      )}
                      {typeof entry.totalPnl === 'number' && (
                        <span className={`font-mono ${entry.totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {entry.totalPnl >= 0 ? '+' : ''}${entry.totalPnl.toFixed(0)}
                        </span>
                      )}
                      {isExpanded ? (
                        <ChevronUp className="w-3 h-3 text-[var(--fintheon-muted)]" />
                      ) : (
                        <ChevronDown className="w-3 h-3 text-[var(--fintheon-muted)]" />
                      )}
                    </div>
                  </button>
                  {isExpanded && entry.proposals && entry.proposals.length > 0 && (
                    <div className="px-2.5 pb-2">
                      {entry.proposals.map(p => (
                        <ProposalRow key={p.id} proposal={p} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Past Proposals */}
      <div className="bg-[var(--fintheon-surface)] border border-[var(--fintheon-accent)]/10 rounded-lg p-3">
        <div className="flex items-center gap-2 mb-2">
          <History className="w-3.5 h-3.5 text-[var(--fintheon-accent)]" />
          <span className="text-xs font-semibold text-[var(--fintheon-text)]">Past Proposals</span>
          <span className="text-[9px] text-[var(--fintheon-muted)] ml-auto">{pastProposals.length} recent</span>
        </div>

        {pastProposals.length === 0 ? (
          <div className="text-[10px] text-[var(--fintheon-muted)] py-4 text-center">
            No proposals in history
          </div>
        ) : (
          <div className="space-y-0">
            {pastProposals.map((p: any) => {
              const outcome = (() => {
                if (p.status === 'executed' && p.executionResult) {
                  const pnl = p.executionResult?.pnl ?? p.executionResult?.realizedPnl;
                  if (typeof pnl === 'number') return pnl >= 0 ? 'win' : 'loss';
                }
                if (['pending', 'approved'].includes(p.status)) return 'pending';
                if (p.status === 'rejected' || p.status === 'expired' || p.status === 'cancelled') return 'closed';
                return 'pending';
              })();

              return (
                <div key={p.id} className="flex items-center justify-between py-1.5 border-b border-[var(--fintheon-accent)]/5 last:border-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-[var(--fintheon-accent)]">{p.instrument}</span>
                    <span className={`text-[9px] ${p.direction === 'long' ? 'text-emerald-400' : p.direction === 'short' ? 'text-red-400' : 'text-gray-400'}`}>
                      {p.direction === 'long' ? '\u2191' : p.direction === 'short' ? '\u2193' : '-'}
                    </span>
                    <span className="text-[9px] text-[var(--fintheon-muted)]">{p.strategyName}</span>
                    <span className="text-[9px] text-[var(--fintheon-muted)] font-mono">{p.createdAt?.slice(0, 10)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {p.entryPrice && (
                      <span className="text-[10px] text-[var(--fintheon-muted)] font-mono">{Number(p.entryPrice).toFixed(2)}</span>
                    )}
                    {outcome === 'win' && (
                      <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full px-2 py-0.5 text-[9px] uppercase font-medium">WIN</span>
                    )}
                    {outcome === 'loss' && (
                      <span className="bg-red-500/20 text-red-400 border border-red-500/30 rounded-full px-2 py-0.5 text-[9px] uppercase font-medium">LOSS</span>
                    )}
                    {outcome === 'pending' && (
                      <span className="bg-gray-500/20 text-gray-400 border border-gray-500/30 rounded-full px-2 py-0.5 text-[9px] uppercase font-medium">PENDING</span>
                    )}
                    {outcome === 'closed' && (
                      <span className="bg-gray-500/10 text-gray-500 border border-gray-500/20 rounded-full px-2 py-0.5 text-[9px] uppercase font-medium">{p.status}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Performance Summary */}
      {summary && (
        <div className="bg-[var(--fintheon-surface)] border border-[var(--fintheon-accent)]/10 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="w-3.5 h-3.5 text-[var(--fintheon-accent)]" />
            <span className="text-xs font-semibold text-[var(--fintheon-text)]">30-Day Summary</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-[10px]">
            <div>
              <div className="text-[var(--fintheon-muted)]">Entries</div>
              <div className="text-[var(--fintheon-text)] font-mono">{summary.totalEntries}</div>
            </div>
            <div>
              <div className="text-[var(--fintheon-muted)]">Discipline</div>
              <div className="text-[var(--fintheon-text)] font-mono">{summary.avgDisciplineScore}%</div>
            </div>
            <div>
              <div className="text-[var(--fintheon-muted)]">Streak</div>
              <div className="text-[var(--fintheon-accent)] font-mono">{summary.streakDays}d</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
