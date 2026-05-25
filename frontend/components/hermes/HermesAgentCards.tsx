// [claude-code 2026-03-16] Hermes Command Center: agent status cards sub-component
import type {
  FintheonAgent,
  AgentStatus,
} from "../../contexts/FintheonAgentContext";

const STATUS_DOT: Record<AgentStatus, string> = {
  working: "bg-emerald-500",
  idle: "bg-yellow-500",
  offline: "bg-red-500",
  blocked: "bg-orange-500",
};

const STATUS_LABEL: Record<AgentStatus, string> = {
  working: "Working",
  idle: "Idle",
  offline: "Offline",
  blocked: "Blocked",
};

interface HermesAgentCardsProps {
  agents: FintheonAgent[];
}

export function HermesAgentCards({ agents }: HermesAgentCardsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
      {agents.map((agent) => (
        <div
          key={agent.id}
          className="flex flex-col gap-2 text-right"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-full bg-[var(--fintheon-accent)]/15 text-[var(--fintheon-accent)] text-xs font-bold flex items-center justify-center">
                {agent.icon}
              </span>
            </div>
            <div className="flex min-w-0 flex-col items-end gap-1 text-right">
              <span className="text-sm font-semibold text-[var(--fintheon-text)]">
                {agent.name}
              </span>
              <div className="flex items-center justify-end gap-1.5">
              <span
                className={`w-2 h-2 rounded-full ${STATUS_DOT[agent.status]}`}
              />
              <span className="text-[10px] text-zinc-400">
                {STATUS_LABEL[agent.status]}
              </span>
              </div>
            </div>
          </div>
          <div className="text-right text-[10px] text-[var(--fintheon-accent)]/70 font-medium tracking-wider uppercase">
            {agent.sector}
          </div>
          <p className="text-right text-[11px] text-zinc-500 leading-relaxed">
            {agent.description}
          </p>
          <div className="text-right text-[10px] text-zinc-600 font-mono mt-auto">
            {agent.model}
          </div>
        </div>
      ))}
    </div>
  );
}
