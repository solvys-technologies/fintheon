// [claude-code 2026-04-15] T6: Full-screen Harper chat — SSE streaming via relay, keep mounted with display:none
// Memory: feedback_keep_chat_mounted — use display:none not conditional render, streams survive navigation
// Memory: feedback_uimessagestream_framing — start/finish events in SSE stream

import { useState, useRef, useEffect, useCallback } from "react";
import { List } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import ChatMessage, { type ChatMessageData } from "./ChatMessage";
import ChatInput from "./ChatInput";
import ConnectionStatus, { type RelayState } from "./ConnectionStatus";
import SessionList, { type ChatSession } from "./SessionList";

const API_BASE =
  import.meta.env.VITE_API_URL ||
  "https://pulse-api-withered-dust-1394.fly.dev";

interface ChatPageProps {
  visible: boolean;
}

export default function ChatPage({ visible }: ChatPageProps) {
  const { getAccessToken } = useAuth();
  const [messages, setMessages] = useState<ChatMessageData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [relayState, setRelayState] = useState<RelayState>("reconnecting");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sessionListOpen, setSessionListOpen] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  // Ref to track conversationId without stale closure (memory: feedback_useChat_stale_closure)
  const conversationIdRef = useRef(conversationId);
  conversationIdRef.current = conversationId;

  // Auto-scroll on new messages
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (isLoading) return;

      const userMsg: ChatMessageData = {
        id: `user-${Date.now()}`,
        role: "user",
        content: text,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setIsLoading(true);

      const assistantId = `harper-${Date.now()}`;
      const assistantMsg: ChatMessageData = {
        id: assistantId,
        role: "assistant",
        content: "",
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const token = await getAccessToken();
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        };
        if (token) headers["Authorization"] = `Bearer ${token}`;

        const res = await fetch(`${API_BASE}/api/relay/chat`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            message: text,
            conversationId: conversationIdRef.current,
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const err = await res
            .json()
            .catch(() => ({ error: "Request failed" }));
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: `[ERROR: ${err.error || res.statusText}]` }
                : m,
            ),
          );
          setIsLoading(false);
          return;
        }

        // Capture conversation ID from response
        const respConvId = res.headers.get("X-Conversation-Id");
        if (respConvId && respConvId !== conversationIdRef.current) {
          setConversationId(respConvId);
        }

        // Parse SSE stream
        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const chunks = buffer.split("\n\n");
          buffer = chunks.pop()!;

          for (const chunk of chunks) {
            if (!chunk.startsWith("data: ")) continue;
            if (chunk === "data: [DONE]") continue;
            const payload = chunk.slice(6);
            if (payload === "[DONE]") continue;

            try {
              const event = JSON.parse(payload);
              if (event.type === "text-delta" && event.delta) {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? { ...m, content: m.content + event.delta }
                      : m,
                  ),
                );
              }
            } catch {
              // Skip non-JSON lines (heartbeats, comments)
            }
          }
        }
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: "[ERROR: CONNECTION LOST]" }
              : m,
          ),
        );
      } finally {
        setIsLoading(false);
        abortRef.current = null;
      }
    },
    [isLoading, getAccessToken],
  );

  const handleNewSession = useCallback(() => {
    const id = `session-${Date.now()}`;
    const session: ChatSession = {
      id,
      title: `Session #${sessions.length + 1}`,
      timestamp: new Date().toISOString(),
    };
    setSessions((prev) => [session, ...prev]);
    setActiveSessionId(id);
    setMessages([]);
    setConversationId(null);
    setSessionListOpen(false);
  }, [sessions.length]);

  const isOffline = relayState === "offline";

  return (
    // display:none keeps component mounted — streams survive tab navigation
    <div
      style={{
        display: visible ? "flex" : "none",
        flexDirection: "column",
        height: "100%",
        background: "var(--black, #000)",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 16px",
          paddingTop: "calc(12px + env(safe-area-inset-top, 0px))",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <span
          style={{
            fontFamily: "'Space Mono', monospace",
            fontSize: 14,
            color: "var(--text-display)",
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            fontWeight: 700,
          }}
        >
          HARPER
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <ConnectionStatus onStateChange={setRelayState} />
          <button
            onClick={() => setSessionListOpen(true)}
            aria-label="Open session list"
            style={{
              background: "transparent",
              border: "none",
              padding: 10,
              minWidth: 44,
              minHeight: 44,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <List size={18} color="var(--text-secondary)" />
          </button>
        </div>
      </div>

      {/* Messages area */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 8,
          paddingTop: 12,
          paddingBottom: 12,
        }}
      >
        {messages.length === 0 && !isOffline && (
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span
              style={{
                fontFamily: "'Space Mono', monospace",
                fontSize: 11,
                color: "var(--text-disabled)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              [MESSAGE HARPER]
            </span>
          </div>
        )}
        {isOffline && messages.length === 0 && (
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span
              style={{
                fontFamily: "'Space Mono', monospace",
                fontSize: 11,
                color: "var(--error)",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              [HARPER OFFLINE — START LOCAL INSTANCE]
            </span>
          </div>
        )}
        {messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} />
        ))}
      </div>

      {/* Input */}
      <ChatInput
        onSend={sendMessage}
        isLoading={isLoading}
        disabled={isOffline}
      />

      {/* Session list bottom sheet */}
      <SessionList
        open={sessionListOpen}
        onClose={() => setSessionListOpen(false)}
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelect={(id) => {
          setActiveSessionId(id);
          setSessionListOpen(false);
        }}
        onNewSession={handleNewSession}
      />
    </div>
  );
}
