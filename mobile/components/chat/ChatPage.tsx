// [claude-code 2026-05-03] S58 deploy fix: mobile chat labels relay fallback as DeepSeek-backed, not VProxy/desktop-primary.
// [claude-code 2026-05-03] S58-T2: mobile chat uses direct DeepSeek SDK when a user key exists, relay otherwise.
// [claude-code 2026-05-04] S38-T5: added provider dropdown + first-time API key popup integration.
// [claude-code 2026-04-18] v5.22 S2: TP saw a hollow "thinking bubble" appear before any
// text streamed. Root cause: ChatPage pre-created the assistant message with content:""
// at send-time, and ChatMessage renders the bubble chrome unconditionally. Fix: defer the
// assistant insert until the first text-delta (or until an error event arrives first, in
// which case we insert a minimal assistant with the error text). The thinking indicator
// now gates on "last message is user" OR "last assistant is empty".
// Also: per-user-message delivery status (sending → sent → error) caption + a 12s no-stream
// watchdog ("HARPER SILENT — CHECK DESKTOP RELAY") so silence has a visible cause. The stream
// stays open through the watchdog so late events still paint.
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
import type { ChatMessageData } from "./ChatMessage";
import ChatInput from "./ChatInput";
import ConnectionStatus, { type RelayState } from "./ConnectionStatus";
import { ToolCallCard } from "./ToolCallCard";
import { ToolApprovalCard } from "./ToolApprovalCard";
import { useToolApprovals } from "../../hooks/useToolApprovals";
import { useConversations } from "../../hooks/useConversations";
import SessionList from "./SessionList";
import { AssistantMessagePrimitive } from "@frontend/components/chat/AssistantMessagePrimitive";
import { UserMessagePrimitive } from "@frontend/components/chat/UserMessagePrimitive";
import {
  AgentActivityRail,
  type ActivityEntry,
} from "@frontend/components/chat/AgentActivityRail";
import {
  ArtifactPane,
  type ArtifactPaneProps,
} from "@frontend/components/chat/ArtifactPane";
import { BrailleSpinner } from "@frontend/components/chat/primitive/BrailleSpinner";
import {
  createDeepSeekStreamResponse,
  fetchDeepSeekKey,
  type DeepSeekChatMessage,
} from "@frontend/lib/deepseek-sdk";
import { FirstTimeApiKeyPopup } from "@frontend/components/chat/FirstTimeApiKeyPopup";

const API_BASE = import.meta.env.VITE_API_URL || "";
const PROVIDER_STORAGE_KEY = "fintheon:harper-provider";

type HarperProvider = "deepseek-direct" | "opencode-go";

function normalizeProvider(raw: string | null): HarperProvider {
  return raw === "opencode-go" ? "opencode-go" : "deepseek-direct";
}

