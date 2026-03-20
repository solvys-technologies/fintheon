// [claude-code 2026-03-20] S3:T2c — Boardroom with rich input (persona pills, think harder, skills)
// [claude-code 2026-03-20] Consilium — agent chat panel (chat-only, sub-tabs moved to ConsiliumHub)
import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, RefreshCw, Wifi, WifiOff, Brain, Zap, ChevronDown } from 'lucide-react';
import { ConsiliumMessage, type BoardroomMessage } from './ConsiliumMessage';
import { AGENT_MAP, type BoardroomAgent } from './AgentBadge';
import { ConsiliumFilterBar } from './ConsiliumFilterBar';
import { ConsiliumMessageExpanded } from './ConsiliumMessageExpanded';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080';
const POLL_INTERVAL = 30_000;

const MENTIONABLE_AGENTS: BoardroomAgent[] = ['Harper-Hermes', 'Oracle', 'Feucht', 'Consul', 'Herald'];

// Map boardroom agent names to persona-style metadata
const PERSONA_META: Record<BoardroomAgent, { label: string }> = {
  'Harper-Hermes': { label: 'CAO' },
  Oracle: { label: 'All-Seer' },
  Feucht: { label: 'Futures & Risk' },
  Consul: { label: 'Fundamentals' },
  Herald: { label: 'News & Sentiment' },
  Unknown: { label: 'Unknown' },
};

function getAgentColor(agent: BoardroomAgent): string {
  const info = AGENT_MAP[agent];
  if (!info) return '#52525b';
  switch (info.accentClass) {
    case 'gold': return '#c79f4a';
    case 'blue': return '#60a5fa';
    case 'red': return '#ef4444';
    case 'emerald': return '#10b981';
    case 'purple': return '#a78bfa';
    default: return '#52525b';
  }
}

