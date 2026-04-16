// [claude-code 2026-04-16] T4 unification: useConversations wired, sendMessage forwards images+riskFlowContext to relay
// [claude-code 2026-04-16] T3/T6: Full-screen Harper chat — SSE streaming via relay, background recovery
// Memory: feedback_keep_chat_mounted — use display:none not conditional render, streams survive navigation
// Memory: feedback_uimessagestream_framing — start/finish events in SSE stream

import { useState, useRef, useEffect, useCallback } from "react";
import { List } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { useSettings } from "../../contexts/SettingsContext";
import { getMobileBackend } from "../../lib/backend";
import ChatMessage, { type ChatMessageData } from "./ChatMessage";
import ChatInput from "./ChatInput";
import ConnectionStatus, { type RelayState } from "./ConnectionStatus";
import SessionList from "./SessionList";
import { useConversations } from "../../hooks/useConversations";
import { ThinkingIndicator } from "./ThinkingIndicator";
import { ToolCallCard } from "./ToolCallCard";
import { ToolApprovalCard } from "./ToolApprovalCard";
import { useToolApprovals } from "../../hooks/useToolApprovals";

const API_BASE = import.meta.env.VITE_API_URL || "";

interface ChatPageProps {
  visible: boolean;
}

export default function ChatPage({ visible }: ChatPageProps) {
  const { getAccessToken } = useAuth();
  const { settings } = useSettings();
  const [messages, setMessages] = useState<ChatMessageData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [relayState, setRelayState] = useState<RelayState>("reconnecting");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [sessionListOpen, setSessionListOpen] = useState(false);
  const {
    sessions,
    isLoading: sessionsLoading,
    loadSession,
    refresh: refreshSessions,
  } = useConversations();
  const [activeToolCall, setActiveToolCall] = useState<{
    name: string;
    input?: string;
  } | null>(null);
  const {
    approvals,
    pendingApprovals,
    addApproval,
    resolveApproval,
    resolveFromEvent,
    clearApprovals,
  } = useToolApprovals();

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

  // Recover conversation from API when app returns from background
  // The server-side agent continues processing even if the client stream is interrupted
  const recoverConversation = useCallback(async () => {
    const convId = conversationIdRef.current;
    if (!convId || !isLoading) return;

    try {
      const backend = getMobileBackend(getAccessToken);
      const data = await backend.ai.getConversation(convId);
      if (!data?.messages?.length) return;

      const lastMsg = data.messages[data.messages.length - 1];
      if (lastMsg.role !== "assistant" || !lastMsg.content) return;

      // Server finished — replace local messages with completed conversation
      setMessages(
        data.messages.map((m: any) => ({
          id: m.id,
          role: m.role as "user" | "assistant",
          content: m.content,
          timestamp: m.createdAt ?? m.created_at ?? "",
        })),
      );
      setIsLoading(false);
      setActiveToolCall(null);
      // Abort the dangling client stream if still open
      abortRef.current?.abort();
      abortRef.current = null;
    } catch {
      // Recovery failed — stream may still be active, let it continue
    }
  }, [isLoading, getAccessToken]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "visible") recoverConversation();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [recoverConversation]);

  const sendMessage = useCallback(
    async (
      text: string,
      opts?: { images?: string[]; riskFlowContext?: string },
    ) => {
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
            ...(opts?.images?.length ? { images: opts.images } : {}),
            ...(opts?.riskFlowContext
              ? { riskFlowContext: opts.riskFlowContext }
              : {}),
            ...(settings.traderName ? { traderName: settings.traderName } : {}),
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
                setActiveToolCall(null);
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? { ...m, content: m.content + event.delta }
                      : m,
                  ),
                );
              } else if (
                event.type === "tool_use" ||
                event.type === "tool-use"
              ) {
                setActiveToolCall({
                  name: event.name || event.tool || "unknown",
                  input:
                    typeof event.input === "string"
                      ? event.input
                      : event.input
                        ? JSON.stringify(event.input).slice(0, 120)
                        : undefined,
                });
              } else if (event.type === "tool-approval-needed") {
                setActiveToolCall(null);
                addApproval({
                  approvalId: event.approvalId,
                  toolName: event.toolName || event.name || "unknown",
                  toolInput: event.toolInput || event.input,
                  description: event.description,
                });
              } else if (event.type === "tool-approval-resolved") {
                resolveFromEvent({
                  approvalId: event.approvalId,
                  decision: event.decision || event.status,
                });
              }
            } catch {
              // Skip non-JSON lines (heartbeats, comments)
            }
          }
        }
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        // Stream interrupted — try recovering completed response from API
        const convId = conversationIdRef.current;
        if (convId) {
          try {
            const backend = getMobileBackend(getAccessToken);
            const data = await backend.ai.getConversation(convId);
            const lastMsg = data?.messages?.[data.messages.length - 1];
            if (lastMsg?.role === "assistant" && lastMsg.content) {
              setMessages(
                data.messages.map((m: any) => ({
                  id: m.id,
                  role: m.role as "user" | "assistant",
                  content: m.content,
                  timestamp: m.createdAt ?? m.created_at ?? "",
                })),
              );
              return;
            }
          } catch {
            // Recovery failed — show error
          }
        }
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: "[ERROR: CONNECTION LOST]" }
              : m,
          ),
        );
      } finally {
        setIsLoading(false);
        setActiveToolCall(null);
        abortRef.current = null;
        // Refresh session list so new/updated conversations appear
        refreshSessions();
      }
    },
    [isLoading, getAccessToken, refreshSessions],
  );

  const handleSelectSession = useCallback(
    async (id: string) => {
      const conv = await loadSession(id);
      if (conv) {
        setMessages(
          conv.messages.map((m, i) => ({
            id: m.id || `loaded-${i}`,
            role: m.role as "user" | "assistant",
            content: m.content,
            timestamp: m.createdAt,
          })),
        );
        setConversationId(conv.id);
      }
      setSessionListOpen(false);
    },
    [loadSession],
  );

  const handleNewSession = useCallback(() => {
    setMessages([]);
    setConversationId(null);
    setSessionListOpen(false);
    clearApprovals();
  }, [clearApprovals]);

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
          padding: "4px 16px",
          borderBottom: "none",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-data)",
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
          minHeight: 0,
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
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 20,
                color: "var(--accent, #c79f4a)",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              HARPER
            </span>
            <span
              style={{
                fontFamily: "var(--font-data)",
                fontSize: 11,
                color: "var(--text-disabled)",
                letterSpacing: "0.06em",
              }}
            >
              Your CAO is standing by.
            </span>
          </div>
        )}
        {isOffline && messages.length === 0 && (
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 20,
                color: "var(--accent, #c79f4a)",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              HARPER
            </span>
            <span
              style={{
                fontFamily: "var(--font-data)",
                fontSize: 11,
                color: "var(--error)",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              [OFFLINE — START LOCAL INSTANCE]
            </span>
          </div>
        )}
        {messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} />
        ))}

        {/* Thinking indicator — shows during streaming when content is empty */}
        <ThinkingIndicator
          isThinking={
            isLoading &&
            messages.length > 0 &&
            messages[messages.length - 1].role === "assistant" &&
            messages[messages.length - 1].content === ""
          }
        />

        {/* Active tool call card */}
        {activeToolCall && (
          <ToolCallCard
            toolName={activeToolCall.name}
            input={activeToolCall.input}
          />
        )}

        {/* Tool approval cards */}
        {approvals.map((approval) => (
          <ToolApprovalCard
            key={approval.id}
            approvalId={approval.id}
            toolName={approval.toolName}
            description={approval.description}
            toolInput={approval.toolInput}
            status={approval.status}
            onDecision={resolveApproval}
          />
        ))}
      </div>

      {/* Spacer for fixed input */}
      <div style={{ height: 100, flexShrink: 0 }} />

      {/* Input — fixed to bottom of viewport */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          background: "var(--black, #000)",
          zIndex: 10,
        }}
      >
        <ChatInput
          onSend={sendMessage}
          isLoading={isLoading}
          disabled={isOffline}
        />
      </div>

      {/* Session list bottom sheet */}
      <SessionList
        open={sessionListOpen}
        onClose={() => setSessionListOpen(false)}
        sessions={sessions}
        isLoading={sessionsLoading}
        activeSessionId={conversationId}
        onSelect={handleSelectSession}
        onNewSession={handleNewSession}
        onRefresh={refreshSessions}
      />
    </div>
  );
}
