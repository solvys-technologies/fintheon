// [Codex 2026-05-29] NarrativeFlow opener requests can either stage a draft or send after workspace transition.
// [claude-code 2026-03-29] S9-T5: Replace checkpoint sidebar with real conversation history, Take Note button
// [claude-code 2026-03-28] S8-T7: Dual-pane layout (left=conversation, right=artifacts) for Chat
import {
  useState,
  useRef,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import {
  AssistantRuntimeProvider,
  useThread,
  useThreadRuntime,
} from "@assistant-ui/react";
import { Check, ChevronDown, Layers } from "lucide-react";
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
import {
  ALL_NARRATIVES_LABEL,
  ALL_NARRATIVES_SLUG,
} from "./narrative/narrative-selection";
import type { AddToolApprovalResponse } from "./chat/hooks/useToolApprovals";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";

export interface ChatWorkspaceOption {
  id: string;
  title: string;
  status?: string;
  color?: string;
  hasArtifacts?: boolean;
}

export interface ChatInitialMessageRequest {
  id: string;
  text: string;
  mode?: "send" | "draft";
  resetConversation?: boolean;
}

type ChatComposerPlacement = "bottom" | "center-until-start";
const MAX_INITIAL_DRAFT_LENGTH = 600;

function normalizeInitialDraft(
  request: ChatInitialMessageRequest | null,
): string | null {
  const text = request?.text.trim() ?? "";
  if (!text) return null;
  if (text.length > MAX_INITIAL_DRAFT_LENGTH) return null;
  return text;
}

function normalizeInitialSend(
  request: ChatInitialMessageRequest | null,
): string | null {
  const text = request?.text.trim() ?? "";
  return text || null;
}

function ChatInterfaceInner({
  surfaceId,
  conversationId,
  setConversationId,
  clearConversationId,
  lastError,
  thinkHarder,
  setThinkHarder,
  reasoningLevel,
  setReasoningLevel,
  lastRequestId,
  addToolApprovalResponse,
  dualPane = false,
  workspaceOptions = [],
  activeWorkspaceId = null,
  onWorkspaceChange,
  workspaceSelectorLabel = "Workspace",
  requestedConversationId = null,
  initialMessageRequest = null,
  onInitialMessageHandled,
  emptyState,
  composerPlacement = "bottom",
  hideHeader = false,
}: {
  surfaceId: string;
  conversationId: string | undefined;
  setConversationId: (id: string) => void;
  clearConversationId: () => void;
  lastError: string | null;
  thinkHarder: boolean;
  setThinkHarder: (v: boolean) => void;
  reasoningLevel: ReasoningLevel;
  setReasoningLevel: (level: ReasoningLevel) => void;
  lastRequestId: string | null;
  addToolApprovalResponse?: AddToolApprovalResponse;
  dualPane?: boolean;
  workspaceOptions?: ChatWorkspaceOption[];
  activeWorkspaceId?: string | null;
  onWorkspaceChange?: (workspaceId: string) => void;
  workspaceSelectorLabel?: string;
  requestedConversationId?: string | null;
  initialMessageRequest?: ChatInitialMessageRequest | null;
  onInitialMessageHandled?: (id: string) => void;
  emptyState?: ReactNode;
  composerPlacement?: ChatComposerPlacement;
  hideHeader?: boolean;
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
      return (
        Number(localStorage.getItem("fintheon:chat-artifact-width")) || 390
      );
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
  const handledInitialMessageIdsRef = useRef<Set<string>>(new Set());
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [composerDraftRequest, setComposerDraftRequest] = useState<
    string | null
  >(null);

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
    if (threadMessages.length > 0) {
      setHasChatStarted(true);
    } else if (!isRunning) {
      setHasChatStarted(false);
    }
  }, [activeWorkspaceId, isRunning, threadMessages.length]);

  useEffect(() => {
    if (!requestedConversationId || requestedConversationId === conversationId)
      return;
    setConversationId(requestedConversationId);
    setHasChatStarted(true);
  }, [conversationId, requestedConversationId, setConversationId]);

  useEffect(() => {
    const mode = initialMessageRequest?.mode ?? "draft";
    const initialText =
      mode === "send"
        ? normalizeInitialSend(initialMessageRequest)
        : normalizeInitialDraft(initialMessageRequest);
    if (!initialMessageRequest || !initialText) {
      if (initialMessageRequest?.id) {
        handledInitialMessageIdsRef.current.add(initialMessageRequest.id);
        onInitialMessageHandled?.(initialMessageRequest.id);
      }
      return;
    }
    if (handledInitialMessageIdsRef.current.has(initialMessageRequest.id))
      return;
    handledInitialMessageIdsRef.current.add(initialMessageRequest.id);
    if (initialMessageRequest.resetConversation) clearConversationId();
    if (mode === "send") {
      setComposerDraftRequest(null);
      handleSend(initialText);
      onInitialMessageHandled?.(initialMessageRequest.id);
      return;
    }
    setComposerDraftRequest(initialText);
    onInitialMessageHandled?.(initialMessageRequest.id);
  }, [
    clearConversationId,
    handleSend,
    initialMessageRequest,
    onInitialMessageHandled,
  ]);

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
      localStorage.setItem(
        "fintheon:chat-artifact-width",
        String(artifactWidth),
      );
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

  const { questionnaire, answerWidgets, isSubmittingAnswers, submitAnswers } =
    useChatUiActions(lastRequestId, {
      onTodoDrawer: handleTodoUiAction,
      onRightRail: handleRightRailUiAction,
    });

  useEffect(() => {
    setApprovalDrawerCollapsed(false);
  }, [questionnaire?.actionId]);

  const approvalDrawerOpen = !!questionnaire && !approvalDrawerCollapsed;
  const introCenteredMode =
    composerPlacement === "center-until-start" &&
    !hasChatStarted &&
    threadMessages.length === 0 &&
    !isRunning;
  const workDrawerOpen =
    showTodoDrawer &&
    hasWorkDrawerContent &&
    !questionnaire &&
    !introCenteredMode;
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
    doneTodoCount > 0 ? `${doneTodoCount} complete` : null,
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
  const composerIsCentered =
    introCenteredMode && !approvalDrawerOpen && !workDrawerOpen;
  const composerInset = composerIsCentered ? 48 : composerBottomInset;

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
  const isNarrativeFlowSurface = surfaceId === "narrativeflow";
  const narrativeWorkspaceOptions = isNarrativeFlowSurface
    ? [
        {
          id: ALL_NARRATIVES_SLUG,
          title: ALL_NARRATIVES_LABEL,
          color: "var(--fintheon-accent)",
          status: "context",
        },
        ...workspaceOptions,
      ]
    : workspaceOptions;
  const workspaceSlot =
    isNarrativeFlowSurface && workspaceOptions.length > 0 ? (
      <ChatWorkspaceSelector
        options={narrativeWorkspaceOptions}
        activeId={activeWorkspaceId}
        onSelect={onWorkspaceChange}
        label={workspaceSelectorLabel}
      />
    ) : undefined;

  return (
    <div className="h-full flex flex-col">
      {hideHeader ? null : (
        <ChatHeader
          onRunMDB={() => handleSend("Run the MDB report")}
          onNewChat={handleNewChat}
          onSelectSession={(id) => setConversationId(id)}
          onNewSession={handleNewChat}
          currentConversationId={conversationId}
          isLoading={isRunning}
        />
      )}

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
            addToolApprovalResponse={addToolApprovalResponse}
            hasSubmittedMessage={hasChatStarted}
            activityEntries={activityEntries}
            citations={citations}
            onPinCitation={handlePinCitation}
            pinnedCitationIndex={pinnedCitationIndex}
            scrollButtonOffset={scrollButtonOffset}
            composerBottomInset={composerInset}
            answerWidgets={answerWidgets}
            emptyState={emptyState}
          />
          <div
            className={`pointer-events-none absolute inset-x-0 z-30 ${
              composerIsCentered ? "top-1/2 translate-y-8" : "bottom-0"
            }`}
          >
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
              drawerPeekSlot={composerIsCentered ? undefined : drawerPeekSlot}
              workspaceSlot={workspaceSlot}
              draftTextRequest={composerDraftRequest}
              onDraftTextRequestConsumed={() => setComposerDraftRequest(null)}
              queueCount={queue.length}
              onMessageSubmitted={() => setHasChatStarted(true)}
              showAttachSelector={isNarrativeFlowSurface}
              attachSelectorTitle="Attach NarrativeFlow context"
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

function buildWorkspaceSurfaceId(
  surfaceId: string,
  workspaceId: string | null | undefined,
): string {
  return workspaceId ? `${surfaceId}:workspace:${workspaceId}` : surfaceId;
}

function buildWorkspaceContext(
  surfaceId: string,
  options: ChatWorkspaceOption[],
  workspaceId: string | null | undefined,
) {
  if (!workspaceId) return null;
  if (workspaceId === ALL_NARRATIVES_SLUG) {
    return {
      id: ALL_NARRATIVES_SLUG,
      title: ALL_NARRATIVES_LABEL,
      type: "narrative-workspace-group",
      surfaceId,
      narratives: options.map((item) => ({
        id: item.id,
        title: item.title,
        status: item.status,
        color: item.color,
        hasArtifacts: item.hasArtifacts,
      })),
    };
  }
  const workspace = options.find((item) => item.id === workspaceId);
  return {
    id: workspaceId,
    title: workspace?.title ?? "Workspace",
    status: workspace?.status,
    color: workspace?.color,
    hasArtifacts: workspace?.hasArtifacts,
    type: "narrative-workspace",
    surfaceId,
  };
}

function ChatWorkspaceSelector({
  options,
  activeId,
  onSelect,
  label = "Workspace",
}: {
  options: ChatWorkspaceOption[];
  activeId?: string | null;
  onSelect?: (workspaceId: string) => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const active = options.find((item) => item.id === activeId) ?? options[0];
  const triggerText = active.title;
  const activeColor = active.color ?? "rgba(199,159,74,0.72)";

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("click", close);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  if (!active) return null;

  return (
    <div className="relative" onClick={(event) => event.stopPropagation()}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={`chat-workspace-selector-trigger flex h-8 max-w-[184px] items-center gap-1.5 rounded-lg px-2 text-[11px] transition-colors ${
          open
            ? "bg-[var(--fintheon-accent)]/10 text-[var(--fintheon-accent)]"
            : "text-zinc-500 hover:bg-[var(--fintheon-accent)]/10 hover:text-[var(--fintheon-accent)]"
        }`}
        title={`${label}: ${active.title}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
      >
        <span className="grid h-5 w-5 shrink-0 place-items-center rounded-[5px] bg-black/20">
          <span
            className="h-2.5 w-2.5 rounded-[3px]"
            style={{ backgroundColor: activeColor }}
          />
        </span>
        <Layers size={14} />
        <span className="chat-workspace-selector-trigger__label min-w-0 truncate">
          {triggerText}
        </span>
        <ChevronDown size={11} className="shrink-0 opacity-55" />
      </button>
      {open ? (
        <div
          className="absolute bottom-10 left-0 z-50 w-72 overflow-hidden rounded-md border border-[var(--fintheon-accent)]/16 bg-[#0d0a06]"
          role="menu"
        >
          <div className="border-b border-[var(--fintheon-accent)]/10 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--fintheon-accent)]/70">
            {label}
          </div>
          <div className="max-h-64 overflow-y-auto p-1">
            {options.map((item) => {
              const selected = item.id === active.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={selected}
                  onClick={() => {
                    onSelect?.(item.id);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-2 rounded-[4px] px-2 py-2 text-left transition ${
                    selected
                      ? "text-[var(--fintheon-accent)]"
                      : "text-[var(--fintheon-text)]/74 hover:bg-[var(--fintheon-accent)]/7 hover:text-[var(--fintheon-text)]"
                  }`}
                  style={
                    selected
                      ? {
                          color:
                            item.id === ALL_NARRATIVES_SLUG
                              ? "var(--fintheon-accent)"
                              : (item.color ?? "var(--fintheon-accent)"),
                        }
                      : undefined
                  }
                >
                  {selected ? (
                    <Check size={12} className="shrink-0" />
                  ) : (
                    <span className="grid h-5 w-5 shrink-0 place-items-center rounded-[5px] bg-black/20">
                      <span
                        className="h-2.5 w-2.5 rounded-[3px]"
                        style={{
                          backgroundColor:
                            item.color ?? "rgba(199,159,74,0.64)",
                        }}
                      />
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12px] font-medium">
                      {item.title}
                    </span>
                    {item.status ? (
                      <span className="block font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--fintheon-muted)]">
                        {item.status}
                      </span>
                    ) : null}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function ChatInterface({
  surfaceId = "analysis",
  workspaceOptions = [],
  activeWorkspaceId = null,
  onWorkspaceChange,
  workspaceSelectorLabel = "Workspace",
  requestedConversationId = null,
  initialMessageRequest = null,
  onInitialMessageHandled,
  emptyState,
  composerPlacement = "bottom",
  hideHeader = false,
}: {
  surfaceId?: string;
  workspaceOptions?: ChatWorkspaceOption[];
  activeWorkspaceId?: string | null;
  onWorkspaceChange?: (workspaceId: string) => void;
  workspaceSelectorLabel?: string;
  requestedConversationId?: string | null;
  initialMessageRequest?: ChatInitialMessageRequest | null;
  onInitialMessageHandled?: (id: string) => void;
  emptyState?: ReactNode;
  composerPlacement?: ChatComposerPlacement;
  hideHeader?: boolean;
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
    addToolApprovalResponse,
  } = useHermesRuntime(
    activeAgent?.id ?? "default",
    thinkHarderState,
    buildWorkspaceSurfaceId(surfaceId, activeWorkspaceId),
    reasoningLevel,
    buildWorkspaceContext(surfaceId, workspaceOptions, activeWorkspaceId),
  );

  // Chat main surface gets dual-pane layout (conversation + artifacts)
  const isDualPane = surfaceId === "chat";

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <ChatInterfaceInner
        surfaceId={surfaceId}
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
        addToolApprovalResponse={addToolApprovalResponse}
        dualPane={isDualPane}
        workspaceOptions={workspaceOptions}
        activeWorkspaceId={activeWorkspaceId}
        onWorkspaceChange={onWorkspaceChange}
        workspaceSelectorLabel={workspaceSelectorLabel}
        requestedConversationId={requestedConversationId}
        initialMessageRequest={initialMessageRequest}
        onInitialMessageHandled={onInitialMessageHandled}
        emptyState={emptyState}
        composerPlacement={composerPlacement}
        hideHeader={hideHeader}
      />
    </AssistantRuntimeProvider>
  );
}
