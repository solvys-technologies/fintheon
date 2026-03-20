// [claude-code 2026-03-19] Consilium — unified agent discussion panel with sub-tabs (Chat/Timeline/Scorecards)
import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, AtSign, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { ConsiliumMessage, type BoardroomMessage } from './ConsiliumMessage';
import { AgentBadge, AGENT_MAP, type BoardroomAgent } from './AgentBadge';
import { ConsiliumFilterBar } from './ConsiliumFilterBar';
import { ConsiliumMessageExpanded } from './ConsiliumMessageExpanded';
import { DevelopmentsTimeline } from './DevelopmentsTimeline';
import { AgentScorecard } from './AgentScorecard';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080';
const POLL_INTERVAL = 30_000;

const MENTIONABLE_AGENTS: BoardroomAgent[] = ['Harper-Hermes', 'Oracle', 'Feucht', 'Consul', 'Herald'];

type ConsiliumView = 'chat' | 'timeline' | 'scorecards';

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
  const [showMentionMenu, setShowMentionMenu] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<BoardroomAgent | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [view, setView] = useState<ConsiliumView>('chat');

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
  const inputRef = useRef<HTMLInputElement>(null);
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
          body: JSON.stringify({ message: text, agent: selectedAgent }),
        });
      } else {
        await fetch(`${API_BASE}/api/boardroom/intervention/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: text }),
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
      setShowMentionMenu(false);
    }
  };

  const handleMentionSelect = (agent: BoardroomAgent) => {
    setSelectedAgent(agent);
    setShowMentionMenu(false);
    inputRef.current?.focus();
  };

  return (
    <div className="relative flex h-full flex-col bg-[#050402]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#c79f4a]/15 px-5 py-3">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-medium uppercase tracking-[0.2em] text-[#c79f4a]">
            Consilium
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
        </div>
        <button
          onClick={fetchMessages}
          className="rounded-full p-1.5 text-[#c79f4a]/40 transition-colors hover:bg-[#c79f4a]/10 hover:text-[#c79f4a]"
          title="Refresh"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Sub-tab switcher */}
      <div className="flex gap-1 border-b border-[#c79f4a]/10 px-4">
        {(['chat', 'timeline', 'scorecards'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setView(tab)}
            className={`px-3 py-2 text-xs uppercase tracking-wider transition-colors ${
              view === tab
                ? 'border-b-2 border-[#c79f4a] text-[#c79f4a]'
                : 'text-[#f0ead6]/30 hover:text-[#f0ead6]/60'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Chat view */}
      {view === 'chat' && (
        <>
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
          <ConsiliumMessageExpanded message={expandedMessage} onClose={() => setExpandedMessage(null)} />
        </>
      )}

      {/* Timeline view */}
      {view === 'timeline' && <DevelopmentsTimeline />}

      {/* Scorecards view */}
      {view === 'scorecards' && <AgentScorecard />}

      {/* Mention menu — chat only */}
      {view === 'chat' && showMentionMenu && (
        <div className="border-t border-[#c79f4a]/10 bg-[#0a0a00] px-3 py-2">
          <div className="mb-1.5 text-[10px] uppercase tracking-wider text-[#f0ead6]/30">
            Mention Agent
          </div>
          <div className="flex flex-wrap gap-2">
            {MENTIONABLE_AGENTS.map((agent) => (
              <button
                key={agent}
                onClick={() => handleMentionSelect(agent)}
                className="rounded-full border border-[#c79f4a]/20 bg-[#050402] px-3 py-1.5 transition-all hover:border-[#c79f4a]/50 hover:bg-[#c79f4a]/10"
              >
                <AgentBadge agent={agent} size="sm" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input bar — chat only */}
      {view === 'chat' && (
        <div className="border-t border-[#c79f4a]/15 bg-[#0a0a00] px-4 py-3">
          {selectedAgent && (
            <div className="mb-2 flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-wider text-[#c79f4a]/50">Mentioning:</span>
              <AgentBadge agent={selectedAgent} size="sm" />
              <button
                onClick={() => setSelectedAgent(null)}
                className="ml-auto text-xs text-[#f0ead6]/30 hover:text-[#f0ead6]/60"
              >
                Clear
              </button>
            </div>
          )}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowMentionMenu(!showMentionMenu)}
              className={`rounded-full p-2 transition-colors ${
                showMentionMenu || selectedAgent
                  ? 'bg-[#c79f4a]/15 text-[#c79f4a]'
                  : 'text-[#c79f4a]/40 hover:bg-[#c79f4a]/10 hover:text-[#c79f4a]'
              }`}
              title="Mention agent"
            >
              <AtSign size={16} />
            </button>
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={selectedAgent ? `Message @${AGENT_MAP[selectedAgent]?.label}...` : 'Address the Consilium...'}
              className="flex-1 rounded-full border border-[#c79f4a]/15 bg-[#050402] px-4 py-2.5 text-sm text-[#f0ead6] placeholder-[#f0ead6]/20 outline-none transition-colors focus:border-[#c79f4a]/40"
              disabled={isSending}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || isSending}
              className="rounded-full p-2 text-[#c79f4a] transition-all disabled:text-[#c79f4a]/20 hover:bg-[#c79f4a]/10 disabled:hover:bg-transparent"
              title="Send"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
