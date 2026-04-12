// [claude-code 2026-04-10] S8-T4: Cross-agent notification toasts via surface.sidebar SSE
// [claude-code 2026-04-05] T2: Chat icons moved to Consilium bar — event-driven new chat, run report, load session
// [claude-code 2026-03-28] S8-T7: Single-pane sidebar with agent-plan inline
// S13-T1: Renamed to ChatSidebar, surfaceId=chat
import { useCallback, useState, useEffect, useRef, useMemo } from "react";
import {
  AssistantRuntimeProvider,
  useThread,
  useThreadRuntime,
} from "@assistant-ui/react";
import { X } from "lucide-react";
import { useFintheonAgents } from "../../contexts/FintheonAgentContext";
import { useHermesRuntime } from "./useHermesRuntime";
import { FintheonThread } from "./FintheonThread";
import { FintheonComposer } from "./FintheonComposer";
import { CognitionPanel } from "./CognitionPanel";
import { useAgentBusSSE } from "../../hooks/useAgentBusSSE";
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
  harper: "harper-opus",
  oracle: "oracle",
  feucht: "feucht",
  consul: "consul",
  herald: "herald",
};

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
  conversationId,
  setConversationId,
  clearConversationId,
  compact = true,
}: {
  lastError: string | null;
  lastRequestId: string | null;
  thinkHarder: boolean;
  setThinkHarder: (v: boolean) => void;
  conversationId: string | undefined;
  setConversationId: (id: string) => void;
  clearConversationId: () => void;
  compact?: boolean;
}) {
  const { activeAgent, agents } = useFintheonAgents();
  const runtime = useThreadRuntime();
  const isRunning = useThread((t) => t.isRunning);

  // Build dynamic display names — CAO name comes from agent context
  const hermesNames: Record<string, string> = useMemo(() => {
    const cao = agents.find((a) => a.id === "harper-opus");
    return { ...HERMES_NAMES_DEFAULT, harper: cao?.name ?? "Harper" };
  }, [agents]);

  const [activeSkill, setActiveSkill] = useState<string | null>(null);
  const [showSkills, setShowSkills] = useState(false);
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

  const handleSend = useCallback(
    (msg: string) => {
      runtime.append({ role: "user", content: [{ type: "text", text: msg }] });
    },
    [runtime],
  );

  // Listen for toolbar events dispatched from ConsiliumHub icons
  useEffect(() => {
    const onNewChat = () => clearConversationId();
    const onRunReport = () => {
      if (!isRunning) handleSend("Run the MDB report");
    };
    const onLoadSession = (e: Event) => {
      const id = (e as CustomEvent).detail?.id;
      console.debug("[ChatSidebar] load-session event received", { id });
      if (id) setConversationId(id);
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
    <div className="relative flex h-full flex-col overflow-hidden bg-[var(--fintheon-bg)]">
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
      />
      {/* Agent plan / cognition inline in sidebar — shows task progress when streaming */}
      {lastRequestId && isRunning && (
        <div className="px-3 pb-2">
          <CognitionPanel requestId={lastRequestId} isStreaming={isRunning} />
        </div>
      )}
      <FintheonComposer
        thinkHarder={thinkHarder}
        setThinkHarder={setThinkHarder}
        lastError={lastError}
        activeSkill={activeSkill}
        onSelectSkill={setActiveSkill}
        showSkills={showSkills}
        onToggleSkills={() => setShowSkills((v) => !v)}
      />
    </div>
  );
}

export function ChatSidebar({ compact = true }: { compact?: boolean } = {}) {
  const { activeAgent } = useFintheonAgents();
  const [thinkHarder, setThinkHarder] = useState(false);
  const {
    runtime,
    conversationId,
    setConversationId,
    clearConversationId,
    lastError,
    lastRequestId,
  } = useHermesRuntime(activeAgent?.id ?? "default", thinkHarder, "chat");

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <ChatSidebarInner
        lastError={lastError}
        lastRequestId={lastRequestId ?? null}
        thinkHarder={thinkHarder}
        setThinkHarder={setThinkHarder}
        conversationId={conversationId}
        setConversationId={setConversationId}
        clearConversationId={clearConversationId}
        compact={compact}
      />
    </AssistantRuntimeProvider>
  );
}
