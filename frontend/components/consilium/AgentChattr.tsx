// [claude-code 2026-04-10] S8-T4: Live DAG panels + SSE streaming — replace polling with DAG dispatch
// [claude-code 2026-03-24] Boardroom UX overhaul — removed sidebar, inline copy, green WiFi pulse, status bar right-aligned
// [claude-code 2026-03-22] Track 3: Boardroom with PromptBox replacing built-in textarea
import { useState, useEffect, useRef, useCallback } from "react";
import {
  RefreshCw,
  WifiOff,
  ChevronDown,
  X,
  Search,
  Square,
} from "lucide-react";
import { ConsiliumMessage, type BoardroomMessage } from "./ConsiliumMessage";
import { AGENT_MAP, type BoardroomAgent } from "./AgentBadge";
import { ConsiliumFilterBar } from "./ConsiliumFilterBar";
import { PromptBox } from "../ui/chatgpt-prompt-input";
import { useRiskFlow } from "../../contexts/RiskFlowContext";
import { useBoardroomDAG } from "../../hooks/useBoardroomDAG";
import { BoardroomAgentPanel } from "./BoardroomAgentPanel";
import { DAGProgressBar } from "./DAGProgressBar";
import type { HermesAgentId } from "../../../backend-hono/src/services/agent-bus/types";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";
const POLL_INTERVAL = 30_000;

const MENTIONABLE_AGENTS: BoardroomAgent[] = [
  "Harper-Opus",
  "Oracle",
  "Feucht",
  "Consul",
  "Herald",
];

/** Map BoardroomAgent UI names → HermesAgentId for DAG filtering */
const BOARDROOM_TO_HERMES: Partial<Record<BoardroomAgent, HermesAgentId>> = {
  "Harper-Opus": "harper",
  Oracle: "oracle",
  Feucht: "feucht",
  Consul: "consul",
  Herald: "herald",
};

// Map boardroom agent names to persona-style metadata
const PERSONA_META: Record<BoardroomAgent, { label: string }> = {
  "Harper-Opus": { label: "CAO" },
  Oracle: { label: "All-Seer" },
  Feucht: { label: "Futures & Risk" },
  Consul: { label: "Fundamentals" },
  Herald: { label: "News & Sentiment" },
  Unknown: { label: "Unknown" },
};

