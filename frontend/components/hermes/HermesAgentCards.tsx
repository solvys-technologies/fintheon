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
          className="bg-[var(--fintheon-surface)] border border-[var(--fintheon-accent)]/20 rounded-lg p-4 flex flex-col gap-2"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-full bg-[var(--fintheon-accent)]/15 text-[var(--fintheon-accent)] text-xs font-bold flex items-center justify-center">
                {agent.icon}
              </span>
              <span className="text-sm font-semibold text-[var(--fintheon-text)]">
                {agent.name}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span
                className={`w-2 h-2 rounded-full ${STATUS_DOT[agent.status]}`}
              />
              <span className="text-[10px] text-zinc-400">
                {STATUS_LABEL[agent.status]}
              </span>
            </div>
          </div>
          <div className="text-[10px] text-[var(--fintheon-accent)]/70 font-medium tracking-wider uppercase">
            {agent.sector}
          </div>
          <p className="text-[11px] text-zinc-500 leading-relaxed">
            {agent.description}
          </p>
          <div className="text-[10px] text-zinc-600 font-mono mt-auto">
            {agent.model}
          </div>
        </div>
      ))}
    </div>
  );
}