function AgentDropdown({
  selectedAgent,
  onSelect,
}: {
  selectedAgent: BoardroomAgent | null;
  onSelect: (agent: BoardroomAgent | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const label = selectedAgent
    ? (AGENT_MAP[selectedAgent]?.label || selectedAgent)
    : 'All';

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors border ${
          selectedAgent
            ? 'border-[#c79f4a]/30 bg-[#c79f4a]/10 text-[#c79f4a]'
            : 'border-[#c79f4a]/20 text-[#f0ead6]/60 hover:bg-[#c79f4a]/5 hover:text-[#f0ead6]'
        }`}
      >
        {selectedAgent && (
          <span
            className="w-[6px] h-[6px] rounded-full shrink-0"
            style={{ backgroundColor: getAgentColor(selectedAgent) }}
          />
        )}
        <span className="whitespace-nowrap">{label}</span>
        <ChevronDown size={12} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute bottom-full left-0 mb-1 z-50 w-52 rounded-lg border border-[#c79f4a]/20 bg-[#0a0a00] py-1 shadow-xl">
          {/* "All" option */}
          <button
            onClick={() => { onSelect(null); setOpen(false); }}
            className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors ${
              !selectedAgent ? 'bg-[#c79f4a]/10 text-[#c79f4a]' : 'text-[#f0ead6]/60 hover:bg-[#c79f4a]/5 hover:text-[#f0ead6]'
            }`}
          >
            <span className="font-medium">All Agents</span>
            <span className="ml-auto text-[10px] text-[#f0ead6]/30">Broadcast</span>
          </button>

          <div className="h-px bg-[#c79f4a]/10 my-0.5" />

          {MENTIONABLE_AGENTS.map((agent) => {
            const info = AGENT_MAP[agent];
            const meta = PERSONA_META[agent];
            return (
              <button
                key={agent}
                onClick={() => { onSelect(agent); setOpen(false); }}
                className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors ${
                  selectedAgent === agent ? 'bg-[#c79f4a]/10 text-[#c79f4a]' : 'text-[#f0ead6]/60 hover:bg-[#c79f4a]/5 hover:text-[#f0ead6]'
                }`}
              >
                <span
                  className="w-[6px] h-[6px] rounded-full shrink-0"
                  style={{ backgroundColor: getAgentColor(agent) }}
                />
                <span className="font-medium">{info?.label || agent}</span>
                <span className="ml-auto text-[10px] text-[#f0ead6]/30">{meta.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function getDateRangeSince(range: 'today' | '7d' | '30d' | 'all'): string | undefined {
  if (range === 'all') return undefined;
  const now = new Date();
  if (range === 'today') return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  if (range === '7d') return new Date(now.getTime() - 7 * 86400000).toISOString();
  if (range === '30d') return new Date(now.getTime() - 30 * 86400000).toISOString();
  return undefined;
}

export function AgentChattr() {
  const [messages, setMessages] = useState<BoardroomMessage[]>([]);
  const [input, setInput] = useState('');
  const [isOnline, setIsOnline] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<BoardroomAgent | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [thinkHarder, setThinkHarder] = useState(false);

  // Filter state
  const [filterAgents, setFilterAgents] = useState<BoardroomAgent[]>([]);
  const [filterSearch, setFilterSearch] = useState('');
  const [filterDateRange, setFilterDateRange] = useState<'today' | '7d' | '30d' | 'all'>('all');
  const [totalMessages, setTotalMessages] = useState(0);
  const [expandedMessage, setExpandedMessage] = useState<BoardroomMessage | null>(null);
  const [isVisible, setIsVisible] = useState(!document.hidden);

  // Pause polling when tab not visible
  useEffect(() => {
    const handler = () => setIsVisible(!document.hidden);
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, []);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  const fetchMessages = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filterAgents.length) params.set('agent', filterAgents.join(','));
      if (filterSearch) params.set('search', filterSearch);
      const since = getDateRangeSince(filterDateRange);
      if (since) params.set('since', since);
      const qs = params.toString();
      const res = await fetch(`${API_BASE}/api/boardroom/messages${qs ? `?${qs}` : ''}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setMessages(data.messages || []);
      setTotalMessages(data.total ?? data.messages?.length ?? 0);
      setIsOnline(true);
      setIsLoading(false);
    } catch {
      setIsOnline(false);
      setIsLoading(false);
    }
  }, [filterAgents, filterSearch, filterDateRange]);

  // Initial fetch + polling (pauses when tab not visible)
  useEffect(() => {
    if (!isVisible) return;
    fetchMessages();
    pollRef.current = setInterval(fetchMessages, POLL_INTERVAL);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchMessages, isVisible]);

  // Auto-scroll on new messages
  useEffect(() => {
    scrollToBottom();
  }, [messages.length, scrollToBottom]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || isSending) return;

    setIsSending(true);
    try {
      if (selectedAgent) {
        await fetch(`${API_BASE}/api/boardroom/mention/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: text, agent: selectedAgent, thinkHarder }),
        });
      } else {
        await fetch(`${API_BASE}/api/boardroom/intervention/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: text, thinkHarder }),
        });
      }
      setInput('');
      setSelectedAgent(null);
      await fetchMessages();
    } catch (err) {
      console.error('[Consilium] Failed to send:', err);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
    if (e.key === 'Escape') {
      setSelectedAgent(null);
    }
  };

  return (
    <div className="relative flex h-full flex-col">
      {/* Status bar — floating, no harsh border */}
      <div className="flex items-center justify-between px-4 py-2">
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
        <button
          onClick={fetchMessages}
          className="rounded-full p-1.5 text-[#c79f4a]/40 transition-colors hover:bg-[#c79f4a]/10 hover:text-[#c79f4a]"
          title="Refresh"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Filter bar */}
      <ConsiliumFilterBar
        agents={MENTIONABLE_AGENTS}
        selectedAgents={filterAgents}
        onAgentsChange={setFilterAgents}
        search={filterSearch}
        onSearchChange={setFilterSearch}
        dateRange={filterDateRange}
        onDateRangeChange={setFilterDateRange}
        resultCount={totalMessages}
      />

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto py-2">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <span className="text-xs text-[#f0ead6]/30">Loading transcript...</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-6">
            <span className="text-sm text-[#c79f4a]/40">No messages yet</span>
            <span className="text-center text-xs text-[#f0ead6]/20">
              The Consilium awaits. Send a message to begin deliberation.
            </span>
          </div>
        ) : (
          messages.map((msg) => (
            <ConsiliumMessage key={msg.id} message={msg} onClick={() => setExpandedMessage(msg)} />
          ))
        )}
      </div>

      {/* Expanded message slide-over */}
      <ConsiliumMessageExpanded message={expandedMessage} onClose={() => setExpandedMessage(null)} />

      {/* Input area — compact with agent dropdown inline */}
      <div className="px-4 py-3">
        <div className="flex items-end gap-2">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={selectedAgent ? `Message @${AGENT_MAP[selectedAgent]?.label}...` : 'Address the Consilium...'}
              className="w-full resize-none rounded-xl border border-[#c79f4a]/15 bg-[#050402] px-4 py-2.5 text-sm text-[#f0ead6] placeholder-[#f0ead6]/20 outline-none transition-colors focus:border-[#c79f4a]/40 min-h-[42px] max-h-[120px]"
              rows={1}
              disabled={isSending}
            />
          </div>
          <div className="flex items-center gap-1 pb-0.5">
            {/* Agent dropdown */}
            <AgentDropdown
              selectedAgent={selectedAgent}
              onSelect={setSelectedAgent}
            />
            {/* Think Harder toggle */}
            <button
              type="button"
              onClick={() => setThinkHarder(!thinkHarder)}
              className={`rounded-lg p-2 transition-all ${
                thinkHarder
                  ? 'bg-[#c79f4a]/15 text-[#c79f4a] border border-[#c79f4a]/30'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 border border-transparent'
              }`}
              title={thinkHarder ? 'Think Harder: ON' : 'Think Harder: OFF'}
            >
              <Brain size={16} />
            </button>
            {/* Send */}
            <button
              onClick={sendMessage}
              disabled={!input.trim() || isSending}
              className="rounded-lg p-2 bg-[#c79f4a]/10 text-[#c79f4a] transition-all disabled:text-[#c79f4a]/20 disabled:bg-transparent hover:bg-[#c79f4a]/20 border border-[#c79f4a]/20 disabled:border-transparent"
              title="Send"
            >
              {isSending ? <Zap size={16} className="animate-pulse" /> : <Send size={16} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
