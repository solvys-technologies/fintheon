// [claude-code 2026-04-03] Sessions modal — centered overlay like Claude Code VSCode conversation history
import { useEffect, useState, useCallback, useRef } from 'react';
import { X, Search, MessageSquare, Plus, Loader2, Trash2 } from 'lucide-react';
import { API_BASE_URL } from './constants';

interface ConversationSummary {
  id: string;
  title: string;
  messageCount: number;
  lastMessageAt: string;
  model?: string;
  isArchived: boolean;
}

function formatRelativeDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function groupByDate(sessions: ConversationSummary[]): Record<string, ConversationSummary[]> {
  const groups: Record<string, ConversationSummary[]> = {};
  const now = new Date();
  const today = now.toDateString();
  const yesterday = new Date(now.getTime() - 86_400_000).toDateString();
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000);

  for (const s of sessions) {
    const d = new Date(s.lastMessageAt);
    let label: string;
    if (d.toDateString() === today) label = 'Today';
    else if (d.toDateString() === yesterday) label = 'Yesterday';
    else if (d > weekAgo) label = 'This Week';
    else label = 'Older';

    if (!groups[label]) groups[label] = [];
    groups[label].push(s);
  }
  return groups;
}

interface SessionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSession: (conversationId: string) => void;
  onNewSession: () => void;
  currentConversationId?: string;
}

