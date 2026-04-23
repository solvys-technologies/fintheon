// [claude-code 2026-04-18] FCB is now a dispatch shortcut: collapsed button mirrors the
//   composer relay-button microinteractions (Radio / Loader2 / Unplug, gold pulse when
//   dispatched-here, reduced opacity when dispatched-elsewhere). Clicking it opens the
//   compact chat so the user can dispatch directly from the same surface.
import { useState, useCallback } from "react";
import {
  MessageSquare,
  X,
  Maximize2,
  Radio,
  Unplug,
  Loader2,
} from "@/components/shared/iso-icons";
import {
  AssistantRuntimeProvider,
  useThread,
  useThreadRuntime,
} from "@assistant-ui/react";
import { useFintheonAgents } from "../../contexts/FintheonAgentContext";
import { useHermesRuntime } from "./useHermesRuntime";
import { useRelayDispatch } from "../../hooks/useRelayDispatch";
import { FintheonThread } from "./FintheonThread";
import { FintheonComposer } from "./FintheonComposer";

interface FintheonFloatingChatProps {
  visible: boolean;
  onExpandToAnalysis: () => void;
}

/* Inner component — must be inside AssistantRuntimeProvider */
function FloatingInner({
  onExpandToAnalysis,
  onCollapse,
  lastError,
  lastRequestId,
  thinkHarder,
  setThinkHarder,
  conversationId,
}: {
  onExpandToAnalysis: () => void;
  onCollapse: () => void;
  lastError: string | null;
  lastRequestId: string | null;
  thinkHarder: boolean;
  setThinkHarder: (v: boolean) => void;
  conversationId?: string;
}) {
  const { activeAgent } = useFintheonAgents();
  const runtime = useThreadRuntime();
  const isRunning = useThread((t) => t.isRunning);

  const [activeSkill, setActiveSkill] = useState<string | null>(null);
  const [showSkills, setShowSkills] = useState(false);

  const handleSend = useCallback(
    (msg: string) => {
      runtime.append({ role: "user", content: [{ type: "text", text: msg }] });
    },
    [runtime],
  );

  return (
    <div
      className="fixed z-[90] flex flex-col rounded-xl border border-[var(--fintheon-accent)]/20 bg-[var(--fintheon-surface)] shadow-2xl overflow-hidden"
      style={{ bottom: "24px", right: "24px", width: "380px", height: "560px" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--fintheon-accent)]/10">
        <div className="flex items-center gap-2">
          <div
            className="flex items-center justify-center rounded-md bg-[var(--fintheon-accent)]/10 text-[var(--fintheon-accent)] font-semibold"
            style={{ width: "24px", height: "24px", fontSize: "12px" }}
          >
            {activeAgent?.icon || "H"}
          </div>
          <div>
            <div className="text-[12px] font-semibold text-[#f0ead6]">
              {activeAgent?.name || "Harper"}
            </div>
            <div className="text-[10px] text-gray-500">
              {activeAgent?.sector || "Chief Analyst"}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              onCollapse();
              onExpandToAnalysis();
            }}
            className="flex items-center justify-center rounded-md text-gray-500 hover:text-[var(--fintheon-accent)] transition-colors"
            style={{ width: "28px", height: "28px" }}
            title="Expand to Analysis"
          >
            <Maximize2 size={13} />
          </button>
          <button
            onClick={onCollapse}
            className="flex items-center justify-center rounded-md text-[#f0ead6]/40 hover:text-[var(--fintheon-accent)] transition-colors"
            style={{ width: "28px", height: "28px" }}
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Thread (compact variant — no greeting, no cognition panel) */}
      <FintheonThread
        onSend={handleSend}
        isLoading={isRunning}
        agentName={activeAgent?.name}
        lastError={lastError}
        lastRequestId={lastRequestId}
        compact
      />

      {/* Composer (compact mode — fewer toolbar buttons) */}
      <FintheonComposer
        thinkHarder={thinkHarder}
        setThinkHarder={setThinkHarder}
        lastError={lastError}
        activeSkill={activeSkill}
        onSelectSkill={setActiveSkill}
        showSkills={showSkills}
        onToggleSkills={() => setShowSkills((v) => !v)}
        compact
        conversationId={conversationId}
      />
    </div>
  );
}

