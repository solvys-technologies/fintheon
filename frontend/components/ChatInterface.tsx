// [claude-code 2026-04-25] S42-T4: dual-pane → real ArtifactPane (TradingView/browserbase/report/citation)
// [claude-code 2026-04-25] S42-T2: Cmd+K palette + Esc cancel/close + MessageQueue wiring
//   (queue-while-streaming + offline-localStorage persistence) + slash-command persona override
//   listener. Greetings/suggestion chips (ChatGreeting in FintheonThread) and the dual-pane
//   artifact slot are untouched — composer-mount + state-wiring only, per S42-T2 brief.
// [claude-code 2026-03-29] S9-T5: Replace checkpoint sidebar with real conversation history, Take Note button
// [claude-code 2026-03-28] S8-T7: Dual-pane layout (left=conversation, right=artifacts) for Chat
import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { X, Layers } from "lucide-react";
import {
  AssistantRuntimeProvider,
  useThread,
  useThreadRuntime,
} from "@assistant-ui/react";
import { useFintheonAgents } from "../contexts/FintheonAgentContext";
import { useHermesRuntime } from "./chat/useHermesRuntime";
import { ChatHeader } from "./chat/ChatHeader";
import { FintheonThread, AiLoader } from "./chat/FintheonThread";
import { FintheonComposer } from "./chat/FintheonComposer";
import { MessageQueue, type QueuedMessage } from "./chat/MessageQueue";
import {
  CommandPalette,
  pickRecentUserMessages,
} from "./chat/CommandPalette";
import { ArtifactPane } from "./chat/ArtifactPane";
import { ARTIFACT_EVENT, type ArtifactPayload } from "./chat/artifactTypes";
import { SKILL_PREFIXES } from "../lib/skillPrefixes";
import QuickFintheonModal from "./analysis/QuickFintheonModal";
import { useFeatureFlags } from "../hooks/useFeatureFlags";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";

const QUEUE_STORAGE_KEY = (convId?: string) =>
  `fintheon:msgQueue:${convId ?? "anon"}`;
const HEALTH_POLL_MS = 10_000;

