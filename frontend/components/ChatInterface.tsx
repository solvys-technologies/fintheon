// [claude-code 2026-04-25] S42-T4: dual-pane → real ArtifactPane (TradingView/browserbase/report/citation)
// [claude-code 2026-03-29] S9-T5: Replace checkpoint sidebar with real conversation history, Take Note button
// [claude-code 2026-03-28] S8-T7: Dual-pane layout (left=conversation, right=artifacts) for Chat
import { useState, useRef, useCallback, useEffect } from "react";
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
import { ArtifactPane } from "./chat/ArtifactPane";
import { ARTIFACT_EVENT, type ArtifactPayload } from "./chat/artifactTypes";
import { SKILL_PREFIXES } from "../lib/skillPrefixes";
import QuickFintheonModal from "./analysis/QuickFintheonModal";
import { useFeatureFlags } from "../hooks/useFeatureFlags";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";

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
  const { activeAgent } = useFintheonAgents();
  const runtime = useThreadRuntime();
  const isRunning = useThread((t) => t.isRunning);

  const [activeSkill, setActiveSkill] = useState<string | null>(null);
  const [showSkills, setShowSkills] = useState(false);
  const { disabledSkills } = useFeatureFlags();
  const [showQuickFintheonModal] = useState(false);
  const [currentArtifact, setCurrentArtifact] = useState<ArtifactPayload | null>(
    null,
  );
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const splitContainerRef = useRef<HTMLDivElement | null>(null);

  const handleSend = useCallback(
    (msg: string) => {
      runtime.append({ role: "user", content: [{ type: "text", text: msg }] });
    },
    [runtime],
  );

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
