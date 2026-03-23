// [claude-code 2026-03-22] Track 3: Filter bar with agent dropdown (replaces chips)
import { Search } from 'lucide-react';
import type { BoardroomAgent } from './AgentBadge';
import { AgentFilterDropdown } from './AgentFilterDropdown';

interface ConsiliumFilterBarProps {
  agents: BoardroomAgent[];
  selectedAgents: BoardroomAgent[];
  onAgentsChange: (agents: BoardroomAgent[]) => void;
  search: string;
  onSearchChange: (search: string) => void;
  dateRange: 'today' | '7d' | '30d' | 'all';
  onDateRangeChange: (range: 'today' | '7d' | '30d' | 'all') => void;
  resultCount: number;
}

const DATE_OPTIONS = ['today', '7d', '30d', 'all'] as const;

export function ConsiliumFilterBar({
  agents,
  selectedAgents,
  onAgentsChange,
  search,
  onSearchChange,
  dateRange,
  onDateRangeChange,
  resultCount,
}: ConsiliumFilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-[var(--fintheon-accent)]/10 bg-[var(--fintheon-bg)] px-4 py-2">
      {/* Search input */}
      <div className="relative flex-shrink-0">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--fintheon-text)]/30" />
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search messages..."
          className="w-[180px] rounded-full border border-[var(--fintheon-accent)]/15 bg-[var(--fintheon-bg)] py-1.5 pl-8 pr-3 text-xs text-[var(--fintheon-text)] placeholder-[var(--fintheon-text)]/20 outline-none transition-colors focus:border-[var(--fintheon-accent)]/40"
        />
      </div>

      {/* Agent filter dropdown */}
      <AgentFilterDropdown agents={agents} selected={selectedAgents} onChange={onAgentsChange} />

      {/* Date range pills */}
      <div className="flex items-center gap-1">
        {DATE_OPTIONS.map((range) => (
          <button
            key={range}
            onClick={() => onDateRangeChange(range)}
            className={`rounded-full px-2.5 py-1 text-[10px] uppercase tracking-wider transition-colors ${
              dateRange === range
                ? 'border border-[var(--fintheon-accent)]/30 text-[var(--fintheon-accent)]'
                : 'border border-[var(--fintheon-accent)]/10 text-[var(--fintheon-text)]/30 hover:text-[var(--fintheon-text)]/60'
            }`}
          >
            {range === 'today' ? 'Today' : range === 'all' ? 'All' : range}
          </button>
        ))}
      </div>

      {/* Result count */}
      <span className="text-[10px] text-[var(--fintheon-text)]/30">{resultCount} messages</span>
    </div>
  );
}
