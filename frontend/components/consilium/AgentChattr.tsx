// [claude-code 2026-04-11] S14-T5: Replaced rfChips/rfPickerOpen with HeadlinePickerPopover
// [claude-code 2026-04-10] S8-T4: Live DAG panels + SSE streaming — replace polling with DAG dispatch
// [claude-code 2026-03-24] Boardroom UX overhaul — removed sidebar, inline copy, green WiFi pulse, status bar right-aligned
// [claude-code 2026-03-22] Track 3: Boardroom with PromptBox replacing built-in textarea
import { useState, useEffect, useRef, useCallback } from "react";
import {
  ChevronDown,
  X,
  History,
  Clock,
  Square,
} from "lucide-react";
import { ConsiliumMessage, type BoardroomMessage } from "./ConsiliumMessage";
import { AGENT_MAP, type BoardroomAgent } from "./AgentBadge";
import { PromptBox } from "../ui/chatgpt-prompt-input";
import { useRiskFlow } from "../../contexts/RiskFlowContext";
import {
  formatHeadlineContext,
  type HeadlineChip,
} from "../chat/HeadlinePickerPopover";
import { useBoardroomDAG } from "../../hooks/useBoardroomDAG";
import { BoardroomAgentPanel } from "./BoardroomAgentPanel";
import { DeliberationKPIOverlay } from "./DeliberationKPIOverlay";
import { DAGProgressBar } from "./DAGProgressBar";
import type { KPISignals } from "../../lib/agentStreamParser";
import {
  saveThread,
  createThread as createBoardroomThread,
  syncFromSupabase,
  type BoardroomThread,
} from "../../lib/boardroomThreadStore";
import type { HermesAgentId } from "../../../backend-hono/src/services/agent-bus/types";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";
const POLL_INTERVAL = 30_000;

const MENTIONABLE_AGENTS: BoardroomAgent[] = [
  "Harper",
  "Oracle",
  "Feucht",
  "Consul",
  "Herald",
];

/** Map BoardroomAgent UI names → HermesAgentId for DAG filtering */
const BOARDROOM_TO_HERMES: Partial<Record<BoardroomAgent, HermesAgentId>> = {
  Harper: "harper",
  Oracle: "oracle",
  Feucht: "feucht",
  Consul: "consul",
  Herald: "herald",
};

// Map boardroom agent names to persona-style metadata
const PERSONA_META: Record<BoardroomAgent, { label: string }> = {
  Harper: { label: "CAO" },
  Oracle: { label: "All-Seer" },
  Feucht: { label: "Futures & Risk" },
  Consul: { label: "Fundamentals" },
  Herald: { label: "News & Sentiment" },
  Unknown: { label: "Unknown" },
};