export function SessionsModal({ isOpen, onClose, onSelectSession, onNewSession, currentConversationId }: SessionsModalProps) {
  const [sessions, setSessions] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Fetch sessions when modal opens
  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    setSearch('');
    setSelectedIndex(0);
    fetch(`${API_BASE_URL}/api/ai/conversations`)
      .then(r => r.json())
      .then(data => setSessions(data.conversations ?? []))
      .catch(() => setSessions([]))
      .finally(() => setLoading(false));
  }, [isOpen]);

  // Focus search on open
  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => searchRef.current?.focus());
    }
  }, [isOpen]);

  // Filter by search
  const filtered = search.trim()
    ? sessions.filter(s => s.title.toLowerCase().includes(search.toLowerCase()))
    : sessions;

  const grouped = groupByDate(filtered);
  const flatFiltered = Object.values(grouped).flat();

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, flatFiltered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && flatFiltered[selectedIndex]) {
      onSelectSession(flatFiltered[selectedIndex].id);
      onClose();
    }
  }, [flatFiltered, selectedIndex, onClose, onSelectSession]);

  // Reset selection when search changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [search]);

  // Scroll selected item into view
  useEffect(() => {
    const item = listRef.current?.querySelector(`[data-index="${selectedIndex}"]`);
    item?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  const handleDelete = useCallback(async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await fetch(`${API_BASE_URL}/api/ai/conversations/${id}`, { method: 'DELETE' });
      setSessions(prev => prev.filter(s => s.id !== id));
    } catch { /* ignore */ }
  }, []);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[12vh]"
      onClick={onClose}
      onKeyDown={handleKeyDown}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative w-full max-w-[520px] rounded-xl border overflow-hidden animate-fade-slide-in"
        style={{
          borderColor: 'color-mix(in srgb, var(--fintheon-accent) 20%, transparent)',
          backgroundColor: 'var(--fintheon-surface)',
          boxShadow: '0 25px 60px rgba(0,0,0,0.7), 0 0 1px rgba(212,175,55,0.15)',
          maxHeight: '70vh',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Search header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b" style={{ borderColor: 'color-mix(in srgb, var(--fintheon-accent) 12%, transparent)' }}>
          <Search size={15} className="text-zinc-500 shrink-0" />
          <input
            ref={searchRef}
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search conversations..."
            className="flex-1 bg-transparent text-[13px] text-[var(--fintheon-text)] placeholder:text-zinc-600 outline-none"
          />
          <div className="flex items-center gap-1">
            <button
              onClick={() => { onNewSession(); onClose(); }}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] transition-colors"
              style={{
                color: 'var(--fintheon-accent)',
                backgroundColor: 'color-mix(in srgb, var(--fintheon-accent) 10%, transparent)',
              }}
              title="New conversation"
            >
              <Plus size={12} />
              New
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded-md text-zinc-600 hover:text-[var(--fintheon-accent)] transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Session list */}
        <div ref={listRef} className="overflow-y-auto" style={{ maxHeight: 'calc(70vh - 52px)', scrollbarWidth: 'thin' }}>
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={16} className="animate-spin" style={{ color: 'var(--fintheon-accent)' }} />
            </div>
          )}

          {!loading && filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <MessageSquare size={20} className="mb-2 text-zinc-700" />
              <p className="text-[12px] text-zinc-600">
                {search ? 'No matching conversations' : 'No conversations yet'}
              </p>
              {!search && (
                <p className="text-[10px] text-zinc-700 mt-1">
                  Start chatting to create your first session
                </p>
              )}
            </div>
          )}

          {!loading && Object.entries(grouped).map(([dateLabel, items]) => {
            // Compute the flat index offset for this group
            const groupStartIndex = flatFiltered.indexOf(items[0]);
            return (
              <div key={dateLabel}>
                <div
                  className="px-4 py-1.5 text-[10px] font-semibold tracking-widest uppercase sticky top-0"
                  style={{
                    color: 'var(--fintheon-accent)',
                    backgroundColor: 'var(--fintheon-surface)',
                    borderBottom: '1px solid color-mix(in srgb, var(--fintheon-accent) 6%, transparent)',
                  }}
                >
                  {dateLabel}
                </div>
                {items.map((session, i) => {
                  const flatIndex = groupStartIndex + i;
                  const isSelected = flatIndex === selectedIndex;
                  const isActive = session.id === currentConversationId;
                  return (
                    <button
                      key={session.id}
                      data-index={flatIndex}
                      onClick={() => { onSelectSession(session.id); onClose(); }}
                      onMouseEnter={() => setSelectedIndex(flatIndex)}
                      className="w-full text-left px-4 py-2.5 flex items-center gap-3 transition-colors group/item"
                      style={{
                        backgroundColor: isSelected
                          ? 'color-mix(in srgb, var(--fintheon-accent) 8%, transparent)'
                          : 'transparent',
                        borderLeft: isActive
                          ? '2px solid var(--fintheon-accent)'
                          : '2px solid transparent',
                      }}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between gap-2">
                          <span
                            className="text-[12px] font-medium truncate"
                            style={{ color: isActive ? 'var(--fintheon-accent)' : 'var(--fintheon-text)' }}
                          >
                            {session.title}
                          </span>
                          <span className="text-[10px] text-zinc-600 shrink-0 tabular-nums">
                            {formatRelativeDate(session.lastMessageAt)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-zinc-600">
                            {session.messageCount} message{session.messageCount !== 1 ? 's' : ''}
                          </span>
                          {session.model && (
                            <span className="text-[9px] font-mono" style={{ color: 'color-mix(in srgb, var(--fintheon-accent) 40%, transparent)' }}>
                              {session.model}
                            </span>
                          )}
                        </div>
                      </div>
                      {/* Delete on hover */}
                      <button
                        onClick={(e) => handleDelete(session.id, e)}
                        className="p-1 rounded opacity-0 group-hover/item:opacity-100 transition-all text-zinc-600 hover:text-red-400 hover:bg-red-500/10"
                        title="Delete"
                      >
                        <Trash2 size={11} />
                      </button>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* Footer hint */}
        {!loading && filtered.length > 0 && (
          <div
            className="px-4 py-1.5 text-center border-t"
            style={{
              borderColor: 'color-mix(in srgb, var(--fintheon-accent) 8%, transparent)',
              backgroundColor: 'color-mix(in srgb, var(--fintheon-bg) 95%, var(--fintheon-accent) 5%)',
            }}
          >
            <span className="text-[9px] text-zinc-600 tracking-wide">
              <kbd className="px-1 py-0.5 rounded bg-zinc-800/50 text-zinc-500 text-[8px] font-mono">↑↓</kbd> navigate
              {' '}<kbd className="px-1 py-0.5 rounded bg-zinc-800/50 text-zinc-500 text-[8px] font-mono">↵</kbd> select
              {' '}<kbd className="px-1 py-0.5 rounded bg-zinc-800/50 text-zinc-500 text-[8px] font-mono">esc</kbd> close
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
