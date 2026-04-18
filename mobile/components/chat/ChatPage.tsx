// [claude-code 2026-04-18] SSE parser now handles `error` and `finish(finishReason=error)` events.
// Previously only text-delta / tool_use / tool-approval-* were handled — so when the backend
// emitted an error event (Strands mid-stream failure, relay local_offline, etc), mobile silently
// swallowed it, the stream drained to [DONE], isLoading flipped off, and the assistant bubble
// stayed empty. Users saw a blank reply with no indication anything went wrong. Now we render
// `[ERROR: …]` in the assistant bubble for both error frames, including the relay.ts error shape
// ({type:"error", error: …}) and the stream-adapter.ts shape ({type:"error", errorText: …}).
// [claude-code 2026-04-18] Input un-locked when relay is connected. The earlier
// remote-control refactor gated the textarea on (!conversationId && !mirrorDevice)
// to "prevent orphan chats from mobile" — but with the relay WS working, any
// mobile-initiated message is forwarded to the desktop's Harper via /api/relay/chat
// (which creates the convo if absent and streams the response back). So mobile is
// usable any time relay isn't OFFLINE. Remote-control mode still works — dispatched
// convos auto-load and mirror; we just don't block input when no dispatch is active.
// [claude-code 2026-04-18] S21-T1 remote-control refactor: mobile chat is now
// a per-dispatch surface (like Claude Code's remote-control skill). Session
// list + history browsing removed — mobile only shows the conversation that
// was dispatched from desktop, and is idle otherwise. Conversation history
// is still persisted server-side; we just don't surface it on mobile anymore.
// [claude-code 2026-04-16] T3/T6: Full-screen Harper chat — SSE streaming via relay, background recovery
// Memory: feedback_keep_chat_mounted — use display:none not conditional render, streams survive navigation
// Memory: feedback_uimessagestream_framing — start/finish events in SSE stream

import { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useSettings } from "../../contexts/SettingsContext";
import { getMobileBackend } from "../../lib/backend";
import ChatMessage, { type ChatMessageData } from "./ChatMessage";
import ChatInput from "./ChatInput";
import ConnectionStatus, { type RelayState } from "./ConnectionStatus";
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
  const [mirrorDevice, setMirrorDevice] = useState<string | null>(null);
  const [activeToolCall, setActiveToolCall] = useState<{
    name: string;
    input?: string;
  } | null>(null);
  const { approvals, addApproval, resolveApproval, resolveFromEvent } =
    useToolApprovals();

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

  // S21-T1: relay dispatch — pick up a pending conversation from a push
  // notification tap, or a direct relay-dispatch window event while already open.
  // Fetches via the backend client directly (no session-list dependency).
  const loadRelayConversation = useCallback(
    async (convId: string) => {
      try {
        const backend = getMobileBackend(getAccessToken);
        const data = await backend.ai.getConversation(convId);
        if (!data) return;
        setMessages(
          (data.messages ?? []).map((m: any, i: number) => ({
            id: m.id || `loaded-${i}`,
            role: m.role as "user" | "assistant",
            content: m.content,
            timestamp: m.createdAt ?? m.created_at ?? "",
          })),
        );
        setConversationId(data.id ?? convId);
      } catch {
        // Swallow — mobile shows "standing by" if the fetch fails.
      }
    },
    [getAccessToken],
  );

  useEffect(() => {
    // Check sessionStorage for a pending relay conversation on mount
    try {
      const pending = sessionStorage.getItem("fintheon:pending-relay-conv");
      if (pending) {
        sessionStorage.removeItem("fintheon:pending-relay-conv");
        void loadRelayConversation(pending);
      }
    } catch {
      /* ignore */
    }

    // Listen for in-session relay dispatch events (tab already open)
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.conversationId) {
        void loadRelayConversation(detail.conversationId);
      }
    };
    window.addEventListener("fintheon:relay-dispatch", handler);
    return () => window.removeEventListener("fintheon:relay-dispatch", handler);
  }, [loadRelayConversation]);

  // Poll /api/relay/health every 20s: if desktop dispatched us here, show the
  // "FROM DESKTOP" badge and auto-load the dispatched conversation when we
  // don't already have one active.
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const token = await getAccessToken();
        if (!token) return;
        const res = await fetch(`${API_BASE}/api/relay/health`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = (await res.json()) as {
          dispatch?: { conversationId: string; deviceLabel: string } | null;
        };
        if (cancelled) return;
        const active = data.dispatch;
        if (
          active &&
          (active.conversationId === conversationIdRef.current ||
            !conversationIdRef.current)
        ) {
          setMirrorDevice(active.deviceLabel ?? "desktop");
          if (!conversationIdRef.current) {
            void loadRelayConversation(active.conversationId);
          }
        } else {
          setMirrorDevice(null);
        }
      } catch {
        /* ignore transient errors */
      }
    };
    void check();
    const id = setInterval(check, 20_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [getAccessToken, loadRelayConversation]);

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
              } else if (event.type === "error") {
                // Two shapes: {errorText} from stream-adapter (Strands failure),
                // {error} from relay.ts (forward failure like local_offline).
                const errText =
                  event.errorText || event.error || "Unknown error";
                setActiveToolCall(null);
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? {
                          ...m,
                          content: m.content
                            ? `${m.content}\n\n[ERROR: ${errText}]`
                            : `[ERROR: ${errText}]`,
                        }
                      : m,
                  ),
                );
              } else if (
                event.type === "finish" &&
                event.finishReason === "error"
              ) {
                // Stream ended in error but no explicit error event fired — fall back.
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId && m.content === ""
                      ? {
                          ...m,
                          content: "[ERROR: Harper failed — no response]",
                        }
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
      }
    },
    [isLoading, getAccessToken],
  );

  const isOffline = relayState === "offline";
  // Informational flag — true when there's nothing loaded yet. We no longer
  // disable input on it (relay-connected mobile chats are first-class); it
  // only drives the empty-state copy.
  const isStandby = !conversationId && !mirrorDevice;

  return (
    // display:none keeps component mounted — streams survive tab navigation.
    // height:100% fills MobileShell's <main>; the sticky composer at the
    // bottom rides the keyboard up on iOS 16.4+ thanks to
    // `interactive-widget=resizes-content` on the viewport meta.
    <div
      style={{
        display: visible ? "flex" : "none",
        flexDirection: "column",
        height: "100%",
        minHeight: 0,
        background: "var(--black, #000)",
        position: "relative",
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
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
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
          {mirrorDevice && (
            <span
              style={{
                fontFamily: "var(--font-data)",
                fontSize: 9,
                color: "var(--accent, #c79f4a)",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                padding: "2px 6px",
                border: "1px solid rgba(199,159,74,0.35)",
                borderRadius: 4,
              }}
            >
              ⟷ FROM DESKTOP
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <ConnectionStatus onStateChange={setRelayState} />
        </div>
      </div>

      {/* Messages area — momentum-scroll + contained overscroll so the page
          beneath doesn't rubber-band when a thread hits its ends. */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
          overscrollBehavior: "contain",
          display: "flex",
          flexDirection: "column",
          gap: 10,
          paddingTop: 12,
          paddingBottom: 16,
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
              padding: "0 32px",
              textAlign: "center",
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
                lineHeight: 1.5,
              }}
            >
              {isStandby
                ? "Message Harper directly, or pick up a dispatched conversation from the desktop relay."
                : "Chief Analyst Officer — ready when you are."}
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

      {/* Composer — sticky in the flex column. Replaces the old position:fixed
          + 100px spacer: with the viewport meta's `interactive-widget=
          resizes-content`, iOS resizes the layout when the keyboard opens,
          and a sticky child naturally rides the new bottom edge. No more
          keyboard-covering-the-input bug and no more dead spacer below the
          thread. */}
      <div
        style={{
          position: "sticky",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 10,
          flexShrink: 0,
        }}
      >
        <ChatInput
          onSend={sendMessage}
          isLoading={isLoading}
          disabled={isOffline}
        />
      </div>

      {/* Session list removed S21-T1 — mobile is remote-control only. */}
    </div>
  );
}