function useMobileHarperProvider() {
  const [provider, setProviderState] = useState<HarperProvider>(() => {
    try {
      return normalizeProvider(localStorage.getItem(PROVIDER_STORAGE_KEY));
    } catch {
      return "deepseek-direct";
    }
  });

  const setProvider = useCallback((next: HarperProvider) => {
    setProviderState(next);
    try {
      localStorage.setItem(PROVIDER_STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  return { provider, setProvider };
}

interface ChatPageProps {
  visible: boolean;
}

export default function ChatPage({ visible }: ChatPageProps) {
  const { getAccessToken } = useAuth();
  const { settings } = useSettings();
  const [messages, setMessages] = useState<ChatMessageData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [relayState, setRelayState] = useState<RelayState>("reconnecting");
  const [hasDirectDeepSeekKey, setHasDirectDeepSeekKey] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [mirrorDevice, setMirrorDevice] = useState<string | null>(null);
  const [activeToolCall, setActiveToolCall] = useState<{
    name: string;
    input?: string;
  } | null>(null);
  const { provider } = useMobileHarperProvider();
  const [showFirstTimePopup, setShowFirstTimePopup] = useState(false);
  const [activityEntries, setActivityEntries] = useState<ActivityEntry[]>([]);
  const [artifact, setArtifact] = useState<
    | (Omit<
        ArtifactPaneProps,
        | "onClose"
        | "variant"
        | "onBrowserTakeControl"
        | "onBrowserResumeAgent"
        | "isBrowserUserControlling"
      > & { artifactType: ArtifactPaneProps["artifactType"] })
    | null
  >(null);
  const { approvals, addApproval, resolveApproval, resolveFromEvent } =
    useToolApprovals();
  const {
    sessions,
    isLoading: sessionsLoading,
    loadSession,
    refresh: refreshSessions,
  } = useConversations();
  const [sessionsOpen, setSessionsOpen] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  // Ref to track conversationId without stale closure (memory: feedback_useChat_stale_closure)
  const conversationIdRef = useRef(conversationId);
  conversationIdRef.current = conversationId;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const key = await fetchDeepSeekKey({
        apiBaseUrl: API_BASE,
        getAccessToken,
      }).catch(() => null);
      if (!cancelled) setHasDirectDeepSeekKey(Boolean(key));
    })();
    return () => {
      cancelled = true;
    };
  }, [getAccessToken]);

  // S38-T5: First-time API key popup — check on mount
  useEffect(() => {
    try {
      if (localStorage.getItem("fintheon:chat-first-open") === null) {
        setShowFirstTimePopup(true);
      }
    } catch {
      /* ignore */
    }
  }, []);
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

  const handleSelectSession = useCallback(
    async (id: string) => {
      const session = await loadSession(id);
      if (!session) return;
      setMessages(
        session.messages
          .filter((m) => m.role === "user" || m.role === "assistant")
          .map((m) => ({
            id: m.id,
            role: m.role as "user" | "assistant",
            content: m.content,
            timestamp: m.createdAt,
          })),
      );
      setConversationId(session.id);
      setSessionsOpen(false);
    },
    [loadSession],
  );

  const handleNewSession = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    setConversationId(null);
    setMirrorDevice(null);
    setSessionsOpen(false);
  }, []);

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

  // Listen for citation chip / artifact events dispatched from message primitives
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail) return;
      if (detail.kind === "citation" && detail.payload) {
        setArtifact({
          artifactType: "citation",
          citationSource: {
            title: detail.payload.title ?? detail.payload.source ?? "Source",
            url: detail.payload.url,
            content: detail.payload.content,
          },
        });
      } else if (detail.kind && detail.payload) {
        // Generic artifact dispatch
        setArtifact({
          artifactType: detail.kind,
          ...detail.payload,
        });
      }
    };
    window.addEventListener("fintheon:artifact", handler);
    return () => window.removeEventListener("fintheon:artifact", handler);
  }, []);

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

      const userId = `user-${Date.now()}`;
      const userMsg: ChatMessageData = {
        id: userId,
        role: "user",
        content: text,
        timestamp: new Date().toISOString(),
        status: "sending",
      };
      setMessages((prev) => [...prev, userMsg]);
      setIsLoading(true);

      const assistantId = `harper-${Date.now()}`;
      let assistantInserted = false;
      let eventCount = 0;
      let watchdog: ReturnType<typeof setTimeout> | null = null;

      // Lazy assistant insert — fires on first text-delta (or first error frame)
      // so a hollow bubble never paints when the backend stays silent.
      const ensureAssistant = (initialContent: string) => {
        if (assistantInserted) return;
        assistantInserted = true;
        setMessages((prev) => [
          ...prev,
          {
            id: assistantId,
            role: "assistant",
            content: initialContent,
            timestamp: new Date().toISOString(),
          },
        ]);
      };

      const setUserStatus = (
        status: "sending" | "sent" | "error",
        silentHint?: string,
      ) => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === userId
              ? {
                  ...m,
                  status,
                  ...(silentHint !== undefined ? { silentHint } : {}),
                }
              : m,
          ),
        );
      };

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const directMessages: DeepSeekChatMessage[] = messages
          .filter(
            (message) =>
              message.role === "user" || message.role === "assistant",
          )
          .map((message) => ({ role: message.role, content: message.content }));
        directMessages.push({
          role: "user",
          content: opts?.riskFlowContext
            ? `${text}\n\nRiskFlow context:\n${opts.riskFlowContext}`
            : text,
        });

        const res =
          provider === "deepseek-direct" && !opts?.images?.length
            ? (
                await createDeepSeekStreamResponse(directMessages, {
                  provider: "deepseek-direct",
                  apiBaseUrl: API_BASE,
                  conversationId: conversationIdRef.current,
                  getAccessToken,
                  signal: controller.signal,
                  title: text.slice(0, 80),
                })
              ).response
            : await (async () => {
                const token = await getAccessToken();
                const headers: Record<string, string> = {
                  "Content-Type": "application/json",
                  Accept: "text/event-stream",
                };
                if (token) headers["Authorization"] = `Bearer ${token}`;
                return fetch(`${API_BASE}/api/relay/chat`, {
                  method: "POST",
                  headers,
                  body: JSON.stringify({
                    message: text,
                    provider,
                    conversationId: conversationIdRef.current,
                    ...(opts?.images?.length ? { images: opts.images } : {}),
                    ...(opts?.riskFlowContext
                      ? { riskFlowContext: opts.riskFlowContext }
                      : {}),
                    ...(settings.traderName
                      ? { traderName: settings.traderName }
                      : {}),
                  }),
                  signal: controller.signal,
                });
              })();

        if (!res.ok) {
          const err = await res
            .json()
            .catch(() => ({ error: "Request failed" }));
          setUserStatus("error");
          ensureAssistant(`[ERROR: ${err.error || res.statusText}]`);
          setIsLoading(false);
          return;
        }

        setUserStatus("sent");

        // 12s no-stream watchdog — surface a visible reason for silence without
        // closing the stream, so late events still paint into a fresh bubble.
        watchdog = setTimeout(() => {
          if (eventCount === 0) {
            setUserStatus(
              "sent",
              provider === "deepseek-direct"
                ? "DEEPSEEK SILENT — CHECK API KEY"
                : "HARPER SILENT — CHECK BACKEND",
            );
          }
        }, 12_000);

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
              eventCount += 1;
              if (event.type === "text-delta" && event.delta) {
                setActiveToolCall(null);
                if (!assistantInserted) {
                  ensureAssistant(event.delta);
                } else {
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantId
                        ? { ...m, content: m.content + event.delta }
                        : m,
                    ),
                  );
                }
              } else if (
                event.type === "tool_use" ||
                event.type === "tool-use"
              ) {
                const toolName = event.name || event.tool || "unknown";
                setActiveToolCall({
                  name: toolName,
                  input:
                    typeof event.input === "string"
                      ? event.input
                      : event.input
                        ? JSON.stringify(event.input).slice(0, 120)
                        : undefined,
                });
                // Push to AgentActivityRail
                setActivityEntries((prev) => [
                  ...prev,
                  {
                    id: `tool-${Date.now()}-${prev.length}`,
                    type: "tool_call",
                    label: toolName,
                    detail:
                      typeof event.input === "string"
                        ? event.input.slice(0, 80)
                        : event.input
                          ? JSON.stringify(event.input).slice(0, 80)
                          : undefined,
                    timestamp: new Date(),
                    status: "running",
                  },
                ]);
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
                setUserStatus("error");
                if (!assistantInserted) {
                  ensureAssistant(`[ERROR: ${errText}]`);
                } else {
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
                }
              } else if (
                event.type === "finish" &&
                event.finishReason === "error"
              ) {
                // Stream ended in error but no explicit error event fired — fall back.
                setUserStatus("error");
                if (!assistantInserted) {
                  ensureAssistant("[ERROR: Harper failed — no response]");
                } else {
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
              } else if (import.meta.env.DEV) {
                console.debug("[harper-sse] unknown event", event);
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
        setUserStatus("error");
        if (!assistantInserted) {
          ensureAssistant("[ERROR: CONNECTION LOST]");
        } else {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: "[ERROR: CONNECTION LOST]" }
                : m,
            ),
          );
        }
      } finally {
        if (watchdog) clearTimeout(watchdog);
        setIsLoading(false);
        setActiveToolCall(null);
        abortRef.current = null;
      }
    },
    [
      isLoading,
      getAccessToken,
      settings.traderName,
      provider,
      messages,
      addApproval,
      resolveFromEvent,
    ],
  );

  const isOffline = relayState === "offline" && provider !== "deepseek-direct";
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
          <button
            type="button"
            onClick={() => {
              void refreshSessions();
              setSessionsOpen(true);
            }}
            style={{
              background: "transparent",
              border: "1px solid rgba(199,159,74,0.24)",
              borderRadius: 4,
              color: "var(--accent, #c79f4a)",
              fontFamily: "var(--font-data)",
              fontSize: 9,
              letterSpacing: "0.08em",
              padding: "3px 7px",
              textTransform: "uppercase",
            }}
          >
            History
          </button>
          <span
            style={{
              fontFamily: "var(--font-data)",
              fontSize: 9,
              color: "var(--accent, #c79f4a)",
              letterSpacing: "0.1em",
              padding: "2px 6px",
              border: "1px solid rgba(199,159,74,0.35)",
              borderRadius: 4,
            }}
          >
            {provider === "deepseek-direct" ? "DEEPSEEK DIRECT" : "OPENCODE GO"}
          </span>
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
        {/* S38-T2: Render messages via primitives (Nothing-design, t-text-swap, braille spinners) */}
        {messages.map((msg) =>
          msg.role === "user" ? (
            <UserMessagePrimitive
              key={msg.id}
              rawContent={msg.content}
              createdAt={new Date(msg.timestamp)}
            />
          ) : (
            <AssistantMessagePrimitive
              key={msg.id}
              rawContent={msg.content}
              messageId={msg.id}
              agentName="Harper"
            />
          ),
        )}

        {/* BrailleSpinner — replaces legacy ThinkingIndicator */}
        {isLoading &&
          messages.length > 0 &&
          (messages[messages.length - 1].role === "user" ||
            (messages[messages.length - 1].role === "assistant" &&
              messages[messages.length - 1].content === "")) && (
            <div className="flex justify-start px-4 py-1">
              <BrailleSpinner size={12} label="Thinking" />
            </div>
          )}

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

      {/* S38-T2: AgentActivityRail — drawer variant for mobile, docked below messages */}
      <AgentActivityRail
        entries={activityEntries}
        isStreaming={isLoading}
        variant="drawer"
      />

      {/* S38-T2: ArtifactPane — bottom sheet (60% height, swipe-up expand) for artifact content */}
      {artifact && (
        <div
          className="flex flex-col border-t bg-[#050402]"
          style={{
            borderColor: "#c79f4a26",
            maxHeight: "60vh",
            minHeight: "30vh",
            overflowY: "auto",
          }}
        >
          <ArtifactPane
            {...artifact}
            variant="sheet"
            onClose={() => setArtifact(null)}
          />
        </div>
      )}

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

      {/* S38-T5: First-time API key popup */}
      {showFirstTimePopup && (
        <FirstTimeApiKeyPopup
          visible={showFirstTimePopup}
          surface="mobile"
          onDismiss={() => setShowFirstTimePopup(false)}
        />
      )}

      <SessionList
        open={sessionsOpen}
        onClose={() => setSessionsOpen(false)}
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
