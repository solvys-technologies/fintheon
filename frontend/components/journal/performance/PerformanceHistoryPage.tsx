// [claude-code 2026-04-23] S30-T1 heatmaps + KPI flip — Page 2 history extracted from PerformanceJournal.
// [claude-code 2026-05-21] SOL-60: Use SessionHistoryRow (slim chevron rows) instead of DayHistoryCard.

import { SessionHistoryRow } from "../SessionHistoryRow";
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
        <span className="text-xs font-semibold text-(--fintheon-text)">
          {activeTab === "human" ? "Session History" : "Agent History"}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setWeekOffset((w) => w + 1)}
            disabled={weekOffset >= Math.floor(entries.length / 5)}
            className="px-2 py-0.5 text-[10px] bg-(--fintheon-surface) border border-(--fintheon-accent)/15 rounded text-(--fintheon-muted) hover:text-(--fintheon-text) disabled:opacity-30"
          >
            Older
          </button>
          <button
            onClick={() => setWeekOffset((w) => Math.max(0, w - 1))}
            disabled={weekOffset === 0}
            className="px-2 py-0.5 text-[10px] bg-(--fintheon-surface) border border-(--fintheon-accent)/15 rounded text-(--fintheon-muted) hover:text-(--fintheon-text) disabled:opacity-30"
          >
            Newer
          </button>
        </div>
      </div>

      {/* Column header */}
      {historyEntries.length > 0 && (
        <div className="flex items-center gap-3 px-3 text-[9px] uppercase tracking-wider text-(--fintheon-muted) font-medium">
          <span className="w-3.5 shrink-0" />
          <span className="w-[84px] shrink-0">Date</span>
          <span className="w-[60px] shrink-0">P&amp;L</span>
          <span className="w-[44px] shrink-0">Duration</span>
          <span className="w-[36px] shrink-0">
            {activeTab === "human" ? "Win%" : "Accept"}
          </span>
          <span className="w-[32px] shrink-0">ER</span>
          <span className="ml-auto shrink-0">Curve</span>
        </div>
      )}

      {historyEntries.length > 0 ? (
        <div className="space-y-1">
          {historyEntries.map((entry) => (
            <SessionHistoryRow
              key={entry.id}
              entry={entry}
              isAgentView={activeTab === "agent"}
            />
          ))}
        </div>
      ) : (
        <div className="flex items-center justify-center h-32 text-[10px] text-(--fintheon-muted)">
          No history entries
        </div>
      )}
    </div>
  );
}
