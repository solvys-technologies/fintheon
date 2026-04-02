// [claude-code 2026-03-30] Sessions panel — date-named conversation history, 6PM ET daily reset
import { useEffect, useState, useCallback } from 'react';
import { Calendar, MessageSquare, Trash2, Loader2 } from 'lucide-react';
import { API_BASE_URL } from './constants';

interface SessionEntry {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  preview: string;
}

function formatSessionDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const today = now.toDateString();
  const yesterday = new Date(now.getTime() - 86_400_000).toDateString();

  if (d.toDateString() === today) return 'Today';
  if (d.toDateString() === yesterday) return 'Yesterday';

  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

interface SessionsPanelProps {
  currentConversationId?: string;
  onSelectSession: (conversationId: string) => void;
  onNewSession: () => void;
}

export function SessionsPanel({ currentConversationId, onSelectSession, onNewSession }: SessionsPanelProps) {
  const [sessions, setSessions] = useState<SessionEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/ai/conversations?limit=30`);
      if (!res.ok) return;
      const data = await res.json();
      const convos: SessionEntry[] = (data.conversations ?? []).map((c: any) => ({
        id: c.id,
        name: c.name || formatSessionDate(c.createdAt || c.created_at),
        createdAt: c.createdAt || c.created_at,
        updatedAt: c.updatedAt || c.updated_at || c.createdAt || c.created_at,
        messageCount: c.messageCount ?? c.message_count ?? 0,
        preview: c.lastMessage || c.preview || '',
      }));
      setSessions(convos);
    } catch {
      // Backend not available
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const handleDelete = useCallback(async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await fetch(`${API_BASE_URL}/api/ai/conversations/${id}`, { method: 'DELETE' });
      setSessions((prev) => prev.filter((s) => s.id !== id));
    } catch {
      // Ignore
    }
  }, []);

  // Group sessions by date
  const grouped = sessions.reduce<Record<string, SessionEntry[]>>((acc, s) => {
    const label = formatSessionDate(s.createdAt);
    if (!acc[label]) acc[label] = [];
    acc[label].push(s);
    return acc;
  }, {});

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'color-mix(in srgb, var(--fintheon-accent) 15%, transparent)' }}>
        <div className="flex items-center gap-2">
          <Calendar size={14} style={{ color: 'var(--fintheon-accent)' }} />
          <span className="text-[13px] font-medium" style={{ color: 'var(--fintheon-text)' }}>
            Sessions
          </span>
        </div>
        <button
          onClick={onNewSession}
          className="text-[11px] px-2 py-1 rounded-md transition-colors"
          style={{
            color: 'var(--fintheon-accent)',
            backgroundColor: 'color-mix(in srgb, var(--fintheon-accent) 10%, transparent)',
            border: '1px solid color-mix(in srgb, var(--fintheon-accent) 20%, transparent)',
          }}
        >
          New
        </button>
      </div>

      {/* Session list */}
      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={16} className="animate-spin" style={{ color: 'var(--fintheon-accent)' }} />
          </div>
        )}

        {!loading && sessions.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <MessageSquare size={20} className="mb-2" style={{ color: 'var(--fintheon-muted)' }} />
            <p className="text-[12px]" style={{ color: 'var(--fintheon-muted)' }}>
              No sessions yet
            </p>
            <p className="text-[10px] mt-1" style={{ color: 'var(--fintheon-muted)', opacity: 0.6 }}>
              Start a conversation to create a session
            </p>
          </div>
        )}

        {!loading && Object.entries(grouped).map(([dateLabel, items]) => (
          <div key={dateLabel}>
            {/* Date header */}
            <div
              className="px-4 py-1.5 text-[10px] font-bold tracking-widest uppercase sticky top-0"
              style={{
                color: 'var(--fintheon-accent)',
                backgroundColor: 'var(--fintheon-bg)',
                borderBottom: '1px solid color-mix(in srgb, var(--fintheon-accent) 8%, transparent)',
              }}
            >
              {dateLabel}
            </div>

            {/* Session items */}
            {items.map((session) => {
              const isActive = session.id === currentConversationId;
              return (
                <button
                  key={session.id}
                  onClick={() => onSelectSession(session.id)}
                  className="w-full text-left px-4 py-2.5 flex items-start gap-2.5 transition-colors group"
                  style={{
                    backgroundColor: isActive
                      ? 'color-mix(in srgb, var(--fintheon-accent) 10%, transparent)'
                      : 'transparent',
                    borderLeft: isActive
                      ? '2px solid var(--fintheon-accent)'
                      : '2px solid transparent',
                  }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span
                        className="text-[12px] font-medium truncate"
                        style={{ color: isActive ? 'var(--fintheon-accent)' : 'var(--fintheon-text)' }}
                      >
                        {session.name}
                      </span>
                      <span className="text-[10px] flex-shrink-0 ml-2" style={{ color: 'var(--fintheon-muted)' }}>
                        {formatTime(session.updatedAt)}
                      </span>
                    </div>
                    {session.preview && (
                      <p
                        className="text-[10px] mt-0.5 truncate"
                        style={{ color: 'var(--fintheon-muted)', opacity: 0.7 }}
                      >
                        {session.preview}
                      </p>
                    )}
                    {session.messageCount > 0 && (
                      <span className="text-[9px] mt-1 inline-block" style={{ color: 'var(--fintheon-muted)', opacity: 0.5 }}>
                        {session.messageCount} message{session.messageCount !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  {/* Delete — visible on hover */}
                  <button
                    onClick={(e) => handleDelete(session.id, e)}
                    className="p-1 rounded opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500/10"
                    style={{ color: 'var(--fintheon-muted)' }}
                    title="Delete session"
                  >
                    <Trash2 size={11} />
                  </button>
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Footer — reset info */}
      <div
        className="px-4 py-2 text-center border-t"
        style={{
          borderColor: 'color-mix(in srgb, var(--fintheon-accent) 10%, transparent)',
          backgroundColor: 'color-mix(in srgb, var(--fintheon-bg) 95%, var(--fintheon-accent) 5%)',
        }}
      >
        <span className="text-[9px] tracking-wider uppercase" style={{ color: 'var(--fintheon-muted)', opacity: 0.6 }}>
          Sessions reset daily at 6PM ET
        </span>
      </div>
    </div>
  );
}
