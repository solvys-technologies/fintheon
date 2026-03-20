// [claude-code 2026-03-19] Search/filter controls for Consilium message history
import { Search } from 'lucide-react';
import { AgentBadge, type BoardroomAgent } from './AgentBadge';

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
  const toggleAgent = (agent: BoardroomAgent) => {
    if (selectedAgents.includes(agent)) {
      onAgentsChange(selectedAgents.filter((a) => a !== agent));
    } else {
      onAgentsChange([...selectedAgents, agent]);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-[#c79f4a]/10 bg-[#0a0a00] px-4 py-2">
      {/* Search input */}
      <div className="relative flex-shrink-0">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#f0ead6]/30" />
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search messages..."
          className="w-[180px] rounded-full border border-[#c79f4a]/15 bg-[#050402] py-1.5 pl-8 pr-3 text-xs text-[#f0ead6] placeholder-[#f0ead6]/20 outline-none transition-colors focus:border-[#c79f4a]/40"
        />
      </div>

      {/* Agent chips */}
      <div className="flex flex-1 flex-wrap items-center justify-center gap-1.5">
        {agents.map((agent) => {
          const active = selectedAgents.includes(agent);
          return (
            <button
              key={agent}
              onClick={() => toggleAgent(agent)}
              className={`rounded-full border px-2.5 py-1 transition-colors ${
                active
                  ? 'border-[#c79f4a]/50 bg-[#c79f4a]/15'
                  : 'border-[#c79f4a]/15 bg-transparent hover:border-[#c79f4a]/30'
              }`}
            >
              <AgentBadge agent={agent} size="sm" />
            </button>
          );
        })}
      </div>

      {/* Date range buttons */}
      <div className="flex items-center gap-1">
        {DATE_OPTIONS.map((range) => (
          <button
            key={range}
            onClick={() => onDateRangeChange(range)}
            className={`rounded-full px-2.5 py-1 text-[10px] uppercase tracking-wider transition-colors ${
              dateRange === range
                ? 'border border-[#c79f4a]/50 bg-[#c79f4a]/15 text-[#c79f4a]'
                : 'border border-[#c79f4a]/15 text-[#f0ead6]/30 hover:text-[#f0ead6]/60'
            }`}
          >
            {range === 'today' ? 'Today' : range === 'all' ? 'All' : range}
          </button>
        ))}
      </div>

      {/* Result count */}
      <span className="text-[10px] text-[#f0ead6]/30">{resultCount} messages</span>
    </div>
  );
}
