import type {
  AgentPerformanceResponse,
  JournalSummaryResponse,
} from "../../../lib/services";

interface AgentKpiStatsProps {
  performance: AgentPerformanceResponse | null;
  summary: JournalSummaryResponse | null;
  agentEntryProposals: number;
  agentEntryAccepted: number;
}

function StatCard({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="bg-black/30 border border-[var(--fintheon-accent)]/10 rounded p-2.5">
      <div className="text-[10px] text-[var(--fintheon-muted)]">{label}</div>
      <div
        className="text-base font-mono mt-0.5"
        style={{ color: color || "var(--fintheon-text)" }}
      >
        {value}
      </div>
      {sub && (
        <div className="text-[9px] text-[var(--fintheon-muted)] mt-0.5">
          {sub}
        </div>
      )}
    </div>
  );
}

export function AgentKpiStats({
  performance,
  summary,
  agentEntryProposals,
  agentEntryAccepted,
}: AgentKpiStatsProps) {
  const combined = performance?.combined;
  const predictions = performance?.predictions;
  const futuresAgents = performance?.futures ?? [];

  const totalProposals = combined
    ? futuresAgents.reduce((s, f) => s + f.totalProposals, 0) +
      (predictions?.total ?? 0)
    : agentEntryProposals;

  const totalAccepted = combined
    ? futuresAgents.reduce((s, f) => s + f.accepted, 0) +
      (predictions?.resolved ?? 0)
    : agentEntryAccepted;

  const winRate = combined?.overallWinRate ?? summary?.avgWinRate ?? 0;
  const avgRR =
    futuresAgents.length > 0
      ? futuresAgents.reduce((s, f) => s + f.avgRR, 0) / futuresAgents.length
      : (summary?.avgRR ?? 0);
  const totalPnl = combined?.totalPnl ?? summary?.totalAgentPnl ?? 0;

  return (
    <div className="grid grid-cols-2 gap-2">
      <StatCard
        label="Win Rate"
        value={`${winRate.toFixed(1)}%`}
        sub={combined ? "futures + predictions" : "30-day avg"}
        color={winRate >= 50 ? "#34D399" : "#EF4444"}
      />
      <StatCard
        label="Avg R:R"
        value={avgRR.toFixed(2)}
        sub="Risk/Reward"
        color={
          avgRR >= 1.5
            ? "#34D399"
            : avgRR >= 1
              ? "var(--fintheon-accent)"
              : "#EF4444"
        }
      />
      <StatCard
        label="Decisions"
        value={`${totalAccepted}/${totalProposals}`}
        sub="Resolved/Total"
      />
      <StatCard
        label="Agent P&L"
        value={`${totalPnl >= 0 ? "+" : ""}$${totalPnl.toFixed(0)}`}
        sub="30-day net"
        color={totalPnl >= 0 ? "#34D399" : "#EF4444"}
      />
    </div>
  );
}
