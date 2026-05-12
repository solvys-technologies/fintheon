// [claude-code 2026-05-12] PeerChat — agent-to-agent messaging UI for Claude Peers
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronRight,
  MessageSquare,
  Send,
  Users,
  Handshake,
  AlertTriangle,
  Loader2,
  ArrowBigUp,
} from "lucide-react";
import { useBackend } from "../../lib/backend";
import { useAuth } from "../../contexts/AuthContext";
import type {
  PeerChatMessageRecord,
  PeerConversationRecord,
  PeerRecordResponse,
} from "../../lib/services/team";

// ── Types ────────────────────────────────────────────────────────────────────

type ChatView = "list" | "thread";

interface PeerChatProps {
  /** The local peer's ID (from registration) */
  localPeerId: string;
  /** The local agent name (e.g. "codi", "harper") */
  localAgentName?: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

const typeColors: Record<string, string> = {
  text: "text-[var(--fintheon-text)]",
  handoff: "text-amber-400",
  handoff_ack: "text-emerald-400",
  handoff_decline: "text-red-400",
  status: "text-blue-400",
  request: "text-violet-400",
  response: "text-cyan-400",
  ack: "text-zinc-400",
  error: "text-red-400",
};

const typeIcons: Record<string, React.ReactNode> = {
  handoff: <Handshake className="h-3 w-3" />,
  handoff_ack: <Check className="h-3 w-3" />,
  handoff_decline: <AlertTriangle className="h-3 w-3" />,
  error: <AlertTriangle className="h-3 w-3" />,
};

function MessageTypeBadge({ type }: { type: string }) {
  const icon = typeIcons[type];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium ${typeColors[type] ?? typeColors.text}`}
      style={{
        backgroundColor: `color-mix(in srgb, ${typeColors[type]?.replace("text-", "") === "text-[var(--fintheon-text)]" ? "var(--fintheon-accent)" : "currentColor"} 10%, transparent)`,
      }}
    >
      {icon}
      {type.replace(/_/g, " ")}
    </span>
  );
}

function StatusDot({ status }: { status: "online" | "away" | "offline" }) {
  const colors = {
    online: "bg-emerald-500",
    away: "bg-amber-500",
    offline: "bg-zinc-600",
  };
  return (
    <span className={`inline-block h-2 w-2 rounded-full ${colors[status]}`} />
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export function PeerChat({
  localPeerId,
  localAgentName = "claude-code",
}: PeerChatProps) {
  const backend = useBackend();
  const { userId } = useAuth();
  const [view, setView] = useState<ChatView>("list");
  const [conversations, setConversations] = useState<PeerConversationRecord[]>(
    [],
  );
  const [messages, setMessages] = useState<PeerChatMessageRecord[]>([]);
  const [activeConv, setActiveConv] = useState<PeerConversationRecord | null>(
    null,
  );
  const [peers, setPeers] = useState<PeerRecordResponse[]>([]);
  const [selectedPeerId, setSelectedPeerId] = useState("");
  const [selectedAgentName, setSelectedAgentName] = useState("");
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [expandedPeers, setExpandedPeers] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Data loading ─────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    try {
      const [convRes, peersRes] = await Promise.all([
        backend.peers.chatConversations(localPeerId, 50),
        backend.peers.list(),
      ]);
      setConversations(convRes.conversations);
      setPeers(peersRes.peers);
    } catch (err) {
      console.warn("Failed to load peer chat data", err);
    } finally {
      setLoading(false);
    }
  }, [backend, localPeerId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // ── Poll for new messages every 15s when in thread view ──────────────────

  useEffect(() => {
    if (!activeConv) return;
    const poll = async () => {
      try {
        const res = await backend.peers.chatMessages(activeConv.id);
        if (res.messages.length > messages.length) {
          setMessages(res.messages);
          setConversations((prev) =>
            prev.map((c) =>
              c.id === activeConv.id
                ? {
                    ...c,
                    lastActivityAt:
                      res.messages[res.messages.length - 1]?.createdAt ??
                      c.lastActivityAt,
                  }
                : c,
            ),
          );
        }
      } catch {
        // silent
      }
    };
    pollRef.current = setInterval(poll, 15_000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [activeConv?.id]);

  // ── Scroll to bottom on new messages ────────────────────────────────────

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // ── Mark as read when viewing thread ─────────────────────────────────────

  useEffect(() => {
    if (!activeConv || activeConv.unreadByPeer[localPeerId] === 0) return;
    backend.peers.chatMarkRead(activeConv.id, localPeerId).catch(() => {});
    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeConv.id
          ? { ...c, unreadByPeer: { ...c.unreadByPeer, [localPeerId]: 0 } }
          : c,
      ),
    );
  }, [activeConv?.id, localPeerId, backend]);

  // ── Open a conversation ──────────────────────────────────────────────────

  const openConversation = useCallback(
    async (conv: PeerConversationRecord) => {
      setActiveConv(conv);
      setView("thread");
      try {
        const res = await backend.peers.chatMessages(conv.id);
        setMessages(res.messages);
      } catch {
        setMessages([]);
      }
    },
    [backend],
  );

  // ── Send a message ───────────────────────────────────────────────────────

  const handleSend = useCallback(async () => {
    const text = inputText.trim();
    if (!text || !selectedPeerId) return;

    setSending(true);
    try {
      // Determine recipient agent name
      const targetPeer = peers.find((p) => p.id === selectedPeerId);
      const recipientAgent =
        selectedAgentName || targetPeer?.assignedAgents?.[0] || "*";

      const result = await backend.peers.chatSend({
        senderPeerId: localPeerId,
        senderAgentName: localAgentName,
        recipientPeerId: selectedPeerId,
        recipientAgentName: recipientAgent,
        type: "text",
        role: "agent",
        body: text,
        conversationId: activeConv?.id,
      });

      setInputText("");

      if (result.isNewConversation) {
        setConversations((prev) => [result.conversation, ...prev]);
        setActiveConv(result.conversation);
        setView("thread");
      }

      // Refresh messages
      if (result.conversation) {
        const res = await backend.peers.chatMessages(result.conversation.id);
        setMessages(res.messages);
      }
    } catch (err) {
      console.error("Failed to send message", err);
    } finally {
      setSending(false);
    }
  }, [
    inputText,
    selectedPeerId,
    selectedAgentName,
    peers,
    localPeerId,
    localAgentName,
    backend,
    activeConv?.id,
  ]);

  // ── Compute unread total for list view badge ────────────────────────────

  const unreadTotal = conversations.reduce(
    (sum, c) => sum + (c.unreadByPeer[localPeerId] ?? 0),
    0,
  );

  // ── Render: Loading ───────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-zinc-500">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="ml-2 text-xs">Loading peer messages...</span>
      </div>
    );
  }

  // ── Render: Conversation List ──────────────────────────────────────────

  if (view === "list") {
    return (
      <div className="flex h-full flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--fintheon-accent)]/15 px-3 py-2.5">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-[var(--fintheon-accent)]" />
            <span className="text-xs font-semibold tracking-wide text-[var(--fintheon-text)]">
              Peer Chat
            </span>
            {unreadTotal > 0 && (
              <span className="inline-flex h-5 min-w-[18px] items-center justify-center rounded-full bg-amber-500/20 px-1.5 text-[10px] font-bold text-amber-400">
                {unreadTotal}
              </span>
            )}
          </div>
          <span className="text-[10px] text-zinc-500">
            {conversations.length} threads
          </span>
        </div>

        {/* Connected Peers */}
        <div className="border-b border-[var(--fintheon-accent)]/10">
          <button
            onClick={() => setExpandedPeers((v) => !v)}
            className="flex w-full items-center gap-1.5 px-3 py-1.5 text-[10px] text-zinc-400 hover:text-zinc-300"
          >
            {expandedPeers ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
            <Users className="h-3 w-3" />
            Peers ({peers.length})
          </button>
          {expandedPeers && (
            <div className="space-y-0.5 px-3 pb-2">
              {peers
                .filter((p) => p.id !== localPeerId)
                .map((peer) => (
                  <div
                    key={peer.id}
                    className={`flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs transition-colors ${
                      selectedPeerId === peer.id
                        ? "bg-[var(--fintheon-accent)]/10 text-[var(--fintheon-text)]"
                        : "text-zinc-400 hover:bg-zinc-800/40 hover:text-zinc-300"
                    }`}
                    onClick={() => {
                      setSelectedPeerId(peer.id);
                      setSelectedAgentName(peer.assignedAgents?.[0] ?? "");
                    }}
                  >
                    <StatusDot status={peer.status} />
                    <span className="flex-1 truncate">{peer.deviceName}</span>
                    <span className="text-[9px] text-zinc-600">
                      {peer.assignedAgents?.join(", ")}
                    </span>
                  </div>
                ))}
              {peers.filter((p) => p.id !== localPeerId).length === 0 && (
                <p className="px-2 py-1 text-[10px] text-zinc-600">
                  No other peers online.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Send new message quick-bar */}
        <div className="border-b border-[var(--fintheon-accent)]/10 px-3 py-2">
          <div className="flex gap-2">
            <input
              value={selectedPeerId}
              onChange={(e) => {
                setSelectedPeerId(e.target.value);
                const peer = peers.find((p) => p.id === e.target.value);
                setSelectedAgentName(peer?.assignedAgents?.[0] ?? "");
              }}
              placeholder="Select a peer first..."
              className="hidden"
            />
            <div className="flex flex-1 items-center gap-1.5 rounded border border-[var(--fintheon-accent)]/20 bg-[var(--fintheon-bg)] px-2 py-1.5">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void handleSend();
                  }
                }}
                placeholder={
                  selectedPeerId
                    ? "Type a message to peer..."
                    : "Select a peer from the list above"
                }
                disabled={!selectedPeerId}
                className="min-w-0 flex-1 bg-transparent text-xs text-[var(--fintheon-text)] outline-none placeholder:text-zinc-600 disabled:opacity-40"
              />
              {selectedPeerId && (
                <button
                  onClick={() => void handleSend()}
                  disabled={!inputText.trim() || sending}
                  className="flex-shrink-0 rounded p-1 text-zinc-400 hover:text-[var(--fintheon-accent)] disabled:opacity-30"
                >
                  {sending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Send className="h-3.5 w-3.5" />
                  )}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-zinc-600">
              <MessageSquare className="h-8 w-8" />
              <p className="text-xs">No conversations yet.</p>
              <p className="text-[10px]">
                Select a peer above and send a message to start.
              </p>
            </div>
          ) : (
            <div className="space-y-0.5 px-2 py-2">
              {conversations.map((conv) => {
                const unread = conv.unreadByPeer[localPeerId] ?? 0;
                return (
                  <button
                    key={conv.id}
                    onClick={() => void openConversation(conv)}
                    className={`flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors ${
                      unread > 0
                        ? "bg-[var(--fintheon-accent)]/5"
                        : "hover:bg-zinc-800/30"
                    }`}
                  >
                    <div
                      className={`mt-0.5 flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold ${
                        unread > 0
                          ? "border border-[var(--fintheon-accent)]/30 bg-[var(--fintheon-accent)]/10 text-[var(--fintheon-accent)]"
                          : "border border-zinc-700 bg-zinc-800/50 text-zinc-400"
                      }`}
                    >
                      {conv.participantAgentNames
                        .filter((n) => n !== localAgentName)
                        .map((n) => n.charAt(0).toUpperCase())
                        .join("") || "?"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-xs font-medium text-[var(--fintheon-text)]">
                          {conv.title}
                        </span>
                        <span className="flex-shrink-0 text-[9px] text-zinc-600">
                          {timeAgo(conv.lastActivityAt)}
                        </span>
                      </div>
                      <p className="truncate text-[10px] text-zinc-500">
                        {conv.participantAgentNames.join(", ")}
                      </p>
                      {unread > 0 && (
                        <span className="mt-0.5 inline-flex items-center rounded bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-semibold text-amber-400">
                          {unread} new
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Refresh */}
        <button
          onClick={() => {
            void loadData();
          }}
          className="border-t border-[var(--fintheon-accent)]/10 px-3 py-2 text-[10px] text-zinc-500 hover:text-zinc-300"
        >
          Refresh
        </button>
      </div>
    );
  }

  // ── Render: Message Thread ─────────────────────────────────────────────

  const otherParticipants = activeConv
    ? activeConv.participantAgentNames.filter((n) => n !== localAgentName)
    : [];

  return (
    <div className="flex h-full flex-col">
      {/* Thread header */}
      <div className="flex items-center gap-2 border-b border-[var(--fintheon-accent)]/15 px-3 py-2.5">
        <button
          onClick={() => {
            setView("list");
            setActiveConv(null);
            setMessages([]);
          }}
          className="rounded p-1 text-zinc-500 hover:bg-zinc-800/40 hover:text-zinc-300"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-[var(--fintheon-text)]">
              {activeConv?.title ?? "Thread"}
            </span>
          </div>
          <p className="text-[9px] text-zinc-500">
            {otherParticipants.join(", ")} &middot;{" "}
            {activeConv?.lastActivityAt
              ? timeAgo(activeConv.lastActivityAt)
              : ""}
          </p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 space-y-2 overflow-y-auto px-3 py-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-zinc-600">
            <MessageSquare className="mb-2 h-6 w-6" />
            <p className="text-xs">No messages yet.</p>
            <p className="text-[10px]">
              Send a message below to start the conversation.
            </p>
          </div>
        )}
        {messages.map((msg) => {
          const isMine = msg.senderPeerId === localPeerId;
          return (
            <div
              key={msg.id}
              className={`flex ${isMine ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-xl px-3 py-2 ${
                  isMine
                    ? "bg-[var(--fintheon-accent)]/10 border border-[var(--fintheon-accent)]/20"
                    : "bg-zinc-800/50 border border-zinc-700/30"
                }`}
              >
                {/* Sender + type badge */}
                <div className="mb-1 flex flex-wrap items-center gap-1.5">
                  <span
                    className={`text-[10px] font-medium ${
                      isMine ? "text-[var(--fintheon-accent)]" : "text-zinc-400"
                    }`}
                  >
                    {isMine ? localAgentName : msg.senderAgentName}
                  </span>
                  {msg.type !== "text" && <MessageTypeBadge type={msg.type} />}
                  <span className="text-[9px] text-zinc-600">
                    {formatTime(msg.createdAt)}
                  </span>
                </div>

                {/* Body */}
                {msg.type === "handoff" && msg.payload ? (
                  <div className="space-y-1">
                    <p className="whitespace-pre-wrap text-xs text-[var(--fintheon-text)] leading-relaxed">
                      {msg.body}
                    </p>
                    <div className="mt-1.5 rounded border border-amber-500/20 bg-amber-500/5 px-2 py-1.5">
                      <p className="text-[10px] font-semibold text-amber-400">
                        Task: {(msg.payload as any)?.task ?? "Untitled"}
                      </p>
                      {(msg.payload as any)?.priority && (
                        <p className="text-[9px] text-zinc-400">
                          Priority: {(msg.payload as any).priority}
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap text-xs text-[var(--fintheon-text)] leading-relaxed">
                    {msg.body}
                  </p>
                )}

                {/* Read indicator */}
                {isMine && msg.read && (
                  <div className="mt-1 flex items-center gap-1">
                    <Check className="h-3 w-3 text-emerald-500" />
                    <span className="text-[9px] text-emerald-500/70">read</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-[var(--fintheon-accent)]/15 px-3 py-2.5">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void handleSend();
              }
            }}
            placeholder="Type a message..."
            className="min-w-0 flex-1 rounded border border-[var(--fintheon-accent)]/20 bg-[var(--fintheon-bg)] px-2.5 py-2 text-xs text-[var(--fintheon-text)] outline-none placeholder:text-zinc-600"
          />
          <button
            onClick={() => void handleSend()}
            disabled={!inputText.trim() || sending}
            className="flex-shrink-0 rounded-lg border border-[var(--fintheon-accent)]/30 px-3 py-2 text-[var(--fintheon-accent)] disabled:opacity-30"
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
