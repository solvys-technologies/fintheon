// [claude-code 2026-04-25] S42-T2 mobile: MessageQueue + MobileCommandPalette wiring.
//   - Queue-while-streaming + offline localStorage persistence per
//     `fintheon:msgQueue:<conversationId>`.
//   - Listens for fintheon:persona-override (composer slash-commands) and routes that
//     turn through sendMessage; the persona signal is a window event since /api/relay/chat
//     doesn't accept an agent override yet (no backend changes per S42-T2 brief).
//   - Swipe-up on the composer opens MobileCommandPalette as a bottom sheet; long-press
//     send opens the queue editor (Edit-on-tap + Remove-on-tap chips).
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
// [claude-code 2026-04-25] S42-T7 mount-perf: initial /api/relay/health fetch was firing
// synchronously on mount, contending with first paint. Deferred to requestIdleCallback
// (with setTimeout(200ms) fallback for Safari < iOS 17). 20s polling cadence preserved.
// markMountStart fires before hooks; markComposerVisible fires after first paint via
// useLayoutEffect+rAF. mobile is per-dispatch only so historyMs only fires when a
// pending dispatch is hydrated from sessionStorage.
// [claude-code 2026-04-16] T3/T6: Full-screen Harper chat — SSE streaming via relay, background recovery
// Memory: feedback_keep_chat_mounted — use display:none not conditional render, streams survive navigation
// Memory: feedback_uimessagestream_framing — start/finish events in SSE stream

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  useLayoutEffect,
  useMemo,
} from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useSettings } from "../../contexts/SettingsContext";
import { getMobileBackend } from "../../lib/backend";
import {
  markComposerVisible,
  markHistoryReady,
  markMountStart,
} from "../../lib/mountTelemetry";
import ChatMessage, { type ChatMessageData } from "./ChatMessage";
import ChatInput from "./ChatInput";
import ConnectionStatus, { type RelayState } from "./ConnectionStatus";
import { ThinkingIndicator } from "./ThinkingIndicator";
import { ToolCallCard } from "./ToolCallCard";
import { ToolApprovalCard } from "./ToolApprovalCard";
// [claude-code 2026-04-25] S42-T4: artifact bottom sheet (TradingView/browserbase/report/citation)
import { ArtifactSheet } from "./ArtifactSheet";
import { useToolApprovals } from "../../hooks/useToolApprovals";
import MessageQueue, { type QueuedMessage } from "./MessageQueue";
import MobileCommandPalette from "./MobileCommandPalette";

const API_BASE = import.meta.env.VITE_API_URL || "";

const QUEUE_STORAGE_KEY = (convId: string | null) =>
  `fintheon:msgQueue:${convId ?? "anon"}`;
const HEALTH_POLL_MS = 10_000;

interface ChatPageProps {
  visible: boolean;
}