/** Animated WiFi bars — pulses 1→2→3 bars when connected */
function WifiBars() {
  return (
    <div className="flex items-end gap-[2px] h-3">
      <div
        className="w-[2px] rounded-full bg-[#c79f4a] animate-[wifi-pulse_1.2s_ease-in-out_infinite]"
        style={{ height: 4 }}
      />
      <div
        className="w-[2px] rounded-full bg-[#c79f4a] animate-[wifi-pulse_1.2s_ease-in-out_0.2s_infinite]"
        style={{ height: 7 }}
      />
      <div
        className="w-[2px] rounded-full bg-[#c79f4a] animate-[wifi-pulse_1.2s_ease-in-out_0.4s_infinite]"
        style={{ height: 10 }}
      />
      <style>{`
        @keyframes wifi-pulse {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
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

function getDateRangeSince(
  range: "today" | "7d" | "30d" | "all",
): string | undefined {
  if (range === "all") return undefined;
  const now = new Date();
  if (range === "today")
    return new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    ).toISOString();
  if (range === "7d")
    return new Date(now.getTime() - 7 * 86400000).toISOString();
  if (range === "30d")
    return new Date(now.getTime() - 30 * 86400000).toISOString();
  return undefined;
}

export function AgentChattr() {
  const [messages, setMessages] = useState<BoardroomMessage[]>([]);
  const [input, setInput] = useState("");
  const [isOnline, setIsOnline] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<BoardroomAgent | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [thinkHarder, setThinkHarder] = useState(false);
  const [rfPickerOpen, setRfPickerOpen] = useState(false);
  const [rfChips, setRfChips] = useState<{ id: string; headline: string }[]>(
    [],
  );
  const { alerts: rfAlerts } = useRiskFlow();

  // DAG state — live multi-agent streaming
  const dag = useBoardroomDAG("", "");
  const dagIsActive = dag.status === "dispatching" || dag.status === "running";
  const dagIsDone = dag.status === "complete" || dag.status === "error";

  // Filter state
  const [filterSearch, setFilterSearch] = useState("");
  const [filterDateRange, setFilterDateRange] = useState<
    "today" | "7d" | "30d" | "all"
  >("all");
  const [totalMessages, setTotalMessages] = useState(0);
  const lastSeenCount = useRef(0);
  const [newMessageCount, setNewMessageCount] = useState(0);
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
      const params = new URLSearchParams();
      if (filterSearch) params.set("search", filterSearch);
      const since = getDateRangeSince(filterDateRange);
      if (since) params.set("since", since);
      const qs = params.toString();
      const res = await fetch(
        `${API_BASE}/api/boardroom/messages${qs ? `?${qs}` : ""}`,
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setMessages(data.messages || []);
      const total = data.total ?? data.messages?.length ?? 0;
      setTotalMessages(total);
      // Track new messages since last seen
      if (lastSeenCount.current > 0) {
        setNewMessageCount(Math.max(0, total - lastSeenCount.current));
      } else {
        lastSeenCount.current = total;
      }
      setIsOnline(true);
      setIsLoading(false);
    } catch {
      setIsOnline(false);
      setIsLoading(false);
    }
  }, [filterSearch, filterDateRange]);

  // When DAG reaches terminal state, refresh legacy transcript
  useEffect(() => {
    if (dag.status === "complete" || dag.status === "error") {
      fetchMessages();
    }
  }, [dag.status, fetchMessages]);

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
    if (!text && rfChips.length === 0) return;
    if (isSending || dagIsActive) return;

    // Append RiskFlow context chips to message
    if (rfChips.length > 0) {
      const context = rfChips
        .map((c) => `[RiskFlow: ${c.headline}]`)
        .join("\n");
      text = text ? `${text}\n\n${context}` : context;
    }

    setInput("");
    setRfChips([]);

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
      {/* Unified status + filter bar — single row, no bottom border */}
      <div className="flex items-center gap-3 px-4 py-2">
        {/* Search input */}
        <div className="relative flex-shrink-0">
          <Search
            size={14}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--fintheon-text)]/30"
          />
          <input
            type="text"
            value={filterSearch}
            onChange={(e) => setFilterSearch(e.target.value)}
            placeholder="Search messages..."
            className="w-[180px] rounded-full border border-[var(--fintheon-accent)]/15 bg-[var(--fintheon-bg)] py-1.5 pl-8 pr-3 text-xs text-[var(--fintheon-text)] placeholder-[var(--fintheon-text)]/20 outline-none transition-colors focus:border-[var(--fintheon-accent)]/40"
          />
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Message count */}
        <span
          className={`text-[10px] font-mono ${
            newMessageCount > 0
              ? "text-[var(--fintheon-accent)]"
              : "text-[var(--fintheon-muted)]/40"
          }`}
          style={
            newMessageCount > 0
              ? { animation: "msg-pulse 2s ease-in-out infinite" }
              : undefined
          }
          onClick={() => {
            lastSeenCount.current = totalMessages;
            setNewMessageCount(0);
          }}
        >
          {newMessageCount > 0
            ? `${newMessageCount} new messages`
            : `${totalMessages} messages`}
        </span>
        <button
          onClick={fetchMessages}
          className="rounded-full p-1.5 text-[var(--fintheon-accent)]/40 transition-colors hover:bg-[var(--fintheon-accent)]/10 hover:text-[var(--fintheon-accent)]"
          title="Refresh"
        >
          <RefreshCw size={14} />
        </button>
        <div className="flex items-center gap-1.5">
          {isOnline ? (
            <WifiBars />
          ) : (
            <WifiOff size={12} className="text-red-500/60" />
          )}
          <span
            className={`text-[10px] ${isOnline ? "text-[#c79f4a]/70" : "text-[var(--fintheon-text)]/30"}`}
          >
            {isOnline ? "Connected" : "Offline"}
          </span>
        </div>

        {/* Date range — right side */}
        <div className="flex items-center rounded-lg border border-[var(--fintheon-border)]/15 overflow-hidden">
          {(["today", "7d", "30d", "all"] as const).map((range) => (
            <button
              key={range}
              onClick={() => setFilterDateRange(range)}
              className={`px-3 py-1.5 text-[10px] uppercase tracking-wider transition-colors ${
                filterDateRange === range
                  ? "text-[var(--fintheon-accent)] bg-[var(--fintheon-accent)]/8"
                  : "text-[var(--fintheon-muted)]/50 hover:text-[var(--fintheon-text)]"
              }`}
            >
              {range === "today" ? "Today" : range === "all" ? "All" : range}
            </button>
          ))}
        </div>
      </div>

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
                <div
                  className={`grid gap-2 ${
                    visibleAnalysis.length === 1
                      ? "grid-cols-1"
                      : visibleAnalysis.length === 2
                        ? "grid-cols-2"
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
                      />
                    );
                  })}
                </div>

                {/* Harper synthesis — full width */}
                {showHarper &&
                  (() => {
                    const harperOut = dag.agentOutputs["harper"] ?? {
                      agentId: "harper" as HermesAgentId,
                      text: "",
                      status: "pending" as const,
                    };
                    return (
                      <BoardroomAgentPanel
                        agentId="harper"
                        text={harperOut.text}
                        status={harperOut.status}
                        fullWidth
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

      {/* RiskFlow context chips */}
      {rfChips.length > 0 && (
        <div className="flex flex-wrap gap-1 px-3 pb-1">
          {rfChips.map((c) => (
            <span
              key={c.id}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-[var(--fintheon-accent)]/10 border border-[var(--fintheon-accent)]/20 text-[var(--fintheon-accent)]"
            >
              {c.headline.slice(0, 40)}
              {c.headline.length > 40 ? "..." : ""}
              <button
                onClick={() =>
                  setRfChips((prev) => prev.filter((p) => p.id !== c.id))
                }
                className="hover:text-red-400 transition-colors"
              >
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* RiskFlow item picker dropdown */}
      {rfPickerOpen && (
        <div className="mx-2 mb-1 max-h-48 overflow-y-auto rounded-lg border border-[var(--fintheon-accent)]/20 bg-[var(--fintheon-bg)] shadow-xl">
          <div className="px-3 py-1.5 border-b border-[var(--fintheon-accent)]/10 flex items-center justify-between">
            <span className="text-[9px] text-[var(--fintheon-accent)]/50 uppercase tracking-wider">
              Attach RiskFlow Items
            </span>
            <button
              onClick={() => setRfPickerOpen(false)}
              className="text-zinc-500 hover:text-[var(--fintheon-accent)]"
            >
              <X size={12} />
            </button>
          </div>
          {rfAlerts.slice(0, 10).map((a) => (
            <button
              key={a.id}
              onClick={() => {
                if (!rfChips.find((c) => c.id === a.id)) {
                  setRfChips((prev) => [
                    ...prev,
                    { id: a.id, headline: a.headline },
                  ]);
                }
                setRfPickerOpen(false);
              }}
              className="w-full text-left px-3 py-1.5 text-[10px] text-[var(--fintheon-text)]/60 hover:bg-[var(--fintheon-accent)]/5 hover:text-[var(--fintheon-text)] transition-colors flex items-center gap-2"
            >
              <span
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${a.severity === "high" || a.severity === "critical" ? "bg-red-400" : a.severity === "medium" ? "bg-[var(--fintheon-accent)]" : "bg-zinc-500"}`}
              />
              <span className="truncate">{a.headline}</span>
            </button>
          ))}
          {rfAlerts.length === 0 && (
            <div className="px-3 py-4 text-center text-[10px] text-zinc-600">
              No RiskFlow items available
            </div>
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
            onRiskFlowPick={() => setRfPickerOpen((v) => !v)}
          />
        )}
      </div>
    </div>
  );
}
