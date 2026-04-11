// [claude-code 2026-03-29] Boardroom overhaul: removed agent filter, rectangular timeframe bar, message count moved to status bar
// [claude-code 2026-03-22] Track 3: Filter bar with agent dropdown (replaces chips)
import { Search } from "lucide-react";

interface ConsiliumFilterBarProps {
  search: string;
  onSearchChange: (search: string) => void;
  dateRange: "today" | "7d" | "30d" | "all";
  onDateRangeChange: (range: "today" | "7d" | "30d" | "all") => void;
}

const DATE_OPTIONS = ["today", "7d", "30d", "all"] as const;

export function ConsiliumFilterBar({
  search,
  onSearchChange,
  dateRange,
  onDateRangeChange,
}: ConsiliumFilterBarProps) {
  return (
    <div className="flex items-center gap-3 border-b border-[var(--fintheon-accent)]/10 bg-[var(--fintheon-bg)] px-4 py-2">
      {/* Search input */}
      <div className="relative flex-shrink-0">
        <Search
          size={14}
          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--fintheon-text)]/30"
        />
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search messages..."
          className="w-[180px] rounded-full border border-[var(--fintheon-accent)]/15 bg-[var(--fintheon-bg)] py-1.5 pl-8 pr-3 text-xs text-[var(--fintheon-text)] placeholder-[var(--fintheon-text)]/20 outline-none transition-colors focus:border-[var(--fintheon-accent)]/40"
        />
      </div>

      <div className="flex-1" />
    </div>
  );
}
