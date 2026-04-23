import { useState } from "react";
import { Bot, History, ChevronDown, ChevronUp } from "lucide-react";
import type { JournalEntryItem } from "../../../lib/services";

interface AgentProposalTrackerProps {
  agentEntries: JournalEntryItem[];
  pastProposals: any[];
}

function ProposalRow({
  proposal,
}: {
  proposal: NonNullable<JournalEntryItem["proposals"]>[number];
}) {
  const statusColor = {
    proposed: "text-[var(--fintheon-accent)]",
    accepted: "text-emerald-400",
    rejected: "text-red-400",
    expired: "text-gray-500",
  }[proposal.status];

  const outcomeColors: Record<string, string> = {
    win: "text-emerald-400",
    loss: "text-red-400",
    breakeven: "text-gray-400",
  };
  const outcomeColor =
    (proposal.outcome && outcomeColors[proposal.outcome]) ??
    "text-[var(--fintheon-muted)]";

  return (
    <div className="flex items-center justify-between py-1.5 border-b border-[var(--fintheon-accent)]/5 last:border-0">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-mono text-[var(--fintheon-accent)]">
          {proposal.ticker}
        </span>
        <span
          className={`text-[9px] uppercase ${proposal.direction === "long" ? "text-emerald-400" : "text-red-400"}`}
        >
          {proposal.direction}
        </span>
        <span className={`text-[9px] ${statusColor}`}>{proposal.status}</span>
      </div>
      <div className="flex items-center gap-3 text-[10px]">
        {proposal.entry && (
          <span className="text-[var(--fintheon-muted)] font-mono">
            {proposal.entry.toFixed(2)}
          </span>
        )}
        {proposal.outcome && (
          <span className={`font-mono ${outcomeColor}`}>
            {proposal.outcome}
          </span>
        )}
        {typeof proposal.pnl === "number" && (
          <span
            className={`font-mono ${proposal.pnl >= 0 ? "text-emerald-400" : "text-red-400"}`}
          >
            {proposal.pnl >= 0 ? "+" : ""}
            {proposal.pnl.toFixed(2)}
          </span>
        )}
      </div>
    </div>
  );
}

