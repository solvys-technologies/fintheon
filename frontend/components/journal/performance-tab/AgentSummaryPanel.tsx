import { BarChart3 } from "lucide-react";
import type { JournalSummaryResponse } from "../../../lib/services";

interface AgentSummaryPanelProps {
  summary: JournalSummaryResponse | null;
}

export function AgentSummaryPanel({ summary }: AgentSummaryPanelProps) {
  if (!summary) return null;

  return (
    <div className="bg-[var(--fintheon-surface)] border border-[var(--fintheon-accent)]/10 rounded-lg p-3">
      <div className="flex items-center gap-2 mb-2">
        <BarChart3 className="w-3.5 h-3.5 text-[var(--fintheon-accent)]" />
        <span className="text-xs font-semibold text-[var(--fintheon-text)]">
          30-Day Summary
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2 text-[10px]">
        <div>
          <div className="text-[var(--fintheon-muted)]">Entries</div>
          <div className="text-[var(--fintheon-text)] font-mono">
            {summary.totalEntries}
          </div>
        </div>
        <div>
          <div className="text-[var(--fintheon-muted)]">Discipline</div>
          <div className="text-[var(--fintheon-text)] font-mono">
            {summary.avgDisciplineScore}%
          </div>
        </div>
        <div>
          <div className="text-[var(--fintheon-muted)]">Streak</div>
          <div className="text-[var(--fintheon-accent)] font-mono">
            {summary.streakDays}d
          </div>
        </div>
      </div>
    </div>
  );
}
