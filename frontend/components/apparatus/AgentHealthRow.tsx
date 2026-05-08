// [claude-code 2026-05-05] S59-T3: AgentHealthRow — individual agent health row with expandable detail.
// Glassmorphic surface, status dot, inline metrics, click-to-expand detail panel.
import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  HardDrive,
  Brain,
  GitMerge,
  Activity,
} from "lucide-react";
import { PersonaBadge } from "./PersonaBadge";
import type { AgentHealthEntry } from "../../hooks/useAgentHealth";

interface AgentHealthRowProps {
  agent: AgentHealthEntry;
}

function timeAgo(iso: string | null): string {
  if (!iso) return "never";
  const diff = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diff)) return "never";
  if (diff < 60_000) return "<1m ago";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

const STATUS_DOT: Record<string, string> = {
  green: "bg-emerald-500",
  amber: "bg-yellow-500",
  red: "bg-red-500",
};

const AGENT_LABELS: Record<string, string> = {
  harper: "Harper",
  oracle: "Oracle",
  feucht: "Feucht",
  consul: "Consul",
  herald: "Herald",
};

export function AgentHealthRow({ agent }: AgentHealthRowProps) {
  const [expanded, setExpanded] = useState(false);
  const label = AGENT_LABELS[agent.agentId] ?? agent.agentId;

  return (
    <div
      className="border rounded border-[var(--fintheon-accent)]/10 bg-[var(--fintheon-bg)]/70 backdrop-blur-sm transition-colors hover:border-[var(--fintheon-accent)]/20 cursor-pointer"
      onClick={() => setExpanded(!expanded)}
    >
      {/* Row header: agent name, role, status dot, key metrics */}
      <div className="flex items-center justify-between px-3 py-2 gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[agent.personaHealth]}`}
          />
          <div className="flex items-baseline gap-1.5 min-w-0">
            <span className="text-[11px] font-semibold text-[var(--fintheon-text)] tracking-wide truncate">
              {label}
            </span>
            <span className="text-[9px] text-[var(--fintheon-accent)]/50 font-mono uppercase shrink-0">
              {agent.role}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {/* SOUL version */}
          <span className="text-[9px] text-[var(--fintheon-text)]/40 font-mono tabular-nums">
            {agent.soulLoaded ? `v${agent.soulVersion}` : "—"}
          </span>

          {/* Memory count */}
          <span className="flex items-center gap-1 text-[9px] text-[var(--fintheon-text)]/50 font-mono tabular-nums">
            <HardDrive size={9} className="text-[var(--fintheon-accent)]/40" />
            {agent.memoryCount}
          </span>

          {/* REFLECT score */}
          <span className="text-[9px] text-[var(--fintheon-text)]/50 font-mono tabular-nums">
            {agent.reflectScore !== null ? agent.reflectScore.toFixed(2) : "—"}
          </span>

          {/* GEPA PRs */}
          <span className="flex items-center gap-1 text-[9px] text-[var(--fintheon-text)]/50 font-mono tabular-nums">
            <GitMerge size={9} className="text-[var(--fintheon-accent)]/40" />
            {agent.gepaOpenPrs}
          </span>

          {/* Persona badge */}
          <PersonaBadge status={agent.personaHealth} compact />

          {/* Expand chevron */}
          <span className="text-[var(--fintheon-accent)]/30">
            {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </span>
        </div>
      </div>

      {/* Expanded detail panel */}
      {expanded && (
        <div className="border-t border-[var(--fintheon-accent)]/10 px-3 py-2.5 space-y-2.5">
          {/* SOUL status */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-1.5">
              <Activity size={9} className="text-[var(--fintheon-accent)]/50" />
              <span className="text-[9px] text-[var(--fintheon-accent)]/40 font-mono uppercase tracking-wider">
                SOUL Load
              </span>
            </div>
            <div className="text-right">
              <span
                className={`text-[9px] font-mono ${agent.soulLoaded ? "text-emerald-400" : "text-red-400"}`}
              >
                {agent.soulLoaded ? "Loaded" : "Failed"}
              </span>
              {agent.soulVersion && (
                <span className="text-[8px] text-[var(--fintheon-text)]/30 font-mono ml-1.5">
                  v{agent.soulVersion}
                </span>
              )}
            </div>
          </div>

          {/* Native home */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] text-[var(--fintheon-accent)]/40 font-mono uppercase tracking-wider">
                Native Home
              </span>
            </div>
            <span
              className={`text-[9px] font-mono ${agent.nativeHomeIntact ? "text-emerald-400" : agent.soulLoaded ? "text-yellow-400" : "text-red-400"}`}
            >
              {!agent.soulLoaded
                ? "N/A"
                : agent.nativeHomeIntact
                  ? "All fields present"
                  : "Missing fields"}
            </span>
          </div>

          {/* REFLECT */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-1.5">
              <Brain size={9} className="text-[var(--fintheon-accent)]/50" />
              <span className="text-[9px] text-[var(--fintheon-accent)]/40 font-mono uppercase tracking-wider">
                REFLECT
              </span>
            </div>
            <div className="text-right">
              {agent.reflectScore !== null ? (
                <span className="text-[9px] font-mono text-[var(--fintheon-accent)] tabular-nums">
                  {agent.reflectScore.toFixed(3)}
                </span>
              ) : (
                <span className="text-[9px] text-[var(--fintheon-text)]/30 font-mono">
                  No data
                </span>
              )}
              {agent.reflectLastRun && (
                <span className="text-[8px] text-[var(--fintheon-text)]/30 font-mono ml-1.5">
                  {timeAgo(agent.reflectLastRun)}
                </span>
              )}
            </div>
          </div>

          {/* GEPA */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-1.5">
              <GitMerge size={9} className="text-[var(--fintheon-accent)]/50" />
              <span className="text-[9px] text-[var(--fintheon-accent)]/40 font-mono uppercase tracking-wider">
                GEPA
              </span>
            </div>
            <div className="text-right">
              <span className="text-[9px] font-mono text-[var(--fintheon-text)]/60 tabular-nums">
                {agent.gepaOpenPrs} open
              </span>
              {agent.gepaLastRun && (
                <span className="text-[8px] text-[var(--fintheon-text)]/30 font-mono ml-1.5">
                  {timeAgo(agent.gepaLastRun)}
                </span>
              )}
              {!agent.gepaLastRun && (
                <span className="text-[8px] text-[var(--fintheon-text)]/30 font-mono ml-1.5">
                  never
                </span>
              )}
            </div>
          </div>

          {/* Memories */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-1.5">
              <HardDrive
                size={9}
                className="text-[var(--fintheon-accent)]/50"
              />
              <span className="text-[9px] text-[var(--fintheon-accent)]/40 font-mono uppercase tracking-wider">
                Memories
              </span>
            </div>
            <span className="text-[9px] font-mono text-[var(--fintheon-text)]/60 tabular-nums">
              {agent.memoryCount} stored
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