function ChatInterfaceInner({
  conversationId,
  setConversationId,
  clearConversationId,
  lastError,
  thinkHarder,
  setThinkHarder,
  lastRequestId,
  dualPane = false,
}: {
  conversationId: string | undefined;
  setConversationId: (id: string) => void;
  clearConversationId: () => void;
  lastError: string | null;
  thinkHarder: boolean;
  setThinkHarder: (v: boolean) => void;
  lastRequestId: string | null;
  dualPane?: boolean;
}) {
  const { activeAgent, agents, setActiveAgent } = useFintheonAgents();
  const runtime = useThreadRuntime();
  const isRunning = useThread((t) => t.isRunning);
  const messages = useThread((t) => t.messages);

  const [activeSkill, setActiveSkill] = useState<string | null>(null);
  const [showSkills, setShowSkills] = useState(false);
  const { disabledSkills } = useFeatureFlags();
  const [showQuickFintheonModal] = useState(false);
  const [currentArtifact, setCurrentArtifact] = useState<ArtifactPayload | null>(
    null,
  );
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const splitContainerRef = useRef<HTMLDivElement | null>(null);

  // ── S42-T2 state ──────────────────────────────────────────────────────────
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [pendingMessages, setPendingMessages] = useState<QueuedMessage[]>([]);
  const [isOnline, setIsOnline] = useState(true);
  // Persona-override coordination — set by the window event listener; the agent-
  // change effect picks it up after the runtime rebuilds.
  const pendingOverrideRef = useRef<{
    text: string;
    images?: string[];
    targetAgentId: string;
    prevAgentId: string | null;
  } | null>(null);

  // Last 10 user messages for ↑↓ history recall (oldest → newest).
  const historyMessages = useMemo(() => {
    const recent = pickRecentUserMessages(messages as any[], 10);
    // pickRecentUserMessages returns newest → oldest; PromptBox expects
    // oldest → newest so ↑ from the bottom hits the most recent first.
    return recent.map((r) => r.text).reverse();
  }, [messages]);

  const recentForPalette = useMemo(
    () => pickRecentUserMessages(messages as any[], 10),
    [messages],
  );

  const handleSend = useCallback(
    (msg: string) => {
      runtime.append({ role: "user", content: [{ type: "text", text: msg }] });
    },
    [runtime],
  );

  // ── S42-T2: queue-while-streaming ─────────────────────────────────────────
  // Composer calls this when the user submits while the assistant is mid-turn.
  // Returns true to signal the composer that the message is queued (so it can
  // still clear the textarea).
  const handleQueueWhileStreaming = useCallback(
    (text: string, _images?: string[]): boolean => {
      const queued: QueuedMessage = {
        id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        text,
        timestamp: Date.now(),
      };
      setPendingMessages((prev) => [...prev, queued]);
      return true;
    },
    [],
  );

  const handleQueueEdit = useCallback((id: string, newText: string) => {
    setPendingMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, text: newText } : m)),
    );
  }, []);

  const handleQueueRemove = useCallback((id: string) => {
    setPendingMessages((prev) => prev.filter((m) => m.id !== id));
  }, []);

  // ── S42-T2: drain queue whenever idle + online + non-empty ───────────────
  // Each drain shifts one head and appends; the runtime flips isRunning=true
  // → effect re-fires → no-op until streaming finishes → re-fires → next drain.
  // Covers stream-complete flush AND reconnect drain in one effect.
  useEffect(() => {
    if (isRunning || !isOnline) return;
    if (pendingMessages.length === 0) return;
    const [head, ...rest] = pendingMessages;
    setPendingMessages(rest);
    runtime.append({
      role: "user",
      content: [{ type: "text", text: head.text }],
    });
  }, [isRunning, pendingMessages, isOnline, runtime]);

  // ── S42-T2: localStorage persistence (offline path) ───────────────────────
  // Hydrate any queue saved under the current conversation id on mount /
  // conversation switch. Persist on every change so a crash mid-offline
  // doesn't lose the user's typed-but-unsent messages.
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
      if (pendingMessages.length === 0) {
        localStorage.removeItem(key);
      } else {
        localStorage.setItem(key, JSON.stringify(pendingMessages));
      }
    } catch {
      /* ignore */
    }
  }, [pendingMessages, conversationId]);

  // ── S42-T2: offline detection (poll /api/diagnostics every 10s) ──────────
  // Used to gate the queue flush — when offline we hold; when reconnecting we
  // drain. Single-flight via cancelled flag.
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

  // ── S42-T2: keyboard handlers (Cmd+K, Esc) ───────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().includes("MAC");
      const cmdKey = isMac ? e.metaKey : e.ctrlKey;
      if (cmdKey && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setPaletteOpen((open) => !open);
        return;
      }
      if (e.key === "Escape") {
        if (paletteOpen) {
          setPaletteOpen(false);
          return;
        }
        if (isRunning) {
          try {
            runtime.cancelRun();
          } catch (err) {
            console.error("[ChatInterface] cancelRun failed:", err);
          }
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [paletteOpen, isRunning, runtime]);

  // ── S42-T2: persona-override listener ────────────────────────────────────
  // Composer dispatches this on slash-command match. We capture the prior
  // agent, swap to the target, and stash the message in a ref. The follow-up
  // effect (below) fires when the runtime rebuilds against the new agent.
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as
        | { personaId: string; text: string; images?: string[] }
        | undefined;
      if (!detail) return;
      const target = agents.find((a) => a.id === detail.personaId);
      if (!target) {
        console.warn(
          "[ChatInterface] persona-override target not found:",
          detail.personaId,
        );
        return;
      }
      pendingOverrideRef.current = {
        text: detail.text,
        images: detail.images,
        targetAgentId: target.id,
        prevAgentId: activeAgent?.id ?? null,
      };
      setActiveAgent(target);
    };
    window.addEventListener("fintheon:persona-override", handler);
    return () =>
      window.removeEventListener("fintheon:persona-override", handler);
  }, [agents, activeAgent, setActiveAgent]);

  // Effect-half of the persona-override: fires after activeAgent has settled.
  // Appends the override message via the runtime that was just rebuilt, then
  // schedules restoration of the prior agent (after the request kicks off).
  useEffect(() => {
    const pending = pendingOverrideRef.current;
    if (!pending) return;
    if (activeAgent?.id !== pending.targetAgentId) return;
    pendingOverrideRef.current = null;
    const content: Array<{ type: string; text?: string; image?: string }> = [
      { type: "text", text: pending.text },
    ];
    if (pending.images?.length) {
      pending.images.forEach((img) =>
        content.push({ type: "image", image: img }),
      );
    }
    try {
      runtime.append({ role: "user", content: content as any });
    } catch (err) {
      console.error(
        "[ChatInterface] persona-override append failed:",
        err,
      );
    }
    if (pending.prevAgentId) {
      const prev = agents.find((a) => a.id === pending.prevAgentId);
      if (prev) {
        // Hold the override agent long enough for the request to complete the
        // active-agent read; then swap back so the dropdown reflects the user's
        // default. 200ms is comfortably past the synchronous request build.
        const restoreId = setTimeout(() => setActiveAgent(prev), 200);
        return () => clearTimeout(restoreId);
      }
    }
  }, [activeAgent, runtime, agents, setActiveAgent]);

  // Skill-aware send — activates skill and prepends prefix before sending
  const handleSkillSend = useCallback(
    (skillId: string, msg: string) => {
      setActiveSkill(skillId);
      const prefix = SKILL_PREFIXES[skillId] || "";
      const finalText = prefix ? `${prefix}\n\n${msg}` : msg;
      runtime.append({
        role: "user",
        content: [{ type: "text", text: finalText }],
      });
    },
    [runtime],
  );

  // Listen for external open-chat-skill events (e.g. from Regime Tracker AI Generate)
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.skillId && detail?.prompt) {
        handleSkillSend(detail.skillId, detail.prompt);
      }
    };
    window.addEventListener("fintheon:open-chat-skill", handler);
    return () =>
      window.removeEventListener("fintheon:open-chat-skill", handler);
  }, [handleSkillSend]);

  // S42-T4: artifact pane — listen to CustomEvent (T3 CitationChip, T1 SSE relay).
  // Only mount in dual-pane mode (Chat main surface). Pane persists until user
  // closes via X or a new artifact replaces the current one.
  useEffect(() => {
    if (!dualPane) return;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<ArtifactPayload>).detail;
      if (!detail || !detail.kind) return;
      setCurrentArtifact(detail);
    };
    window.addEventListener(ARTIFACT_EVENT, handler);
    return () => window.removeEventListener(ARTIFACT_EVENT, handler);
  }, [dualPane]);

  const handleNewChat = useCallback(() => {
    clearConversationId();
  }, [clearConversationId]);

  const handleTakeNote = useCallback(
    async (messageId: string, content: string) => {
      try {
        await fetch(`${API_BASE}/api/context-bank/memories`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agentId: "harper-opus",
            memoryType: "observation",
            content: content.slice(0, 500),
            metadata: {
              source: "take-note",
              messageId,
              conversationId,
              timestamp: new Date().toISOString(),
            },
          }),
        });
      } catch (err) {
        console.error("[TakeNote] Failed to save:", err);
      }
    },
    [conversationId],
  );

  return (
    <div className="h-full flex flex-col">
      <ChatHeader
        onRunMDB={() => handleSend("Run the MDB report")}
        onNewChat={handleNewChat}
        onSelectSession={(id) => setConversationId(id)}
        onNewSession={handleNewChat}
        currentConversationId={conversationId}
        isLoading={isRunning}
      />

      <div
        ref={splitContainerRef}
        className="flex-1 flex min-h-0 overflow-hidden"
      >
        <div className="flex-1 flex flex-col min-h-0 relative">
          <FintheonThread
            onSend={handleSend}
            isLoading={isRunning}
            agentName={activeAgent?.name}
            onTakeNote={handleTakeNote}
            messageRefs={messageRefs}
            lastError={lastError}
            lastRequestId={lastRequestId}
          />
          {/* Subtle fade above composer — matches Boardroom style */}
          <div
            className="pointer-events-none absolute bottom-0 left-0 right-0 z-10"
            style={{
              height: "80px",
              background:
                "linear-gradient(to bottom, transparent 0%, var(--fintheon-bg) 100%)",
            }}
          />
          <div className="relative z-20 shrink-0">
            {/* S42-T2: queued messages above composer; rendering self-gates to
                null when queue is empty, so this adds zero DOM in the common
                case. Edit/remove buttons are wired to local state. */}
            <div className="px-4">
              <MessageQueue
                queue={pendingMessages}
                onEdit={handleQueueEdit}
                onRemove={handleQueueRemove}
              />
              {!isOnline && pendingMessages.length > 0 && (
                <div className="mb-2 rounded-md border border-[var(--fintheon-accent)]/20 bg-[#0d0c09] px-3 py-1.5 text-[11px] text-[var(--fintheon-accent)]/70">
                  Offline — {pendingMessages.length} queued, will flush on
                  reconnect.
                </div>
              )}
            </div>
            <FintheonComposer
              thinkHarder={thinkHarder}
              setThinkHarder={setThinkHarder}
              lastError={lastError}
              activeSkill={activeSkill}
              onSelectSkill={setActiveSkill}
              showSkills={showSkills}
              onToggleSkills={() => setShowSkills((v) => !v)}
              disabledSkills={disabledSkills}
              conversationId={conversationId}
              onConversationGone={clearConversationId}
              onQueueWhileStreaming={handleQueueWhileStreaming}
              historyMessages={historyMessages}
            />
          </div>
        </div>

        {/* Preview pane — right side, only in dual-pane mode (Chat main).
            Mounts when a TradingView/browserbase/report/citation artifact arrives
            via fintheon:artifact CustomEvent or BridgeStreamEvent. */}
        {dualPane && (
          <ArtifactPane
            artifact={currentArtifact}
            onClose={() => setCurrentArtifact(null)}
            containerRef={splitContainerRef}
          />
        )}
      </div>

      <QuickFintheonModal
        isOpen={showQuickFintheonModal}
        onClose={() => {}}
        onAnalysisComplete={() => {}}
      />

      {/* S42-T2: cmdk command palette — Cmd+K from any chat surface. Persona
          picks dispatch the same fintheon:persona-override event the composer
          uses; surface picks emit a navigation event other surfaces listen
          for; recent picks prefill the textarea via fintheon:composer-fill. */}
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        recent={recentForPalette}
        onPickPersona={(personaId) => {
          const target = agents.find((a) => a.id === personaId);
          if (target) setActiveAgent(target);
        }}
        onPickSurface={(surfaceId) => {
          window.dispatchEvent(
            new CustomEvent("fintheon:navigate-surface", {
              detail: { surfaceId },
            }),
          );
        }}
        onPickRecent={(text) => {
          window.dispatchEvent(
            new CustomEvent("fintheon:composer-fill", { detail: { text } }),
          );
        }}
      />
    </div>
  );
}

export default function ChatInterface({
  surfaceId = "analysis",
}: {
  surfaceId?: string;
}) {
  const { activeAgent } = useFintheonAgents();
  const [thinkHarderState, setThinkHarderState] = useState(false);
  const {
    runtime,
    conversationId,
    setConversationId,
    clearConversationId,
    lastError,
    lastRequestId,
  } = useHermesRuntime(
    activeAgent?.id ?? "default",
    thinkHarderState,
    surfaceId,
  );

  // Chat main surface gets dual-pane layout (conversation + artifacts)
  const isDualPane = surfaceId === "chat";

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <ChatInterfaceInner
        conversationId={conversationId}
        setConversationId={setConversationId}
        clearConversationId={clearConversationId}
        lastError={lastError}
        thinkHarder={thinkHarderState}
        setThinkHarder={setThinkHarderState}
        lastRequestId={lastRequestId}
        dualPane={isDualPane}
      />
    </AssistantRuntimeProvider>
  );
}
