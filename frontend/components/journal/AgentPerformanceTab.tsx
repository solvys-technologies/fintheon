import { useState, useEffect, useMemo } from "react";
import { useBackend } from "../../lib/backend";
import type {
  JournalEntryItem,
  JournalSummaryResponse,
  AgentPerformanceResponse,
} from "../../lib/services";
import { AgentKpiStats } from "./performance-tab/AgentKpiStats";
import { AgentBreakdownTable } from "./performance-tab/AgentBreakdownTable";
import { AgentProposalTracker } from "./performance-tab/AgentProposalTracker";
import { AgentSummaryPanel } from "./performance-tab/AgentSummaryPanel";

interface AgentPerformanceTabProps {
  entries: JournalEntryItem[];
  summary: JournalSummaryResponse | null;
}

export function AgentPerformanceTab({
  entries,
  summary,
}: AgentPerformanceTabProps) {
  const backend = useBackend();
  const [performance, setPerformance] =
    useState<AgentPerformanceResponse | null>(null);
  const [pastProposals, setPastProposals] = useState<any[]>([]);

  useEffect(() => {
    backend.agentPerformance.getPerformance(30).then(setPerformance);
    backend.autopilot
      .getHistory(20)
      .then((res) => setPastProposals(res.proposals ?? []));
  }, [backend]);

  const agentEntries = useMemo(
    () => entries.filter((e) => e.type === "agent").slice(0, 14),
    [entries],
  );

  const agentEntryProposals = agentEntries.reduce(
    (s, e) => s + (e.proposalCount ?? 0),
    0,
  );
  const agentEntryAccepted = agentEntries.reduce(
    (s, e) => s + (e.acceptedCount ?? 0),
    0,
  );

  return (
    <div className="space-y-4">
      <AgentKpiStats
        performance={performance}
        summary={summary}
        agentEntryProposals={agentEntryProposals}
        agentEntryAccepted={agentEntryAccepted}
      />
      <AgentBreakdownTable performance={performance} />
      <AgentProposalTracker
        agentEntries={agentEntries}
        pastProposals={pastProposals}
      />
      <AgentSummaryPanel summary={summary} />
    </div>
  );
}
