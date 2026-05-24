// [claude-code 2026-04-10] S8-T4: Cross-agent notification toasts via surface.sidebar SSE
// [claude-code 2026-04-05] T2: Chat icons moved to Consilium bar — event-driven new chat, run report, load session
// [claude-code 2026-03-28] S8-T7: Single-pane sidebar with agent-plan inline
// [claude-code 2026-04-19] New chat / run report / load session now animated via View Transitions API
// S13-T1: Renamed to ChatSidebar, surfaceId=chat
import { useCallback, useState, useEffect, useRef, useMemo } from "react";
import {
  AssistantRuntimeProvider,
  useThread,
  useThreadRuntime,
} from "@assistant-ui/react";
import { Play, X } from "lucide-react";
import { useFintheonAgents } from "../../contexts/FintheonAgentContext";
import { useHermesRuntime } from "./useHermesRuntime";
import { FintheonThread } from "./FintheonThread";
import { FintheonComposer } from "./FintheonComposer";
import { CognitionPanel } from "./CognitionPanel";
import { TodoDrawer } from "./TodoDrawer";
import { useTodoList } from "./hooks/useTodoList";
import { useMessageQueue } from "./hooks/useMessageQueue";
import {
  useChatUiActions,
  type ChatUiRightRailPayload,
  type ChatUiTodoItem,
} from "./hooks/useChatUiActions";
import { useAutoCollapseDrawer } from "./hooks/useAutoCollapseDrawer";
import { ChatQuestionApprovalDrawer } from "./ChatQuestionApprovalDrawer";
import { ChatDrawerPeek } from "./ChatDrawerPeek";
import { normalizeReasoningLevel, shouldThinkHarder } from "./reasoning";
import type { ReasoningLevel } from "./reasoning";
import { useAgentBusSSE } from "../../hooks/useAgentBusSSE";
import { withViewTransition } from "../../lib/view-transition";
import type { SidebarNotifyEvent } from "../../../backend-hono/src/services/agent-bus/types";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";

/** Default display names — harper entry overridden at runtime by CAO name from agent context */
const HERMES_NAMES_DEFAULT: Record<string, string> = {
  oracle: "Oracle",
  feucht: "Feucht",
  consul: "Consul",
  herald: "Herald",
  harper: "Harper",
};

/** Maps HermesAgentId → FintheonAgent.id for "currently chatting with" suppression */
const HERMES_TO_AGENT_ID: Record<string, string> = {
  harper: "harper",
  oracle: "oracle",
  feucht: "feucht",
  consul: "consul",
  herald: "herald",
};

const PLAN_DRAFT_KEY = "fintheon:plan-markdown-v1";
const PLAN_DRAFT_TEMPLATE = `# Plan\n\n## Objectives\n- [ ] \n\n## Steps\n1. \n\n## Notes\n`;

type AgentRailSurface = "plan" | "canvas" | "browser";

interface AgentRailEventDetail {
  open?: boolean;
  markdown?: string;
  append?: boolean;
  title?: string;
  surface?: AgentRailSurface;
}

interface SidebarToast {
  id: string;
  agentId: string;
  agentName: string;
  summary: string;
}

