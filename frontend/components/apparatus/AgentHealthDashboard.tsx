// [claude-code 2026-05-05] S59-T3: AgentHealthDashboard — glassmorphic panel showing all 5 agents' health.
// Vertical stack of AgentHealthRow components with header bar and status summary.
import { RefreshCw } from "lucide-react";
import { useAgentHealth } from "../../hooks/useAgentHealth";
import { AgentHealthRow } from "./AgentHealthRow";

function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diff)) return "";
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

export function AgentHealthDashboard() {
  const { data, isLoading, error, lastUpdated, refresh } = useAgentHealth();

  const greenCount = data?.filter((a) => a.personaHealth === "green").length ?? 0;
  const amberCount = data?.filter((a) => a.personaHealth === "amber").length ?? 0;
  const redCount = data?.filter((a) => a.personaHealth === "red").length ?? 0;

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header bar */}
      <div className="shrink-0 px-4 py-2.5 border-b border-[var(--fintheon-accent)]/10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-[11px] font-semibold text-[var(--fintheon-accent)] tracking-[0.15em] uppercase">
            Agent Health
          </h1>
          <span className="text-[8px] text-[var(--fintheon-text)]/25 font-mono">
            SOUL / REFLECT / GEPA / Memory
          </span>
        </div>
        <div className="flex items-center gap-3">
          {data && (
            <div className="flex items-center gap-2">
              <span className="text-[8px] font-mono tabular-nums text-emerald-400">
                {greenCount} ok
              </span>
              {amberCount > 0 && (
                <span className="text-[8px] font-mono tabular-nums text-yellow-400">
                  {amberCount} warn
                </span>
              )}
              {redCount > 0 && (
                <span className="text-[8px] font-mono tabular-nums text-red-400">
                  {redCount} fail
                </span>
              )}
            </div>
          )}
          {lastUpdated && (
            <span className="text-[8px] text-[var(--fintheon-text)]/25 font-mono tabular-nums">
              {timeAgo(lastUpdated)}
            </span>
          )}
          <button
            onClick={refresh}
            disabled={isLoading}
            className="p-1 rounded border border-[var(--fintheon-accent)]/20 text-[var(--fintheon-accent)]/50 hover:text-[var(--fintheon-accent)] hover:border-[var(--fintheon-accent)]/40 transition-colors disabled:opacity-30"
            title="Refresh"
          >
            <RefreshCw size={11} className={isLoading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2">
        {isLoading && !data && (
          <div className="text-[10px] font-mono text-[var(--fintheon-text)]/30 py-8 text-center uppercase tracking-wider">
            [LOADING...]
          </div>
        )}

        {error && (
          <div className="rounded border border-red-500/20 bg-red-500/5 p-3">
            <span className="text-[10px] text-red-400 font-mono">
              [ERROR: {error}]
            </span>
          </div>
        )}

        {data && data.length === 0 && (
          <div className="text-[10px] font-mono text-[var(--fintheon-text)]/30 py-8 text-center">
            No agent health data available
          </div>
        )}

        {data &&
          data.map((agent) => (
            <AgentHealthRow key={agent.agentId} agent={agent} />
          ))}
      </div>
    </div>
  );
}