export function FintheonFloatingChat({
  visible,
  onExpandToAnalysis,
}: FintheonFloatingChatProps) {
  const [expanded, setExpanded] = useState(false);
  const [thinkHarder, setThinkHarder] = useState(false);
  const { activeAgent } = useFintheonAgents();

  const { runtime, lastError, lastRequestId, conversationId } =
    useHermesRuntime(activeAgent?.id ?? "default", thinkHarder, "floating");

  // Relay state for the collapsed FCB. Displayed as microinteractions that
  // mirror the composer's relay button: Radio (idle/ready), Loader2 (in-flight),
  // Unplug (dispatched-here), Radio + reduced opacity (dispatched-elsewhere).
  const relay = useRelayDispatch();
  const isDispatchedHere = Boolean(
    relay.isDispatched &&
    conversationId &&
    relay.dispatchedConversationId &&
    relay.dispatchedConversationId === conversationId,
  );
  const isDispatchedElsewhere = Boolean(
    relay.isDispatched && !isDispatchedHere,
  );

  const handleQuickDispatch = useCallback(
    async (e: React.MouseEvent) => {
      // Shift-click (or Alt-click) on the FCB triggers one-click dispatch of
      // the floating conversation to mobile without opening the panel. Without
      // the modifier, the FCB opens the chat panel as before — we preserve the
      // "shortcut to the dispatch window" behavior while also giving an
      // expert-level one-click dispatch for users who already have a running
      // floating conversation.
      if (!conversationId || !(e.shiftKey || e.altKey)) {
        setExpanded(true);
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      if (isDispatchedHere) {
        await relay.disconnect();
        return;
      }
      if (isDispatchedElsewhere) return; // don't steal someone else's dispatch
      try {
        await relay.dispatch(conversationId);
      } catch {
        // Failures fall through — open the chat so the user sees the error in
        // the composer banner.
        setExpanded(true);
      }
    },
    [conversationId, isDispatchedHere, isDispatchedElsewhere, relay],
  );

  if (!visible) return null;

  /* Collapsed state — relay-aware 48x48 pill with dispatch microinteractions */
  if (!expanded) {
    const title = relay.isDispatching
      ? "Relaying…"
      : isDispatchedHere
        ? "Dispatched to mobile — shift-click to disconnect"
        : isDispatchedElsewhere
          ? "Another conversation is already dispatched"
          : conversationId
            ? "Open chat (shift-click to dispatch to mobile)"
            : "Open chat";

    const buttonClass = [
      "fixed z-[90] flex items-center justify-center rounded-full transition-all",
      isDispatchedHere
        ? "bg-[var(--fintheon-accent)] text-black"
        : isDispatchedElsewhere
          ? "bg-[var(--fintheon-accent)]/50 text-black/60 cursor-not-allowed"
          : relay.isDispatching
            ? "bg-[var(--fintheon-accent)] text-black"
            : "bg-[var(--fintheon-accent)] text-black hover:bg-[#C5A030]",
    ].join(" ");

    return (
      <button
        onClick={handleQuickDispatch}
        disabled={isDispatchedElsewhere || relay.isDispatching}
        className={buttonClass}
        style={{ bottom: "24px", right: "24px", width: "48px", height: "48px" }}
        title={title}
      >
        {relay.isDispatching ? (
          <Loader2 size={20} className="animate-spin" />
        ) : isDispatchedHere ? (
          <Unplug size={20} />
        ) : conversationId ? (
          <Radio size={20} />
        ) : (
          <MessageSquare size={20} />
        )}
      </button>
    );
  }

  /* Expanded state — wrapped in runtime provider */
  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <FloatingInner
        onExpandToAnalysis={onExpandToAnalysis}
        onCollapse={() => setExpanded(false)}
        lastError={lastError}
        lastRequestId={lastRequestId ?? null}
        thinkHarder={thinkHarder}
        setThinkHarder={setThinkHarder}
        conversationId={conversationId}
      />
    </AssistantRuntimeProvider>
  );
}
