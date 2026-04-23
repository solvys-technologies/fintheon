import { Target, Diff } from "lucide-react";
import type { AgentPerformanceResponse } from "../../../lib/services";

interface AgentBreakdownTableProps {
  performance: AgentPerformanceResponse | null;
}

export function AgentBreakdownTable({ performance }: AgentBreakdownTableProps) {
  const futuresAgents = performance?.futures ?? [];
  const predictions = performance?.predictions;

  return (
    <>
      {futuresAgents.length > 0 && (
        <div className="bg-[var(--fintheon-surface)] border border-[var(--fintheon-accent)]/10 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <Target className="w-3.5 h-3.5 text-[var(--fintheon-accent)]" />
            <span className="text-xs font-semibold text-[var(--fintheon-text)]">
              Per-Agent Stats
            </span>
          </div>
          <div className="space-y-2">
            {futuresAgents.map((agent) => (
              <div
                key={agent.agentName}
                className="flex items-center justify-between text-[10px] py-1 border-b border-[var(--fintheon-accent)]/5 last:border-0"
              >
                <span className="text-[var(--fintheon-accent)] font-medium">
                  {agent.agentName}
                </span>
                <div className="flex items-center gap-3">
                  <span className="text-[var(--fintheon-muted)]">
                    {agent.wins}W/{agent.losses}L
                  </span>
                  <span
                    className={`font-mono ${agent.winRate >= 50 ? "text-emerald-400" : "text-red-400"}`}
                  >
                    {agent.winRate.toFixed(0)}%
                  </span>
                  <span
                    className={`font-mono ${agent.totalPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}
                  >
                    {agent.totalPnl >= 0 ? "+" : ""}${agent.totalPnl.toFixed(0)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {predictions && predictions.total > 0 && (
        <div className="bg-[var(--fintheon-surface)] border border-[var(--fintheon-accent)]/10 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <Diff className="w-3.5 h-3.5 text-[var(--fintheon-accent)]" />
            <span className="text-xs font-semibold text-[var(--fintheon-text)]">
              Prediction Markets
            </span>
          </div>
          <div className="grid grid-cols-4 gap-2 text-[10px]">
            <div>
              <div className="text-[var(--fintheon-muted)]">Total</div>
              <div className="text-[var(--fintheon-text)] font-mono">
                {predictions.total}
              </div>
            </div>
            <div>
              <div className="text-[var(--fintheon-muted)]">Resolved</div>
              <div className="text-[var(--fintheon-text)] font-mono">
                {predictions.resolved}
              </div>
            </div>
            <div>
              <div className="text-[var(--fintheon-muted)]">Win Rate</div>
              <div
                className={`font-mono ${predictions.winRate >= 50 ? "text-emerald-400" : "text-red-400"}`}
              >
                {predictions.winRate.toFixed(0)}%
              </div>
            </div>
            <div>
              <div className="text-[var(--fintheon-muted)]">W/L</div>
              <div className="text-[var(--fintheon-text)] font-mono">
                {predictions.wins}/{predictions.losses}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