/** Format elapsed seconds into mm:ss */
function formatElapsed(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function getAgentColor(_agent: BoardroomAgent): string {
  return "var(--fintheon-accent)";
}

function AgentDropdown({
  selectedAgent,
  onSelect,
}: {
  selectedAgent: BoardroomAgent | null;
  onSelect: (agent: BoardroomAgent | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const label = selectedAgent
    ? AGENT_MAP[selectedAgent]?.label || selectedAgent
    : "All";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors border ${
          selectedAgent
            ? "border-[var(--fintheon-accent)]/30 text-[var(--fintheon-accent)]"
            : "border-[var(--fintheon-accent)]/20 text-[var(--fintheon-text)]/60 hover:bg-[var(--fintheon-accent)]/5 hover:text-[var(--fintheon-text)]"
        }`}
      >
        {selectedAgent && (
          <span
            className="w-[6px] h-[6px] rounded-full shrink-0"
            style={{ backgroundColor: getAgentColor(selectedAgent) }}
          />
        )}
        <span className="whitespace-nowrap">{label}</span>
        <ChevronDown
          size={12}
          className={`transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute bottom-full left-0 mb-1 z-50 w-52 rounded-lg border border-[var(--fintheon-accent)]/20 bg-[var(--fintheon-bg)] py-1 shadow-xl">
          {/* "All" option */}
          <button
            onClick={() => {
              onSelect(null);
              setOpen(false);
            }}
            className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors ${
              !selectedAgent
                ? "bg-[var(--fintheon-accent)]/10 text-[var(--fintheon-accent)]"
                : "text-[var(--fintheon-text)]/60 hover:bg-[var(--fintheon-accent)]/5 hover:text-[var(--fintheon-text)]"
            }`}
          >
            <span className="font-medium">All Agents</span>
            <span className="ml-auto text-[10px] text-[var(--fintheon-text)]/30">
              Broadcast
            </span>
          </button>

          <div className="h-px bg-[var(--fintheon-accent)]/10 my-0.5" />

          {MENTIONABLE_AGENTS.map((agent) => {
            const info = AGENT_MAP[agent];
            const meta = PERSONA_META[agent];
            return (
              <button
                key={agent}
                onClick={() => {
                  onSelect(agent);
                  setOpen(false);
                }}
                className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors ${
                  selectedAgent === agent
                    ? "bg-[var(--fintheon-accent)]/10 text-[var(--fintheon-accent)]"
                    : "text-[var(--fintheon-text)]/60 hover:bg-[var(--fintheon-accent)]/5 hover:text-[var(--fintheon-text)]"
                }`}
              >
                <span
                  className="w-[6px] h-[6px] rounded-full shrink-0"
                  style={{ backgroundColor: getAgentColor(agent) }}
                />
                <span className="font-medium">{info?.label || agent}</span>
                <span className="ml-auto text-[10px] text-[var(--fintheon-text)]/30">
                  {meta.label}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function AgentChattr({
  headerSlot,
}: { headerSlot?: React.ReactNode } = {}) {
  const [messages, setMessages] = useState<BoardroomMessage[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [showHistory, setShowHistory] = useState(false);
  const [runHistory, setRunHistory] = useState<BoardroomThread[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<BoardroomAgent | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [thinkHarder, setThinkHarder] = useState(false);
  const [headlineChips, setHeadlineChips] = useState<HeadlineChip[]>([]);
  const { alerts: rfAlerts } = useRiskFlow();

  const handleHeadlineToggle = useCallback((chip: HeadlineChip) => {
    setHeadlineChips((prev) => {
      const exists = prev.find((c) => c.id === chip.id);
      if (exists) return prev.filter((c) => c.id !== chip.id);
      return [...prev, chip];
    });
  }, []);

  const handleHeadlineClear = useCallback(() => {
    setHeadlineChips([]);
  }, []);

  // DAG state — live multi-agent streaming
  const dag = useBoardroomDAG("", "");
  const dagIsActive = dag.status === "dispatching" || dag.status === "running";
  const dagIsDone = dag.status === "complete" || dag.status === "error";

  // Elapsed-time timer while DAG is active
  useEffect(() => {
    if (!dagIsActive) {
      setElapsedSeconds(0);
      return;
    }
    const interval = setInterval(() => {
      setElapsedSeconds((s) => s + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [dagIsActive]);

  // Load run history when toggled
  const loadRunHistory = useCallback(async () => {
    try {
      const { getAllThreads } = await import("../../lib/boardroomThreadStore");
      const threads = await getAllThreads();
      setRunHistory(threads.slice(0, 20));
    } catch {
      setRunHistory([]);
    }
  }, []);

  useEffect(() => {
    if (showHistory) void loadRunHistory();
  }, [showHistory, loadRunHistory]);

  // KPI signal aggregation from agent JSON extraction
  const [kpiSignals, setKpiSignals] = useState<Record<string, KPISignals>>({});
  const handleDataExtracted = useCallback(
    (agentId: HermesAgentId, signals: KPISignals) => {
      setKpiSignals((prev) => ({ ...prev, [agentId]: signals }));
    },
    [],
  );
  useEffect(() => {
    if (dag.status === "idle") setKpiSignals({});
  }, [dag.status]);

  const [isVisible, setIsVisible] = useState(!document.hidden);

  // Pause polling when tab not visible
  useEffect(() => {
    const handler = () => setIsVisible(!document.hidden);
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, []);

  const scrollRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/boardroom/messages`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setMessages(data.messages || []);
      setIsLoading(false);
    } catch {
      setIsLoading(false);
    }
  }, []);

  // Sync boardroom threads from Supabase on mount
  useEffect(() => {
    void syncFromSupabase();
  }, []);

  // When DAG reaches terminal state, refresh legacy transcript + persist thread
  useEffect(() => {
    if (dag.status === "complete" || dag.status === "error") {
      fetchMessages();

      // Persist the completed DAG as a boardroom thread
      if (dag.dagId && Object.keys(dag.agentOutputs).length > 0) {
        const HERMES_TO_BOARDROOM: Record<string, BoardroomAgent> = {
          oracle: "Oracle",
          feucht: "Feucht",
          consul: "Consul",
          herald: "Herald",
          harper: "Harper",
        };
        const now = new Date().toISOString();
        const threadMessages: BoardroomMessage[] = Object.entries(
          dag.agentOutputs,
        ).map(([agentId, output]) => ({
          id: `${dag.dagId}-${agentId}`,
          agent: HERMES_TO_BOARDROOM[agentId] ?? "Unknown",
          emoji: "",
          role: "assistant" as const,
          content: output.text,
          timestamp: now,
        }));
        const thread = createBoardroomThread(threadMessages, []);
        void saveThread(thread);
      }
    }
  }, [dag.status, dag.dagId, dag.agentOutputs, fetchMessages]);

  // Initial fetch + polling (pauses when tab not visible)
  useEffect(() => {
    if (!isVisible) return;
    fetchMessages();
    pollRef.current = setInterval(fetchMessages, POLL_INTERVAL);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchMessages, isVisible]);

  // Auto-scroll on new messages
  useEffect(() => {
    scrollToBottom();
  }, [messages.length, scrollToBottom]);

  const sendMessage = async (msgText?: string) => {
    let text = (msgText ?? input).trim();
    if (!text && headlineChips.length === 0) return;
    if (isSending || dagIsActive) return;

    // Append attached headline context
    if (headlineChips.length > 0) {
      text += formatHeadlineContext(headlineChips);
    }

    setInput("");
    setHeadlineChips([]);

    // When targeting All Agents: dispatch a live DAG
    // When targeting a single agent: fall back to legacy single-agent fetch
    if (!selectedAgent) {
      setSelectedAgent(null);
      dag.reset();
      await dag.dispatch(text);
      return;
    }

    // Legacy single-agent path
    setIsSending(true);
    try {
      await fetch(`${API_BASE}/api/boardroom/mention/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          agent: selectedAgent,
          thinkHarder,
        }),
      });
      setSelectedAgent(null);
      await fetchMessages();
    } catch (err) {
      console.error("[Consilium] Failed to send:", err);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="relative flex h-full flex-col">
      {/* Status bar — run history + elapsed time during deliberation */}
      <div className="flex items-center gap-3 px-4 py-2">
        <button
          onClick={() => setShowHistory((v) => !v)}
          className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10px] font-medium transition-colors border ${
            showHistory
              ? "border-[var(--fintheon-accent)]/30 text-[var(--fintheon-accent)] bg-[var(--fintheon-accent)]/10"
              : "border-[var(--fintheon-accent)]/15 text-[var(--fintheon-text)]/50 hover:bg-[var(--fintheon-accent)]/5 hover:text-[var(--fintheon-text)]"
          }`}
          title="Run history"
        >
          <History size={12} />
          Runs
        </button>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Elapsed time during deliberation */}
        {dagIsActive && (
          <div className="flex items-center gap-1.5 text-[10px] text-[var(--fintheon-accent)]/70">
            <Clock size={12} className="animate-pulse" />
            <span className="font-mono tabular-nums">
              {formatElapsed(elapsedSeconds)}
            </span>
          </div>
        )}
        {headerSlot}
      </div>

      {/* Run history overlay */}
      {showHistory && (
        <div className="absolute top-10 left-3 z-40 w-72 max-h-80 overflow-y-auto rounded-lg border border-[var(--fintheon-accent)]/20 bg-[var(--fintheon-bg)] shadow-xl">
          <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--fintheon-accent)]/10">
            <span className="text-[10px] text-[var(--fintheon-accent)]/60 uppercase tracking-wider">
              Recent Runs
            </span>
            <button
              onClick={() => setShowHistory(false)}
              className="p-1 rounded hover:bg-[var(--fintheon-accent)]/10 text-zinc-500 hover:text-[var(--fintheon-accent)] transition-colors"
            >
              <X size={12} />
            </button>
          </div>
          {runHistory.length === 0 ? (
            <div className="px-3 py-4 text-[10px] text-zinc-600 text-center">
              No saved runs yet
            </div>
          ) : (
            runHistory.map((thread) => (
              <button
                key={thread.id}
                onClick={() => {
                  setMessages(thread.messages);
                  setShowHistory(false);
                }}
                className="w-full text-left px-3 py-2 text-[10px] text-[var(--fintheon-text)]/70 hover:bg-[var(--fintheon-accent)]/5 transition-colors border-b border-zinc-800/40 last:border-0"
              >
                <p className="truncate font-medium">{thread.title}</p>
                <p className="text-zinc-600 mt-0.5">
                  {thread.participants.join(", ")} &middot;{" "}
                  {new Date(thread.updatedAt).toLocaleDateString()}
                </p>
              </button>
            ))
          )}
        </div>
      )}

      {/* Floating KPI overlay during deliberation */}
      {(dagIsActive || dagIsDone) && (
        <DeliberationKPIOverlay
          agentOutputs={dag.agentOutputs}
          dagStatus={dag.status}
        />
      )}

      {/* DAG live panels — shown while DAG is active or just completed */}
      {dagIsActive || dagIsDone ? (
        <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-3 py-2">
          {/* Progress bar */}
          <DAGProgressBar
            currentWave={dag.progress.currentWave}
            totalWaves={dag.progress.totalWaves}
            tasks={dag.progress.tasks}
            dagStatus={dag.status}
          />

          {/* Agent panels grid — 2×2 for analysis agents, Harper full-width below */}
          {(() => {
            const analysisAgentIds = [
              "oracle",
              "feucht",
              "consul",
              "herald",
            ] as HermesAgentId[];
            const filterHermesId = selectedAgent
              ? BOARDROOM_TO_HERMES[selectedAgent]
              : null;

            const visibleAnalysis = filterHermesId
              ? analysisAgentIds.filter((id) => id === filterHermesId)
              : analysisAgentIds;

            const showHarper = !filterHermesId || filterHermesId === "harper";

            return (
              <>
                {/* Sub-analyst panels — persist and remain expandable */}
                <div className="overflow-hidden transition-all duration-500">
                  <div
                    className={`grid gap-2 ${
                      visibleAnalysis.length === 1
                        ? "grid-cols-1"
                        : "grid-cols-2"
                    }`}
                  >
                    {visibleAnalysis.map((id) => {
                      const out = dag.agentOutputs[id] ?? {
                        agentId: id,
                        text: "",
                        status: "pending",
                      };
                      return (
                        <BoardroomAgentPanel
                          key={id}
                          agentId={id}
                          text={out.text}
                          status={out.status}
                          onDataExtracted={handleDataExtracted}
                        />
                      );
                    })}
                  </div>
                </div>

                {/* Harper synthesis — full width, persists after completion */}
                {showHarper &&
                  (() => {
                    const ho = dag.agentOutputs["harper"] ?? {
                      agentId: "harper" as HermesAgentId,
                      text: "",
                      status: "pending" as const,
                    };
                    return (
                      <BoardroomAgentPanel
                        agentId="harper"
                        text={ho.text}
                        status={ho.status}
                        fullWidth
                        onDataExtracted={handleDataExtracted}
                      />
                    );
                  })()}
              </>
            );
          })()}

          {/* Back to transcript button when DAG is done */}
          {dagIsDone && (
            <div className="flex justify-center pt-1">
              <button
                onClick={() => dag.reset()}
                className="flex items-center gap-1.5 rounded-full border border-[var(--fintheon-accent)]/20 px-3 py-1.5 text-[10px] text-[var(--fintheon-text)]/40 transition-colors hover:border-[var(--fintheon-accent)]/40 hover:text-[var(--fintheon-accent)]"
              >
                Back to transcript
              </button>
            </div>
          )}
        </div>
      ) : (
        /* Legacy message transcript */
        <div ref={scrollRef} className="flex-1 overflow-y-auto py-2">
          {isLoading ? (
            <div className="flex h-full items-center justify-center">
              <span className="text-xs text-[var(--fintheon-text)]/30">
                Loading transcript...
              </span>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 px-6">
              <span className="text-sm text-[var(--fintheon-accent)]/40">
                No messages yet
              </span>
              <span className="text-center text-xs text-[var(--fintheon-text)]/20">
                The Consilium awaits. Send a message to begin deliberation.
              </span>
            </div>
          ) : (
            messages.map((msg) => (
              <ConsiliumMessage key={msg.id} message={msg} />
            ))
          )}
        </div>
      )}

      {/* Input area — disabled while DAG is running; cancel button shown instead */}
      <div className="px-2">
        {dagIsActive ? (
          <div className="flex items-center justify-between rounded-xl border border-[var(--fintheon-accent)]/15 bg-[var(--fintheon-bg)] px-3 py-2">
            <span className="text-[11px] text-[var(--fintheon-text)]/30 italic">
              Deliberation in progress...
            </span>
            <button
              onClick={() => dag.cancel()}
              className="flex items-center gap-1 rounded px-2 py-1 text-[10px] text-red-400/50 transition-colors hover:bg-red-900/20 hover:text-red-400"
              title="Cancel DAG"
            >
              <Square size={10} />
              Cancel
            </button>
          </div>
        ) : (
          <PromptBox
            compact
            onSend={(msg) => sendMessage(msg)}
            isProcessing={isSending}
            placeholder={
              selectedAgent
                ? `Message @${AGENT_MAP[selectedAgent]?.label}...`
                : "Address the Consilium..."
            }
            thinkHarder={thinkHarder}
            setThinkHarder={setThinkHarder}
            activeSkill={null}
            onSelectSkill={() => {}}
            showSkills={false}
            onToggleSkills={() => {}}
            headlineAlerts={rfAlerts}
            headlineChips={headlineChips}
            onHeadlineToggle={handleHeadlineToggle}
            onHeadlineClear={handleHeadlineClear}
            hideThinkHarder
          />
        )}
      </div>
    </div>
  );
}