function ChatSidebarInner({
  lastError,
  lastRequestId,
  thinkHarder,
  setThinkHarder,
  reasoningLevel,
  setReasoningLevel,
  conversationId,
  setConversationId,
  clearConversationId,
  compact = true,
  mode,
  onModeChange,
  planMarkdown,
  railTitle,
  railSurface,
}: {
  lastError: string | null;
  lastRequestId: string | null;
  thinkHarder: boolean;
  setThinkHarder: (v: boolean) => void;
  reasoningLevel: ReasoningLevel;
  setReasoningLevel: (level: ReasoningLevel) => void;
  conversationId: string | undefined;
  setConversationId: (id: string) => void;
  clearConversationId: () => void;
  compact?: boolean;
  mode: "work" | "plan";
  onModeChange: (mode: "work" | "plan") => void;
  planMarkdown: string;
  railTitle: string;
  railSurface: AgentRailSurface;
}) {
  const { activeAgent, agents } = useFintheonAgents();
  const runtime = useThreadRuntime();
  const isRunning = useThread((t) => t.isRunning);
  const threadMessages = useThread((t) => t.messages);

  // Build dynamic display names — CAO name comes from agent context
  const hermesNames: Record<string, string> = useMemo(() => {
    const cao = agents.find((a) => a.id === "harper");
    return { ...HERMES_NAMES_DEFAULT, harper: cao?.name ?? "Harper" };
  }, [agents]);

  const [activeSkill, setActiveSkill] = useState<string | null>(null);
  const [showSkills, setShowSkills] = useState(false);
  const [showWorkDrawer, setShowWorkDrawer] = useState(false);
  const [approvalDrawerCollapsed, setApprovalDrawerCollapsed] = useState(false);
  const previousWorkItemCountRef = useRef(0);
  const hasMountedWorkDrawerRef = useRef(false);
  const [hasChatStarted, setHasChatStarted] = useState(false);
  const [toasts, setToasts] = useState<SidebarToast[]>([]);
  const toastTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );

  // SSE: subscribe to surface.sidebar for cross-agent findings
  const { lastEvent: sidebarEvent } = useAgentBusSSE<SidebarNotifyEvent>({
    url: `${API_BASE}/api/dag/surface/sidebar`,
    enabled: true,
    reconnect: true,
  });

  useEffect(() => {
    if (!sidebarEvent || sidebarEvent.type !== "agent-finding") return;
    // Suppress if the user is already chatting with this agent
    const agentFintheonId = HERMES_TO_AGENT_ID[sidebarEvent.agentId];
    if (agentFintheonId && activeAgent?.id === agentFintheonId) return;

    const toastId = `${sidebarEvent.dagId}-${sidebarEvent.agentId}-${Date.now()}`;
    const newToast: SidebarToast = {
      id: toastId,
      agentId: sidebarEvent.agentId,
      agentName: hermesNames[sidebarEvent.agentId] ?? sidebarEvent.agentId,
      summary: sidebarEvent.summary,
    };

    setToasts((prev) => [...prev.slice(-4), newToast]); // keep max 5 toasts

    // Auto-dismiss after 8s
    const timer = setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== toastId));
      toastTimers.current.delete(toastId);
    }, 8000);
    toastTimers.current.set(toastId, timer);
  }, [sidebarEvent, activeAgent?.id, hermesNames]);

  // Clean up timers on unmount
  useEffect(
    () => () => {
      toastTimers.current.forEach((t) => clearTimeout(t));
    },
    [],
  );

  const dismissToast = useCallback((id: string) => {
    const timer = toastTimers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      toastTimers.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

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
  } = useMessageQueue({ isRunning, sendNow });

  const { todos, addTodo, toggleTodo, removeTodo } = useTodoList();
  const workItemCount = todos.length + queue.length;
  const hasWorkDrawerContent = workItemCount > 0;

  const handleTodoUiAction = useCallback(
    (payload: { items: ChatUiTodoItem[] }) => {
      for (const item of payload.items) {
        addTodo(item.text, {
          issueTrackingType: item.issueType,
          source: "harper-ui-tool",
        });
      }
      setShowWorkDrawer(true);
    },
    [addTodo],
  );

  const handleRightRailUiAction = useCallback(
    (payload: ChatUiRightRailPayload) => {
      window.dispatchEvent(
        new CustomEvent("fintheon:agent-plan-rail", {
          detail: {
            open: true,
            title: payload.title,
            surface: payload.surface === "report" ? "plan" : payload.surface,
            markdown: payload.markdown,
            append: payload.append,
          },
        }),
      );
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
    showWorkDrawer && hasWorkDrawerContent && !questionnaire;
  const collapseWorkDrawer = useCallback(() => setShowWorkDrawer(false), []);
  useAutoCollapseDrawer({
    isOpen: workDrawerOpen,
    isAgentActive: isRunning,
    onCollapse: collapseWorkDrawer,
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
    ) : hasWorkDrawerContent && !showWorkDrawer && !questionnaire ? (
      <ChatDrawerPeek
        tone="status"
        title="Status"
        detail={workPeekDetail || "Active work is waiting"}
        onOpen={() => setShowWorkDrawer(true)}
      />
    ) : null;
  const hasDrawerPeek = !!drawerPeekSlot;
  const composerBottomInset = approvalDrawerOpen
    ? 300
    : workDrawerOpen
      ? 240
      : hasDrawerPeek
        ? 150
        : 136;
  const scrollButtonOffset = approvalDrawerOpen
    ? 290
    : workDrawerOpen
      ? 220
      : 116;

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

  useEffect(() => {
    if (threadMessages.length > 0) setHasChatStarted(true);
  }, [threadMessages.length]);

  useEffect(() => {
    const previousCount = previousWorkItemCountRef.current;
    if (!hasMountedWorkDrawerRef.current) {
      hasMountedWorkDrawerRef.current = true;
      previousWorkItemCountRef.current = workItemCount;
      if (workItemCount === 0) setShowWorkDrawer(false);
      return;
    }
    previousWorkItemCountRef.current = workItemCount;
    if (workItemCount === 0) {
      setShowWorkDrawer(false);
      return;
    }
    if (previousCount === 0 || workItemCount > previousCount) {
      setShowWorkDrawer(true);
    }
  }, [workItemCount]);

  // Listen for toolbar events dispatched from ConsiliumHub icons
  useEffect(() => {
    const onNewChat = () =>
      withViewTransition(() => {
        setHasChatStarted(false);
        clearConversationId();
      });
    const onRunReport = () => {
      if (!isRunning)
        withViewTransition(() => handleSend("Run the MDB report"));
    };
    const onLoadSession = (e: Event) => {
      const id = (e as CustomEvent).detail?.id;
      console.debug("[ChatSidebar] load-session event received", { id });
      if (id) withViewTransition(() => setConversationId(id));
    };

    window.addEventListener("fintheon:chat-new", onNewChat);
    window.addEventListener("fintheon:chat-run-report", onRunReport);
    window.addEventListener("fintheon:chat-load-session", onLoadSession);
    return () => {
      window.removeEventListener("fintheon:chat-new", onNewChat);
      window.removeEventListener("fintheon:chat-run-report", onRunReport);
      window.removeEventListener("fintheon:chat-load-session", onLoadSession);
    };
  }, [clearConversationId, handleSend, isRunning, setConversationId]);

  return (
    <div
      className={`relative flex h-full flex-col overflow-hidden bg-transparent transition-[padding-right] duration-300 ${
        !compact && mode === "plan" ? "md:pr-[40%]" : "md:pr-0"
      }`}
    >
      {mode === "plan" && (
        <button
          aria-label="Close plan drawer backdrop"
          className="absolute inset-0 z-30 bg-black/20 lg:hidden"
          onClick={() => onModeChange("work")}
        />
      )}

      {/* Cross-agent notification toasts */}
      {toasts.length > 0 && (
        <div className="absolute left-2 right-2 top-2 z-50 flex flex-col gap-1.5 pointer-events-none">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className="pointer-events-auto flex items-start gap-2 rounded-lg border border-[#c79f4a]/25 bg-[#0a0904] px-3 py-2 shadow-lg"
              style={{ animation: "toast-in 200ms ease-out" }}
            >
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-[10px] font-semibold text-[#c79f4a]">
                  {toast.agentName} discovered
                </span>
                <span className="truncate text-[10px] leading-relaxed text-[#f0ead6]/50">
                  {toast.summary}
                </span>
              </div>
              <button
                onClick={() => dismissToast(toast.id)}
                className="mt-0.5 shrink-0 text-[#f0ead6]/20 transition-colors hover:text-[#f0ead6]/60"
              >
                <X size={10} />
              </button>
            </div>
          ))}
        </div>
      )}
      <style>{`
        @keyframes toast-in {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <FintheonThread
        onSend={handleSend}
        isLoading={isRunning}
        agentName={activeAgent?.name}
        lastError={lastError}
        lastRequestId={lastRequestId}
        compact={compact}
        hasSubmittedMessage={hasChatStarted}
        scrollButtonOffset={scrollButtonOffset}
        composerBottomInset={composerBottomInset}
        answerWidgets={answerWidgets}
      />
      {/* Agent cognition — only in compact/sidebar mode (FintheonThread handles it in full chat) */}
      {compact && lastRequestId && isRunning && (
        <div className="px-3 pb-2">
          <CognitionPanel requestId={lastRequestId} isStreaming={isRunning} />
        </div>
      )}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30">
        <FintheonComposer
          compact={compact}
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
              onClose={() => setShowWorkDrawer(false)}
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

      <aside
        className={`absolute right-0 top-0 z-40 h-full border-l border-[var(--fintheon-accent)]/20 bg-[#090704] shadow-2xl transition-transform duration-300 ease-out ${
          mode === "plan" ? "translate-x-0" : "translate-x-full"
        } w-full md:w-[40%]`}
        aria-label="Agent workspace rail"
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-[var(--fintheon-accent)]/20 px-4 py-3">
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.12em] text-zinc-500">
                Agent Workspace
              </p>
              <p className="truncate text-[12px] font-semibold text-[var(--fintheon-accent)]">
                {railTitle}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                onClick={() => handleSend(`Begin this plan:\n\n${planMarkdown}`)}
                className="rounded border border-[var(--fintheon-accent)]/25 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--fintheon-accent)] transition-colors hover:bg-[var(--fintheon-accent)]/10"
                title="Begin this plan"
              >
                <span className="inline-flex items-center gap-1">
                  <Play size={10} />
                  Begin
                </span>
              </button>
              <button
                onClick={() => onModeChange("work")}
                className="rounded border border-[var(--fintheon-accent)]/30 px-2 py-1 text-[10px] text-[var(--fintheon-accent)] hover:bg-[var(--fintheon-accent)]/10"
              >
                Dismiss
              </button>
            </div>
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-2 p-3">
            <div className="flex items-center justify-between rounded-md border border-white/[0.06] bg-white/[0.025] px-2 py-1">
              <span className="text-[9px] uppercase tracking-[0.14em] text-[#f0ead6]/42">
                {railSurface}
              </span>
              <span className="text-[9px] uppercase tracking-[0.14em] text-[#f0ead6]/28">
                agent-controlled
              </span>
            </div>
            <pre
              className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap rounded-md border border-[var(--fintheon-accent)]/15 bg-[#0d0a06] p-3 font-mono text-[12px] leading-5 text-[#f0ead6] outline-none"
              aria-label="Agent workspace content"
            >
              {planMarkdown}
            </pre>
          </div>
        </div>
      </aside>
    </div>
  );
}

export function ChatSidebar({ compact = true }: { compact?: boolean } = {}) {
  const { activeAgent } = useFintheonAgents();
  const [thinkHarder, setThinkHarder] = useState(false);
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
    thinkHarder,
    "chat",
    reasoningLevel,
  );
  const [mode, setMode] = useState<"work" | "plan">("work");
  const [railTitle, setRailTitle] = useState("plan.md");
  const [railSurface, setRailSurface] = useState<AgentRailSurface>("plan");
  const [planMarkdown, setPlanMarkdown] = useState<string>(() => {
    try {
      return localStorage.getItem(PLAN_DRAFT_KEY) ?? PLAN_DRAFT_TEMPLATE;
    } catch {
      return PLAN_DRAFT_TEMPLATE;
    }
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Tab" && event.shiftKey && mode === "plan") {
        event.preventDefault();
        setMode("work");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mode]);

  useEffect(() => {
    const surfaceTitles: Record<AgentRailSurface, string> = {
      plan: "plan.md",
      canvas: "canvas.md",
      browser: "browser.md",
    };
    const onAgentRail = (event: Event) => {
      const detail =
        (event as CustomEvent<AgentRailEventDetail>).detail ?? {};
      if (detail.open === false) {
        setMode("work");
        return;
      }
      const nextSurface = detail.surface ?? "plan";
      setRailSurface(nextSurface);
      setRailTitle(detail.title ?? surfaceTitles[nextSurface]);
      const nextMarkdown = detail.markdown;
      if (typeof nextMarkdown === "string") {
        setPlanMarkdown((prev) =>
          detail.append ? `${prev}${nextMarkdown}` : nextMarkdown,
        );
      }
      setMode("plan");
    };

    window.addEventListener("fintheon:agent-plan-rail", onAgentRail);
    return () =>
      window.removeEventListener("fintheon:agent-plan-rail", onAgentRail);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("fintheon:reasoning-level", reasoningLevel);
    } catch {
      // no-op
    }
  }, [reasoningLevel]);

  useEffect(() => {
    try {
      localStorage.setItem(PLAN_DRAFT_KEY, planMarkdown);
    } catch {
      // no-op
    }
  }, [planMarkdown]);

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <ChatSidebarInner
        lastError={lastError}
        lastRequestId={lastRequestId ?? null}
        thinkHarder={thinkHarder}
        setThinkHarder={setThinkHarder}
        reasoningLevel={reasoningLevel}
        setReasoningLevel={setReasoningLevel}
        conversationId={conversationId}
        setConversationId={setConversationId}
        clearConversationId={clearConversationId}
        compact={compact}
        mode={mode}
        onModeChange={setMode}
        planMarkdown={planMarkdown}
        railTitle={railTitle}
        railSurface={railSurface}
      />
    </AssistantRuntimeProvider>
  );
}
