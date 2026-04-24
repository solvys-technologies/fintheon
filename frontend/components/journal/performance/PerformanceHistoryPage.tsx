// [claude-code 2026-04-23] S30-T1 heatmaps + KPI flip — Page 2 history extracted from PerformanceJournal.

import { DayHistoryCard } from "../DayHistoryCard";
import type { JournalEntryItem } from "../../../lib/services";

interface PerformanceHistoryPageProps {
  entries: JournalEntryItem[];
  historyEntries: JournalEntryItem[];
  activeTab: "human" | "agent";
  weekOffset: number;
  setWeekOffset: (fn: (w: number) => number) => void;
}

export function PerformanceHistoryPage({
  entries,
  historyEntries,
  activeTab,
  weekOffset,
  setWeekOffset,
}: PerformanceHistoryPageProps) {
  return (
    <div className="min-h-full snap-start flex flex-col px-3 py-3 gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-[var(--fintheon-text)]">
          {activeTab === "human" ? "Session History" : "Agent History"}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setWeekOffset((w) => w + 1)}
            disabled={weekOffset >= Math.floor(entries.length / 5)}
            className="px-2 py-0.5 text-[10px] bg-[var(--fintheon-surface)] border border-[var(--fintheon-accent)]/15 rounded text-[var(--fintheon-muted)] hover:text-[var(--fintheon-text)] disabled:opacity-30"
          >
            Older
          </button>
          <button
            onClick={() => setWeekOffset((w) => Math.max(0, w - 1))}
            disabled={weekOffset === 0}
            className="px-2 py-0.5 text-[10px] bg-[var(--fintheon-surface)] border border-[var(--fintheon-accent)]/15 rounded text-[var(--fintheon-muted)] hover:text-[var(--fintheon-text)] disabled:opacity-30"
          >
            Newer
          </button>
        </div>
      </div>

      {historyEntries.length > 0 ? (
        <div className="space-y-2">
          {historyEntries.map((entry) => (
            <DayHistoryCard
              key={entry.id}
              date={entry.date}
              pnl={entry.totalPnl ?? 0}
              notes={entry.notes}
              erScore={
                entry.erTrend?.length
                  ? entry.erTrend[entry.erTrend.length - 1]
                  : undefined
              }
              isAgentView={activeTab === "agent"}
              agentName={entry.agentName}
              winRate={entry.winRate}
              proposalCount={entry.proposalCount}
            />
          ))}
        </div>
      ) : (
        <div className="flex items-center justify-center h-32 text-[10px] text-[var(--fintheon-muted)]">
          No history entries
        </div>
      )}
    </div>
  );
}