export function AgentProposalTracker({
  agentEntries,
  pastProposals,
}: AgentProposalTrackerProps) {
  const [expandedDate, setExpandedDate] = useState<string | null>(null);

  return (
    <>
      <div className="bg-[var(--fintheon-surface)] border border-[var(--fintheon-accent)]/10 rounded-lg p-3">
        <div className="flex items-center gap-2 mb-2">
          <Bot className="w-3.5 h-3.5 text-[var(--fintheon-accent)]" />
          <span className="text-xs font-semibold text-[var(--fintheon-text)]">
            Proposal Tracker
          </span>
        </div>
        {agentEntries.length === 0 ? (
          <div className="text-[10px] text-[var(--fintheon-muted)] py-4 text-center">
            No agent proposals recorded yet
          </div>
        ) : (
          <div className="space-y-1">
            {agentEntries.map((entry) => {
              const isExpanded = expandedDate === entry.date;
              return (
                <div key={entry.id} className="bg-black/20 rounded">
                  <button
                    onClick={() =>
                      setExpandedDate(isExpanded ? null : entry.date)
                    }
                    className="w-full flex items-center justify-between px-2.5 py-2 text-[11px] hover:bg-[var(--fintheon-accent)]/5 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-[var(--fintheon-muted)] font-mono">
                        {entry.date}
                      </span>
                      {entry.agentName && (
                        <span className="text-[var(--fintheon-accent)]">
                          {entry.agentName}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[var(--fintheon-muted)]">
                        {entry.acceptedCount ?? 0}/{entry.proposalCount ?? 0}
                      </span>
                      {typeof entry.winRate === "number" && (
                        <span
                          className={`font-mono ${entry.winRate >= 50 ? "text-emerald-400" : "text-red-400"}`}
                        >
                          {entry.winRate.toFixed(0)}%
                        </span>
                      )}
                      {typeof entry.totalPnl === "number" && (
                        <span
                          className={`font-mono ${entry.totalPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}
                        >
                          {entry.totalPnl >= 0 ? "+" : ""}$
                          {entry.totalPnl.toFixed(0)}
                        </span>
                      )}
                      {isExpanded ? (
                        <ChevronUp className="w-3 h-3 text-[var(--fintheon-muted)]" />
                      ) : (
                        <ChevronDown className="w-3 h-3 text-[var(--fintheon-muted)]" />
                      )}
                    </div>
                  </button>
                  {isExpanded &&
                    entry.proposals &&
                    entry.proposals.length > 0 && (
                      <div className="px-2.5 pb-2">
                        {entry.proposals.map((p) => (
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

      <div className="bg-[var(--fintheon-surface)] border border-[var(--fintheon-accent)]/10 rounded-lg p-3">
        <div className="flex items-center gap-2 mb-2">
          <History className="w-3.5 h-3.5 text-[var(--fintheon-accent)]" />
          <span className="text-xs font-semibold text-[var(--fintheon-text)]">
            Past Proposals
          </span>
          <span className="text-[9px] text-[var(--fintheon-muted)] ml-auto">
            {pastProposals.length} recent
          </span>
        </div>
        {pastProposals.length === 0 ? (
          <div className="text-[10px] text-[var(--fintheon-muted)] py-4 text-center">
            No proposals in history
          </div>
        ) : (
          <div className="space-y-0">
            {pastProposals.map((p: any) => {
              const outcome = (() => {
                if (p.status === "executed" && p.executionResult) {
                  const pnl =
                    p.executionResult?.pnl ?? p.executionResult?.realizedPnl;
                  if (typeof pnl === "number") return pnl >= 0 ? "win" : "loss";
                }
                if (["pending", "approved"].includes(p.status))
                  return "pending";
                if (["rejected", "expired", "cancelled"].includes(p.status))
                  return "closed";
                return "pending";
              })();
              return (
                <div
                  key={p.id}
                  className="flex items-center justify-between py-1.5 border-b border-[var(--fintheon-accent)]/5 last:border-0"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-[var(--fintheon-accent)]">
                      {p.instrument}
                    </span>
                    <span
                      className={`text-[9px] ${p.direction === "long" ? "text-emerald-400" : p.direction === "short" ? "text-red-400" : "text-gray-400"}`}
                    >
                      {p.direction === "long"
                        ? "↑"
                        : p.direction === "short"
                          ? "↓"
                          : "-"}
                    </span>
                    <span className="text-[9px] text-[var(--fintheon-muted)]">
                      {p.strategyName}
                    </span>
                    <span className="text-[9px] text-[var(--fintheon-muted)] font-mono">
                      {p.createdAt?.slice(0, 10)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {p.entryPrice && (
                      <span className="text-[10px] text-[var(--fintheon-muted)] font-mono">
                        {Number(p.entryPrice).toFixed(2)}
                      </span>
                    )}
                    {outcome === "win" && (
                      <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full px-2 py-0.5 text-[9px] uppercase font-medium">
                        WIN
                      </span>
                    )}
                    {outcome === "loss" && (
                      <span className="bg-red-500/20 text-red-400 border border-red-500/30 rounded-full px-2 py-0.5 text-[9px] uppercase font-medium">
                        LOSS
                      </span>
                    )}
                    {outcome === "pending" && (
                      <span className="bg-gray-500/20 text-gray-400 border border-gray-500/30 rounded-full px-2 py-0.5 text-[9px] uppercase font-medium">
                        PENDING
                      </span>
                    )}
                    {outcome === "closed" && (
                      <span className="bg-gray-500/10 text-gray-500 border border-gray-500/20 rounded-full px-2 py-0.5 text-[9px] uppercase font-medium">
                        {p.status}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
