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
import type { ArtifactPaneProps } from "./chat/ArtifactPane";
import type { Citation } from "./chat/CitationChip";
import type { ActivityEntry } from "./chat/AgentActivityRail";
import { TodoDrawer } from "./chat/TodoDrawer";
import { useTodoList } from "./chat/hooks/useTodoList";
import { useMessageQueue } from "./chat/hooks/useMessageQueue";
import {
  useChatUiActions,
  type ChatUiTodoItem,
} from "./chat/hooks/useChatUiActions";
import { useAutoCollapseDrawer } from "./chat/hooks/useAutoCollapseDrawer";
import { ChatQuestionApprovalDrawer } from "./chat/ChatQuestionApprovalDrawer";
import { ChatDrawerPeek } from "./chat/ChatDrawerPeek";
import { normalizeReasoningLevel, shouldThinkHarder } from "./chat/reasoning";
import type { ReasoningLevel } from "./chat/reasoning";
import { SKILL_PREFIXES } from "../lib/skillPrefixes";
import QuickFintheonModal from "./analysis/QuickFintheonModal";
import { useFeatureFlags } from "../hooks/useFeatureFlags";
import { consumePendingChatPrompt } from "../lib/desk-week-plan";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";

function ChatInterfaceInner({
  conversationId,
  setConversationId,
  clearConversationId,
  lastError,
  thinkHarder,
  setThinkHarder,
  reasoningLevel,
  setReasoningLevel,
  lastRequestId,
  dualPane = false,
}: {
  conversationId: string | undefined;
  setConversationId: (id: string) => void;
  clearConversationId: () => void;
  lastError: string | null;
  thinkHarder: boolean;
  setThinkHarder: (v: boolean) => void;
  reasoningLevel: ReasoningLevel;
  setReasoningLevel: (level: ReasoningLevel) => void;
  lastRequestId: string | null;
  dualPane?: boolean;
}) {
  const { activeAgent } = useFintheonAgents();
  const runtime = useThreadRuntime();
  const isRunning = useThread((t) => t.isRunning);
  const threadMessages = useThread((t) => t.messages);

  const [activeSkill, setActiveSkill] = useState<string | null>(null);
  const [showSkills, setShowSkills] = useState(false);
  const { disabledSkills } = useFeatureFlags();
  const [showQuickFintheonModal] = useState(false);
  const [showArtifacts, setShowArtifacts] = useState(true);
  const [hasChatStarted, setHasChatStarted] = useState(false);
  const [artifactWidth, setArtifactWidth] = useState(() => {
    try {
      return Number(localStorage.getItem("fintheon:chat-artifact-width")) || 390;
    } catch {
      return 390;
    }
  });

  /* S38-T2: Artifact pane config — routes to correct sub-pane type */
  const [artifactConfig, setArtifactConfig] = useState<{
    artifactType: ArtifactPaneProps["artifactType"];
    tradingViewConfig?: { symbol: string; timeframe?: string };
    browserSessionId?: string;
    browserStatus?: "starting" | "active" | "closed";
    reportHtml?: string;
    reportMarkdown?: string;
    citationSource?: { title: string; url?: string; content?: string };
    narrativeCanvasId?: string;
  } | null>(null);

  /* S38-T2: Dummy activity entries + citation state to pass through */
  const [activityEntries] = useState<ActivityEntry[]>([]);
  const [citations] = useState<Citation[]>([]);
  const [pinnedCitationIndex, setPinnedCitationIndex] = useState<
    number | undefined
  >(undefined);

  const [showTodoDrawer, setShowTodoDrawer] = useState(false);
  const [approvalDrawerCollapsed, setApprovalDrawerCollapsed] = useState(false);
  const previousWorkItemCountRef = useRef(0);
  const hasMountedWorkDrawerRef = useRef(false);
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Todo list state — persisted to localStorage
  const { todos, addTodo, toggleTodo, removeTodo } = useTodoList();

  const sendNow = useCallback(
    (msg: string) => {
      setHasChatStarted(true);
      runtime.append({ role: "user", content: [{ type: "text", text: msg }] });
    },
    [runtime],
  );

  const {
    queue,
    addQueue,
    editQueue,
    removeQueue,
    reorderQueue,
    sendOne,
    sendAll,
  } = useMessageQueue({
    isRunning,
    sendNow,
  });
  const workItemCount = todos.length + queue.length;
  const hasWorkDrawerContent = workItemCount > 0;

  const handleSend = useCallback(
    (msg: string) => {
      if (isRunning) {
        addQueue(msg);
        setHasChatStarted(true);
        return;
      }
      sendNow(msg);
    },
    [addQueue, isRunning, sendNow],
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
      setHasChatStarted(true);
    },
    [runtime],
  );

  useEffect(() => {
    if (threadMessages.length > 0) setHasChatStarted(true);
  }, [threadMessages.length]);

  useEffect(() => {
    const previousCount = previousWorkItemCountRef.current;
    if (!hasMountedWorkDrawerRef.current) {
      hasMountedWorkDrawerRef.current = true;
      previousWorkItemCountRef.current = workItemCount;
      if (workItemCount === 0) setShowTodoDrawer(false);
      return;
    }
    previousWorkItemCountRef.current = workItemCount;
    if (workItemCount === 0) {
      setShowTodoDrawer(false);
      return;
    }
    if (previousCount === 0 || workItemCount > previousCount) {
      setShowTodoDrawer(true);
    }
  }, [workItemCount]);

  useEffect(() => {
    try {
      localStorage.setItem("fintheon:chat-artifact-width", String(artifactWidth));
    } catch {
      /* ignore */
    }
  }, [artifactWidth]);

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

  // Listen for direct chat text injection (e.g. RiskFlow preview card)
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.text) {
        consumePendingChatPrompt();
        handleSend(detail.text);
      }
    };
    window.addEventListener("fintheon:send-chat-text", handler);
    return () => window.removeEventListener("fintheon:send-chat-text", handler);
  }, [handleSend]);

  useEffect(() => {
    const pending = consumePendingChatPrompt();
    if (pending) handleSend(pending);
  }, [handleSend]);

  /* S38-T2: Pin a citation → opens artifact pane with type="citation" */
  const handlePinCitation = useCallback((citation: Citation) => {
    setPinnedCitationIndex(citation.index);
    setArtifactConfig({
      artifactType: "citation",
      citationSource: {
        title: citation.title,
        url: citation.sourceId,
        content: citation.excerpt,
      },
    });
    setShowArtifacts(true);
  }, []);

  /* S38-T2: Close artifact pane */
  const handleCloseArtifact = useCallback(() => {
    setShowArtifacts(false);
    setArtifactConfig(null);
    setPinnedCitationIndex(undefined);
  }, []);

  const handleTodoUiAction = useCallback(
    (payload: { items: ChatUiTodoItem[] }) => {
      for (const item of payload.items) {
        addTodo(item.text, {
          issueTrackingType: item.issueType,
          source: "harper-ui-tool",
        });
      }
      setShowTodoDrawer(true);
    },
    [addTodo],
  );

  const handleRightRailUiAction = useCallback(
    (payload: { title: string; markdown: string }) => {
      setArtifactConfig({
        artifactType: "report",
        reportMarkdown: `# ${payload.title}\n\n${payload.markdown}`,
      });
      setShowArtifacts(true);
    },
    [],
  );

  const {
    questionnaire,
    answerWidgets,
    isSubmittingAnswers,
    submitAnswers,
  } = useChatUiActions(lastRequestId, {
    onTodoDrawer: handleTodoUiAction,
    onRightRail: handleRightRailUiAction,
  });

  useEffect(() => {
    setApprovalDrawerCollapsed(false);
  }, [questionnaire?.actionId]);

  const approvalDrawerOpen = !!questionnaire && !approvalDrawerCollapsed;
  const workDrawerOpen =
    showTodoDrawer && hasWorkDrawerContent && !questionnaire;
  const collapseTodoDrawer = useCallback(() => setShowTodoDrawer(false), []);
  useAutoCollapseDrawer({
    isOpen: workDrawerOpen,
    isAgentActive: isRunning,
    onCollapse: collapseTodoDrawer,
  });
  const pendingTodoCount = todos.filter((todo) => !todo.done).length;
  const doneTodoCount = todos.length - pendingTodoCount;
  const workPeekDetail = [
    pendingTodoCount > 0
      ? `${pendingTodoCount} open to-do${pendingTodoCount === 1 ? "" : "s"}`
      : null,
    doneTodoCount > 0
      ? `${doneTodoCount} complete`
      : null,
    queue.length > 0
      ? `${queue.length} queued message${queue.length === 1 ? "" : "s"}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const drawerPeekSlot =
    questionnaire && approvalDrawerCollapsed ? (
      <ChatDrawerPeek
        tone="action"
        title="Action needed"
        detail={`${questionnaire.questions.length} question${
          questionnaire.questions.length === 1 ? "" : "s"
        } waiting for your answer`}
        onOpen={() => setApprovalDrawerCollapsed(false)}
      />
    ) : hasWorkDrawerContent && !showTodoDrawer && !questionnaire ? (
      <ChatDrawerPeek
        tone="status"
        title="Status"
        detail={workPeekDetail || "Active work is waiting"}
        onOpen={() => setShowTodoDrawer(true)}
      />
    ) : null;
  const hasDrawerPeek = !!drawerPeekSlot;
  const composerBottomInset = approvalDrawerOpen
    ? 310
    : workDrawerOpen
      ? 250
      : hasDrawerPeek
        ? 164
        : 150;
  const scrollButtonOffset = approvalDrawerOpen
    ? 300
    : workDrawerOpen
      ? 230
      : 116;

  const handleNewChat = useCallback(() => {
    setHasChatStarted(false);
    clearConversationId();
  }, [clearConversationId]);

  const handleTakeNote = useCallback(
    async (messageId: string, content: string) => {
      try {
        await fetch(`${API_BASE}/api/context-bank/memories`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agentId: "harper",
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

      <div className="flex-1 flex min-h-0 overflow-hidden">
        <div className="flex-1 flex flex-col min-h-0 relative">
          <FintheonThread
            onSend={handleSend}
            isLoading={isRunning}
            agentName={activeAgent?.name}
            onTakeNote={handleTakeNote}
            messageRefs={messageRefs}
            lastError={lastError}
            lastRequestId={lastRequestId}
            hasSubmittedMessage={hasChatStarted}
            activityEntries={activityEntries}
            citations={citations}
            onPinCitation={handlePinCitation}
            pinnedCitationIndex={pinnedCitationIndex}
            scrollButtonOffset={scrollButtonOffset}
            composerBottomInset={composerBottomInset}
            answerWidgets={answerWidgets}
          />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30">
            <FintheonComposer
              thinkHarder={thinkHarder}
              setThinkHarder={setThinkHarder}
              reasoningLevel={reasoningLevel}
              onReasoningLevelChange={(level) => {
                setReasoningLevel(level);
                setThinkHarder(shouldThinkHarder(level));
              }}
              lastError={lastError}
              activeSkill={activeSkill}
              onSelectSkill={setActiveSkill}
              showSkills={showSkills}
              onToggleSkills={() => setShowSkills((v) => !v)}
              disabledSkills={disabledSkills}
              conversationId={conversationId}
              onConversationGone={clearConversationId}
              onQueueMessage={addQueue}
              approvalDrawerOpen={approvalDrawerOpen}
              approvalDrawerSlot={
                <ChatQuestionApprovalDrawer
                  questionnaire={questionnaire}
                  isSubmitting={isSubmittingAnswers}
                  onSubmit={submitAnswers}
                  onCancel={() => setApprovalDrawerCollapsed(true)}
                />
              }
              workDrawerOpen={workDrawerOpen}
              workDrawerSlot={
                <TodoDrawer
                  isOpen={workDrawerOpen}
                  onClose={() => setShowTodoDrawer(false)}
                  todos={todos}
                  onToggleTodo={toggleTodo}
                  onRemoveTodo={removeTodo}
                  queue={queue}
                  onEditQueue={editQueue}
                  onRemoveQueue={removeQueue}
                  onReorderQueue={reorderQueue}
                  onSendQueueOne={sendOne}
                  onSendQueueAll={sendAll}
                  approvalPending={!!questionnaire}
                  agentActive={isRunning}
                />
              }
              drawerPeekSlot={drawerPeekSlot}
              queueCount={queue.length}
              onMessageSubmitted={() => setHasChatStarted(true)}
            />
          </div>
        </div>

        {/* Codex-style artifact / diff / preview workbench */}
        {(dualPane || artifactConfig) && showArtifacts && (
          <ArtifactPane
            artifactType={artifactConfig?.artifactType}
            tradingViewConfig={artifactConfig?.tradingViewConfig}
            browserSessionId={artifactConfig?.browserSessionId}
            browserStatus={artifactConfig?.browserStatus}
            reportHtml={artifactConfig?.reportHtml}
            reportMarkdown={artifactConfig?.reportMarkdown}
            citationSource={artifactConfig?.citationSource}
            narrativeCanvasId={artifactConfig?.narrativeCanvasId}
            onBegin={
              artifactConfig?.reportMarkdown
                ? () =>
                    handleSend(
                      `Begin this plan:\n\n${artifactConfig.reportMarkdown}`,
                    )
                : undefined
            }
            onClose={handleCloseArtifact}
            width={artifactWidth}
            onWidthChange={setArtifactWidth}
            variant="pane"
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
  const [reasoningLevel, setReasoningLevel] = useState<ReasoningLevel>(() => {
    try {
      return normalizeReasoningLevel(
        localStorage.getItem("fintheon:reasoning-level"),
      );
    } catch {
      return "standard";
    }
  });
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
    reasoningLevel,
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
        reasoningLevel={reasoningLevel}
        setReasoningLevel={(level) => {
          setReasoningLevel(level);
          setThinkHarderState(shouldThinkHarder(level));
          try {
            localStorage.setItem("fintheon:reasoning-level", level);
          } catch {
            /* ignore */
          }
        }}
        lastRequestId={lastRequestId}
        dualPane={isDualPane}
      />
    </AssistantRuntimeProvider>
  );
}