export default function ChatPage({ visible }: ChatPageProps) {
  // S42-T7: stamp before any hooks fire so timings include hook-init cost.
  markMountStart("chat-mobile");
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

  // ── S42-T2 mobile state ───────────────────────────────────────────────────
  const [pendingMessages, setPendingMessages] = useState<QueuedMessage[]>([]);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [showQueueEditor, setShowQueueEditor] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const composerRef = useRef<HTMLDivElement>(null);
  // Ref to track conversationId without stale closure (memory: feedback_useChat_stale_closure)
  const conversationIdRef = useRef(conversationId);
  conversationIdRef.current = conversationId;

  // S42-T7: stamp composer-visible after first paint via rAF double-tick.
  useLayoutEffect(() => {
    let raf1 = 0;
    let raf2 = 0;
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        if (composerRef.current) markComposerVisible("chat-mobile");
      });
    });
    return () => {
      if (raf1) cancelAnimationFrame(raf1);
      if (raf2) cancelAnimationFrame(raf2);
    };
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
        // S42-T7: stamp history-ready when a pending dispatch finishes hydrating.
        markHistoryReady("chat-mobile");
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
  // [claude-code 2026-04-25] S42-T7: first check is idle-deferred so it can't
  // contend with first paint; the 20s polling cadence is unchanged.
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
    // S42-T7: defer the first check so first paint isn't blocked by network.
    const idle = (
      window as unknown as {
        requestIdleCallback?: (
          cb: () => void,
          opts?: { timeout: number },
        ) => number;
      }
    ).requestIdleCallback;
    let idleHandle: number | undefined;
    let firstCheckTimeout: ReturnType<typeof setTimeout> | undefined;
    if (typeof idle === "function") {
      idleHandle = idle(() => void check(), { timeout: 1500 });
    } else {
      firstCheckTimeout = setTimeout(() => void check(), 200);
    }
    const id = setInterval(check, 20_000);
    return () => {
      cancelled = true;
      clearInterval(id);
      if (
        idleHandle !== undefined &&
        typeof (
          window as unknown as {
            cancelIdleCallback?: (h: number) => void;
          }
        ).cancelIdleCallback === "function"
      ) {
        (
          window as unknown as { cancelIdleCallback: (h: number) => void }
        ).cancelIdleCallback(idleHandle);
      }
      if (firstCheckTimeout !== undefined) clearTimeout(firstCheckTimeout);
    };
  }, [getAccessToken, loadRelayConversation]);

  // ── S42-T2: history + recent feed for the palette ────────────────────────
  const historyMessages = useMemo(
    () =>
      messages
        .filter((m) => m.role === "user")
        .slice(-10)
        .map((m) => m.content),
    [messages],
  );
  const recentForPalette = useMemo(
    () =>
      messages
        .filter((m) => m.role === "user")
        .slice(-10)
        .reverse()
        .map((m, i) => ({
          id: m.id ?? `recent-${i}`,
          text:
            m.content.length > 120 ? `${m.content.slice(0, 117)}…` : m.content,
        })),
    [messages],
  );

  // ── S42-T2: queue handlers ───────────────────────────────────────────────
  const enqueue = useCallback((text: string) => {
    const queued: QueuedMessage = {
      id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      text,
      timestamp: Date.now(),
    };
    setPendingMessages((prev) => [...prev, queued]);
  }, []);
  const handleQueueEdit = useCallback((id: string, newText: string) => {
    setPendingMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, text: newText } : m)),
    );
  }, []);
  const handleQueueRemove = useCallback((id: string) => {
    setPendingMessages((prev) => prev.filter((m) => m.id !== id));
  }, []);

  // ── S42-T2: localStorage hydrate / persist ───────────────────────────────
  useEffect(() => {
    try {
      const raw = localStorage.getItem(QUEUE_STORAGE_KEY(conversationId));
      if (!raw) return;
      const hydrated = JSON.parse(raw) as QueuedMessage[];
      if (Array.isArray(hydrated) && hydrated.length > 0) {
        setPendingMessages(hydrated);
      }
    } catch {
      /* ignore */
    }
  }, [conversationId]);
  useEffect(() => {
    try {
      const key = QUEUE_STORAGE_KEY(conversationId);
      if (pendingMessages.length === 0) localStorage.removeItem(key);
      else localStorage.setItem(key, JSON.stringify(pendingMessages));
    } catch {
      /* ignore */
    }
  }, [pendingMessages, conversationId]);

  // ── S42-T2: offline detection (poll /api/diagnostics) ────────────────────
  useEffect(() => {
    let cancelled = false;
    const probe = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/diagnostics`, {
          method: "GET",
          signal: AbortSignal.timeout(4_000),
        });
        if (!cancelled) setIsOnline(res.ok);
      } catch {
        if (!cancelled) setIsOnline(false);
      }
    };
    void probe();
    const id = setInterval(probe, HEALTH_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const sendMessage = useCallback(
    async (
      text: string,
      opts?: { images?: string[]; riskFlowContext?: string },
    ) => {
      // S42-T2: queue while streaming or offline; flush effect picks up later.
      if (isLoading || !isOnline) {
        enqueue(text);
        return;
      }

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
            setUserStatus("sent", "HARPER SILENT — CHECK DESKTOP RELAY");
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
      isOnline,
      enqueue,
      getAccessToken,
      settings.traderName,
      addApproval,
      resolveFromEvent,
    ],
  );

  // ── S42-T2: drain queue whenever idle + online + non-empty ───────────────
  // Each drain shifts one head and calls sendMessage, which sets isLoading=true
  // → effect re-fires → no-op until streaming finishes → re-fires → next drain.
  useEffect(() => {
    if (isLoading || !isOnline) return;
    if (pendingMessages.length === 0) return;
    const [head, ...rest] = pendingMessages;
    setPendingMessages(rest);
    void sendMessage(head.text);
  }, [isLoading, isOnline, pendingMessages, sendMessage]);

  // ── S42-T2: persona-override listener ────────────────────────────────────
  // Composer slash-commands dispatch this; mobile relays the stripped text
  // through sendMessage. /api/relay/chat doesn't currently route per-persona,
  // so this is a forward-pass for parity — backend wiring lands separately.
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as
        | { personaId?: string; text?: string }
        | undefined;
      if (typeof detail?.text !== "string") return;
      void sendMessage(detail.text);
    };
    window.addEventListener("fintheon:persona-override", handler);
    return () =>
      window.removeEventListener("fintheon:persona-override", handler);
  }, [sendMessage]);

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

        {/* Thinking indicator — shows during streaming until either an assistant
            message is inserted (first text-delta) or the existing assistant bubble
            picks up content. The last-msg-is-user case covers the new lazy-insert
            window where Harper hasn't sent a delta yet. */}
        <ThinkingIndicator
          isThinking={
            isLoading &&
            messages.length > 0 &&
            (messages[messages.length - 1].role === "user" ||
              (messages[messages.length - 1].role === "assistant" &&
                messages[messages.length - 1].content === ""))
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
        ref={composerRef}
        style={{
          position: "sticky",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 10,
          flexShrink: 0,
        }}
      >
        {/* S42-T2: queued strip + offline notice above the composer */}
        <MessageQueue
          queue={pendingMessages}
          onEdit={handleQueueEdit}
          onRemove={handleQueueRemove}
        />
        {!isOnline && pendingMessages.length > 0 && (
          <div
            style={{
              padding: "0 16px 6px",
              fontSize: 11,
              color: "var(--accent, #c79f4a)",
              opacity: 0.7,
            }}
          >
            Offline — {pendingMessages.length} queued, will flush on reconnect.
          </div>
        )}
        <ChatInput
          onSend={sendMessage}
          isLoading={isLoading}
          disabled={isOffline}
          historyMessages={historyMessages}
          onLongPressSend={() => setShowQueueEditor(true)}
          onSwipeUp={() => setPaletteOpen(true)}
        />
      </div>

      {/* S42-T2: bottom-sheet command palette (swipe-up from composer) */}
      <MobileCommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        recent={recentForPalette}
        onPickPersona={(personaId) => {
          // Persona pick = open the textarea pre-filled with the slash so the
          // user can type the rest of the prompt; mobile relay doesn't yet
          // route per-persona, so we surface the intent visually.
          window.dispatchEvent(
            new CustomEvent("fintheon:composer-fill", {
              detail: { text: `/${personaId} ` },
            }),
          );
        }}
        onPickRecent={(text) => {
          window.dispatchEvent(
            new CustomEvent("fintheon:composer-fill", { detail: { text } }),
          );
        }}
      />

      {/* S42-T2: queue editor sheet (long-press send opens it) */}
      {showQueueEditor && (
        <div
          onClick={() => setShowQueueEditor(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9998,
            background: "rgba(5,4,2,0.65)",
            display: "flex",
            alignItems: "flex-end",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxHeight: "60vh",
              background: "#050402",
              borderTop: "1px solid rgba(199,159,74,0.3)",
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              padding: "12px 0 24px",
              overflowY: "auto",
            }}
          >
            <div
              style={{
                width: 36,
                height: 3,
                background: "rgba(199,159,74,0.3)",
                borderRadius: 2,
                margin: "0 auto 8px",
              }}
            />
            <div
              style={{
                fontSize: 10,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "var(--accent, #c79f4a)",
                padding: "0 16px 8px",
              }}
            >
              Queue editor
            </div>
            {pendingMessages.length === 0 ? (
              <div
                style={{
                  padding: "16px",
                  fontSize: 12,
                  color: "var(--text-disabled)",
                  textAlign: "center",
                }}
              >
                Nothing queued.
              </div>
            ) : (
              <MessageQueue
                queue={pendingMessages}
                onEdit={handleQueueEdit}
                onRemove={handleQueueRemove}
              />
            )}
          </div>
        </div>
      )}

      {/* Session list removed S21-T1 — mobile is remote-control only. */}

      {/* S42-T4: artifact bottom sheet — mounted at shell level so it overlays
          the composer without disturbing the sticky-bottom flex column.
          Listens to fintheon:artifact CustomEvent (T3 citation chip / T1 stream relay). */}
      <ArtifactSheet />
    </div>
  );
}
