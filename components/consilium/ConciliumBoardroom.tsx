// [claude-code 2026-03-19] ConciliumBoardroom — Agent boardroom chat history with timeline and filters
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { RefreshCw, Wifi, WifiOff, Filter, Clock, MessageSquare } from 'lucide-react';
import { ConsiliumMessage, type BoardroomMessage } from './ConsiliumMessage';
import { AgentBadge, type BoardroomAgent } from './AgentBadge';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080';
const POLL_INTERVAL = 30000; // 30 seconds auto-refresh

const ALL_AGENTS: BoardroomAgent[] = ['Harper-Hermes', 'Oracle', 'Feucht', 'Consul', 'Herald', 'Unknown'];

type ViewMode = 'chat' | 'timeline';
type TimeRange = 'all' | '24h' | '7d';

interface ConciliumBoardroomProps {
  isActive?: boolean; // Whether boardroom view is currently visible
  initialView?: ViewMode;
}

export function ConciliumBoardroom({ isActive = true, initialView = 'chat' }: ConciliumBoardroomProps) {
  const [messages, setMessages] = useState<BoardroomMessage[]>([]);
  const [isOnline, setIsOnline] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  
  // Filters
  const [selectedAgents, setSelectedAgents] = useState<BoardroomAgent[]>([]);
  const [timeRange, setTimeRange] = useState<TimeRange>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>(initialView);
  
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/boardroom/messages`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setMessages(data.messages || []);
      setIsOnline(true);
      setLastRefresh(new Date());
    } catch {
      setIsOnline(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Auto-refresh when boardroom is active
  useEffect(() => {
    if (!isActive) {
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }
    
    pollRef.current = setInterval(fetchMessages, POLL_INTERVAL);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [isActive, fetchMessages]);

  // Filter functions
  const toggleAgentFilter = (agent: BoardroomAgent) => {
    setSelectedAgents((prev) =>
      prev.includes(agent) ? prev.filter((a) => a !== agent) : [...prev, agent]
    );
  };

  const clearAllFilters = () => {
    setSelectedAgents([]);
    setTimeRange('all');
    setSearchQuery('');
  };

  // Filtered messages
  const filteredMessages = useMemo(() => {
    let filtered = [...messages];
    
    // Agent filter
    if (selectedAgents.length > 0) {
      filtered = filtered.filter((msg) => selectedAgents.includes(msg.agent));
    }
    
    // Time range filter
    const now = Date.now();
    const timeLimits: Record<TimeRange, number> = {
      all: 0,
      '24h': now - 24 * 60 * 60 * 1000,
      '7d': now - 7 * 24 * 60 * 60 * 1000,
    };
    const limit = timeLimits[timeRange];
    if (limit > 0) {
      filtered = filtered.filter((msg) => new Date(msg.timestamp).getTime() >= limit);
    }
    
    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((msg) =>
        msg.content.toLowerCase().includes(query) ||
        msg.agent.toLowerCase().includes(query)
      );
    }
    
    return filtered;
  }, [messages, selectedAgents, timeRange, searchQuery]);

  // Key developments (messages with structured content like alerts, trade ideas, insights)
  const developments = useMemo(() => {
    return filteredMessages.filter((msg) => {
      const content = msg.content.toLowerCase();
      return (
        content.includes('[risk alert]') ||
        content.includes('[trade idea]') ||
        content.includes('[overtrading]') ||
        content.includes('[rule violation]') ||
        content.includes('**') || // Markdown headers indicate important content
        msg.role === 'system'
      );
    });
  }, [filteredMessages]);

  // Statistics
  const stats = useMemo(() => {
    const counts: Record<string, number> = {};
    messages.forEach((msg) => {
      counts[msg.agent] = (counts[msg.agent] || 0) + 1;
    });
    return counts;
  }, [messages]);

  return (
    <div className="flex h-full flex-col bg-[#050402]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#c79f4a]/15 px-5 py-3">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-medium uppercase tracking-[0.2em] text-[#c79f4a]">
            Concilium Boardroom
          </h2>
          <div className="flex items-center gap-1.5">
            {isOnline ? (
              <Wifi size={12} className="text-[#c79f4a]/60" />
            ) : (
              <WifiOff size={12} className="text-red-500/60" />
            )}
            <span className="text-[10px] text-[#f0ead6]/30">
              {isOnline ? 'Connected' : 'Offline'}
            </span>
          </div>
          {lastRefresh && (
            <span className="text-[9px] text-[#f0ead6]/20">
              Last: {lastRefresh.toLocaleTimeString()}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* View mode toggle */}
          <div className="flex rounded-full border border-[#c79f4a]/20 bg-[#0a0a00] p-0.5">
            <button
              onClick={() => setViewMode('chat')}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs transition-colors ${
                viewMode === 'chat'
                  ? 'bg-[#c79f4a]/15 text-[#c79f4a]'
                  : 'text-[#f0ead6]/40 hover:text-[#f0ead6]/60'
              }`}
            >
              <MessageSquare size={12} />
              Chat
            </button>
            <button
              onClick={() => setViewMode('timeline')}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs transition-colors ${
                viewMode === 'timeline'
                  ? 'bg-[#c79f4a]/15 text-[#c79f4a]'
                  : 'text-[#f0ead6]/40 hover:text-[#f0ead6]/60'
              }`}
            >
              <Clock size={12} />
              Timeline
            </button>
          </div>
          {/* Refresh button */}
          <button
            onClick={fetchMessages}
            className="rounded-full p-1.5 text-[#c79f4a]/40 transition-colors hover:bg-[#c79f4a]/10 hover:text-[#c79f4a]"
            title="Refresh"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="border-b border-[#c79f4a]/10 bg-[#0a0a00]/50 px-5 py-3">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search messages..."
              className="w-48 rounded-full border border-[#c79f4a]/15 bg-[#050402] px-3 py-1.5 text-xs text-[#f0ead6] placeholder-[#f0ead6]/20 outline-none transition-colors focus:border-[#c79f4a]/40"
            />
          </div>
          
          {/* Agent filters */}
          <div className="flex items-center gap-2">
            <Filter size={12} className="text-[#f0ead6]/30" />
            <span className="text-[10px] uppercase tracking-wider text-[#f0ead6]/30">Agents:</span>
            <div className="flex flex-wrap gap-1.5">
              {ALL_AGENTS.filter((a) => a !== 'Unknown').map((agent) => (
                <button
                  key={agent}
                  onClick={() => toggleAgentFilter(agent)}
                  className={`rounded-full border px-2 py-1 text-xs transition-all ${
                    selectedAgents.includes(agent)
                      ? 'border-[#c79f4a]/40 bg-[#c79f4a]/15 text-[#c79f4a]'
                      : 'border-[#c79f4a]/15 bg-[#050402] text-[#f0ead6]/50 hover:border-[#c79f4a]/30'
                  }`}
                >
                  {agent === 'Harper-Hermes' ? 'Harper' : agent}
                  {stats[agent] !== undefined && (
                    <span className="ml-1 text-[9px] opacity-50">({stats[agent]})</span>
                  )}
                </button>
              ))}
            </div>
          </div>
          
          {/* Time range */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-wider text-[#f0ead6]/30">Time:</span>
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value as TimeRange)}
              className="rounded-full border border-[#c79f4a]/15 bg-[#050402] px-2 py-1 text-xs text-[#f0ead6] outline-none focus:border-[#c79f4a]/40"
            >
              <option value="all">All Time</option>
              <option value="24h">Last 24h</option>
              <option value="7d">Last 7d</option>
            </select>
          </div>
          
          {/* Clear filters */}
          {(selectedAgents.length > 0 || timeRange !== 'all' || searchQuery) && (
            <button
              onClick={clearAllFilters}
              className="text-xs text-[#c79f4a]/50 hover:text-[#c79f4a]"
            >
              Clear all
            </button>
          )}
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <span className="text-xs text-[#f0ead6]/30">Loading boardroom transcript...</span>
          </div>
        ) : viewMode === 'chat' ? (
          /* Chat View */
          <div className="flex h-full flex-col">
            <div className="flex-1 overflow-y-auto py-2">
              {filteredMessages.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-2 px-6">
                  <span className="text-sm text-[#c79f4a]/40">No messages match filters</span>
                  <span className="text-center text-xs text-[#f0ead6]/20">
                    Adjust your filters or wait for new deliberations.
                  </span>
                </div>
              ) : (
                filteredMessages.map((msg) => (
                  <ConsiliumMessage key={msg.id} message={msg} />
                ))
              )}
            </div>
          </div>
        ) : (
          /* Timeline View */
          <div className="flex h-full flex-col">
            {/* Developments Timeline */}
            <div className="flex-1 overflow-y-auto p-5">
              {developments.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-2">
                  <Clock size={32} className="text-[#c79f4a]/20" />
                  <span className="text-sm text-[#c79f4a]/40">No key developments yet</span>
                  <span className="text-center text-xs text-[#f0ead6]/20">
                    Alerts, trade ideas, and insights will appear here.
                  </span>
                </div>
              ) : (
                <div className="relative">
                  {/* Timeline line */}
                  <div className="absolute left-4 top-0 h-full w-px bg-[#c79f4a]/20" />
                  
                  {developments.map((msg, idx) => (
                    <div key={msg.id} className="relative mb-4 pl-10">
                      {/* Timeline dot */}
                      <div className="absolute left-3 top-3 h-2 w-2 -translate-x-1/2 rounded-full bg-[#c79f4a]" />
                      
                      {/* Development card */}
                      <div className="rounded-lg border border-[#c79f4a]/15 bg-[#0a0a00] p-3 transition-colors hover:border-[#c79f4a]/30">
                        <div className="mb-2 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <AgentBadge agent={msg.agent} size="sm" />
                            <span className="text-[10px] text-[#f0ead6]/30">
                              {new Date(msg.timestamp).toLocaleString()}
                            </span>
                          </div>
                        </div>
                        <div className="prose prose-invert prose-sm max-w-none">
                          <p
                            className="whitespace-pre-wrap text-sm text-[#f0ead6]/90"
                            dangerouslySetInnerHTML={{
                              __html: msg.content
                                .replace(/\*\*(.*?)\*\*/g, '<strong class="text-[#c79f4a]">$1</strong>')
                                .replace(/\[(.*?)\]/g, '<span class="text-[#c79f4a]/70">[$1]</span>'),
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer stats */}
      <div className="border-t border-[#c79f4a]/10 bg-[#0a0a00]/50 px-5 py-2">
        <div className="flex items-center justify-between text-[10px] text-[#f0ead6]/30">
          <span>{filteredMessages.length} messages</span>
          {selectedAgents.length > 0 && (
            <span>
              Filtering: {selectedAgents.map((a) => (a === 'Harper-Hermes' ? 'Harper' : a)).join(', ')}
            </span>
          )}
          <span>Developments: {developments.length}</span>
        </div>
      </div>
    </div>
  );
}
