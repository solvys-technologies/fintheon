import { useEffect, useMemo, useState } from 'react';

type MessagePriority = 'low' | 'normal' | 'high' | 'urgent';

interface ChatMessage {
  id: string;
  timestamp: number;
  agentId: string;
  channel: string;
  content: string;
  metadata?: {
    priority?: MessagePriority;
    tags?: string[];
    replyTo?: string;
  };
}

interface AgentStatus {
  agentId: string;
  lastSeen: number;
  status: 'online' | 'offline';
}

const CHATROOM_API_URL = 'http://localhost:8090';
const CHATROOM_WS_URL = 'ws://localhost:8090/chat';

const agentColors: Record<string, string> = {
  price: '#10b981',
  francine: '#3b82f6',
  codi: '#8b5cf6',
  ori: '#f59e0b',
  sol: '#ec4899',
  harper: '#6366f1',
};

function formatTime(timestamp: number) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '--:--';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatLastSync(timestamp: number | null) {
  if (!timestamp) return 'Waiting for backend';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return 'Waiting for backend';
  return `Last sync ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

function normalizeMessage(message: unknown): ChatMessage | null {
  if (!message || typeof message !== 'object') return null;
  const msg = message as Partial<ChatMessage>;
  if (!msg.id || !msg.content) return null;
  return {
    id: String(msg.id),
    timestamp: typeof msg.timestamp === 'number' ? msg.timestamp : Date.now(),
    agentId: String(msg.agentId || 'unknown'),
    channel: String(msg.channel || 'general'),
    content: String(msg.content),
    metadata: msg.metadata || {},
  };
}

export function AgentChatroomView() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [statuses, setStatuses] = useState<AgentStatus[]>([]);
  const [connected, setConnected] = useState(false);
  const [lastSync, setLastSync] = useState<number | null>(null);

  const [channel, setChannel] = useState<'general' | 'trading' | 'research' | 'ops' | 'all'>('general');
  const [priority, setPriority] = useState<'all' | MessagePriority>('all');
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return messages.filter((m) => {
      const channelMatch = channel === 'all' || m.channel === channel;
      const p = m.metadata?.priority || 'normal';
      const priorityMatch = priority === 'all' || p === priority;
      const content = `${m.agentId} ${m.content} ${(m.metadata?.tags || []).join(' ')}`.toLowerCase();
      const queryMatch = !q || content.includes(q);
      return channelMatch && priorityMatch && queryMatch;
    });
  }, [messages, channel, priority, query]);

  useEffect(() => {
    let cancelled = false;

    const fetchHistory = async () => {
      const url =
        channel === 'all'
          ? `${CHATROOM_API_URL}/api/messages?limit=120`
          : `${CHATROOM_API_URL}/api/messages/${channel}?limit=120`;

      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error('History fetch failed');
        const data = (await res.json()) as unknown[];
        if (cancelled) return;
        const normalized = data.map(normalizeMessage).filter(Boolean) as ChatMessage[];
        setMessages(normalized);
        setLastSync(Date.now());
      } catch {
        if (cancelled) return;
        setLastSync(null);
      }
    };

    fetchHistory();
    return () => {
      cancelled = true;
    };
  }, [channel]);

  useEffect(() => {
    let cancelled = false;
    const fetchStatus = async () => {
      try {
        const res = await fetch(`${CHATROOM_API_URL}/api/agents/status`);
        if (!res.ok) throw new Error('Status fetch failed');
        const data = (await res.json()) as AgentStatus[];
        if (cancelled) return;
        setStatuses(data);
      } catch {
        if (cancelled) return;
        setStatuses([]);
      }
    };

    fetchStatus();
    const interval = window.setInterval(fetchStatus, 15000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!window.WebSocket) return;

    let ws: WebSocket | null = null;
    let reconnectTimer: number | null = null;

    const connect = () => {
      if (ws) ws.close();
      ws = new WebSocket(CHATROOM_WS_URL);

      ws.addEventListener('open', () => {
        setConnected(true);
        if (reconnectTimer) window.clearTimeout(reconnectTimer);
      });

      ws.addEventListener('close', () => {
        setConnected(false);
        ws = null;
        if (reconnectTimer) window.clearTimeout(reconnectTimer);
        reconnectTimer = window.setTimeout(connect, 3000);
      });

      ws.addEventListener('error', () => {
        setConnected(false);
      });

      ws.addEventListener('message', (event) => {
        try {
          const data = JSON.parse(String(event.data)) as any;
          if (data?.type === 'status') {
            const next: AgentStatus = {
              agentId: String(data.agentId),
              lastSeen: typeof data.timestamp === 'number' ? data.timestamp : Date.now(),
              status: data.status === 'offline' ? 'offline' : 'online',
            };
            setStatuses((prev) => {
              const existing = prev.find((s) => s.agentId === next.agentId);
              return existing
                ? prev.map((s) => (s.agentId === next.agentId ? next : s))
                : [...prev, next];
            });
            return;
          }

          const normalized = normalizeMessage(data);
          if (!normalized) return;
          setMessages((prev) => [...prev, normalized].slice(-120));
        } catch {
          // ignore malformed payloads
        }
      });
    };

    connect();
    return () => {
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      if (ws) ws.close();
    };
  }, []);

  return (
    <div className="h-full w-full p-6">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <div className="text-xs tracking-[0.28em] uppercase text-gray-500">Fintheon</div>
          <h1 className="mt-2 text-2xl font-semibold text-white">Agent Chatroom</h1>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`text-[11px] tracking-[0.22em] uppercase rounded-full px-3 py-1 border ${
              connected
                ? 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10'
                : 'text-gray-400 border-[var(--fintheon-accent)]/15 bg-[var(--fintheon-surface)]'
            }`}
          >
            {connected ? 'Online' : 'Offline'}
          </span>
          <span className="text-xs text-gray-500">{formatLastSync(lastSync)} · {messages.length} msgs</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <div className="xl:col-span-8 rounded-xl border border-[var(--fintheon-accent)]/15 bg-[var(--fintheon-surface)] overflow-hidden">
          <div className="border-b border-[var(--fintheon-accent)]/20 px-5 py-4 flex flex-wrap gap-3 items-end">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] tracking-[0.22em] uppercase text-gray-500">Channel</span>
              <select
                value={channel}
                onChange={(e) => setChannel(e.target.value as any)}
                className="bg-[var(--fintheon-bg)] border border-[var(--fintheon-accent)]/15 rounded-lg px-3 py-2 text-sm text-gray-200"
              >
                <option value="general">General</option>
                <option value="trading">Trading</option>
                <option value="research">Research</option>
                <option value="ops">Operations</option>
                <option value="all">All Channels</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[10px] tracking-[0.22em] uppercase text-gray-500">Priority</span>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                className="bg-[var(--fintheon-bg)] border border-[var(--fintheon-accent)]/15 rounded-lg px-3 py-2 text-sm text-gray-200"
              >
                <option value="all">All</option>
                <option value="urgent">Urgent</option>
                <option value="high">High</option>
                <option value="normal">Normal</option>
                <option value="low">Low</option>
              </select>
            </div>

            <div className="flex-1 min-w-[220px] flex flex-col gap-1">
              <span className="text-[10px] tracking-[0.22em] uppercase text-gray-500">Search</span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter messages"
                className="w-full bg-[var(--fintheon-bg)] border border-[var(--fintheon-accent)]/15 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder:text-gray-600"
              />
            </div>
          </div>

          <div className="h-[62vh] overflow-y-auto px-5 py-4">
            {!filtered.length ? (
              <div className="text-sm text-gray-400">
                No messages yet. Start the chatroom backend + agents to stream activity.
              </div>
            ) : (
              <div className="space-y-3">
                {filtered.map((m) => {
                  const initial = m.agentId ? m.agentId[0].toUpperCase() : '?';
                  const color = agentColors[m.agentId] || '#6b7280';
                  const p = m.metadata?.priority || 'normal';
                  return (
                    <div key={m.id} className="flex gap-3">
                      <div
                        className="h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                        style={{ background: color }}
                      >
                        {initial}
                      </div>
                      <div className="flex-1 rounded-lg border border-[var(--fintheon-accent)]/10 bg-black/20 px-4 py-3">
                        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                          <span className="text-sm font-semibold text-white">{m.agentId}</span>
                          <span className="text-xs text-gray-500">{formatTime(m.timestamp)}</span>
                          <span className="text-[10px] tracking-[0.22em] uppercase text-gray-400 border border-[var(--fintheon-accent)]/15 rounded-full px-2 py-0.5">
                            {p}
                          </span>
                          <span className="text-xs text-gray-500">{m.channel}</span>
                        </div>
                        <div className="mt-2 text-sm text-gray-200 whitespace-pre-wrap">{m.content}</div>
                        {m.metadata?.tags?.length ? (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {m.metadata.tags.map((tag) => (
                              <span
                                key={tag}
                                className="text-[10px] tracking-[0.22em] uppercase text-gray-400 border border-[var(--fintheon-accent)]/10 rounded-full px-2 py-0.5"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="xl:col-span-4 rounded-xl border border-[var(--fintheon-accent)]/15 bg-[var(--fintheon-surface)] overflow-hidden">
          <div className="flex items-center justify-between border-b border-[var(--fintheon-accent)]/20 px-5 py-4">
            <h2 className="text-sm font-semibold text-[var(--fintheon-accent)] tracking-[0.18em] uppercase">Agent Status</h2>
            <span className="text-[10px] tracking-[0.22em] uppercase text-gray-500 border border-[var(--fintheon-accent)]/15 rounded-full px-3 py-1">
              Heartbeat
            </span>
          </div>
          <div className="p-5 space-y-3">
            {!statuses.length ? (
              <div className="text-sm text-gray-400">Backend offline or no agent heartbeats yet.</div>
            ) : (
              statuses
                .slice()
                .sort((a, b) => a.agentId.localeCompare(b.agentId))
                .map((s) => (
                  <div
                    key={s.agentId}
                    className="flex items-center justify-between rounded-lg border border-[var(--fintheon-accent)]/10 bg-black/20 px-4 py-3"
                  >
                    <div>
                      <div className="text-sm font-semibold text-white">{s.agentId}</div>
                      <div className="mt-1 text-xs text-gray-500">{formatTime(s.lastSeen)}</div>
                    </div>
                    <span
                      className={`text-[10px] tracking-[0.22em] uppercase rounded-full px-2 py-0.5 border ${
                        s.status === 'online'
                          ? 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10'
                          : 'text-gray-400 border-[var(--fintheon-accent)]/15 bg-[var(--fintheon-surface)]'
                      }`}
                    >
                      {s.status}
                    </span>
                  </div>
                ))
            )}
            <div className="pt-3 text-xs text-gray-500">
              This panel is read-only. Agents write to the chatroom backend; Fintheon displays.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

