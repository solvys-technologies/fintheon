// [claude-code 2026-04-15] Deliberation UI overhaul — per-agent thinking phrases, JSON suppression, KPI extraction
// [claude-code 2026-04-10] S8-T4: Per-agent live streaming panel for Boardroom DAG execution
import { useRef, useEffect, useState, useMemo } from "react";
import type { HermesAgentId } from "../../../backend-hono/src/services/agent-bus/types";
import { AGENT_THINKING_PHRASES } from "../../lib/agentThinkingPhrases";
import { parseAgentText, type KPISignals } from "../../lib/agentStreamParser";

// ── Agent display metadata ────────────────────────────────────────────────────

const AGENT_META: Record<
  HermesAgentId,
  { label: string; role: string; icon: string }
> = {
  oracle: { label: "Oracle", role: "All-Seer", icon: "O" },
  feucht: { label: "Feucht", role: "Futures & Risk", icon: "F" },
  consul: { label: "Consul", role: "Fundamentals", icon: "C" },
  herald: { label: "Herald", role: "News & Sentiment", icon: "He" },
  harper: { label: "Harper", role: "Synthesis", icon: "H" },
};

// ── Props ─────────────────────────────────────────────────────────────────────

export interface BoardroomAgentPanelProps {
  agentId: HermesAgentId;
  text: string;
  status: "pending" | "streaming" | "complete" | "error";
  /** When true, panel takes full width (used for Harper synthesis) */
  fullWidth?: boolean;
  /** Fires when JSON is extracted from agent stream, passing derived KPI signals */
  onDataExtracted?: (agentId: HermesAgentId, signals: KPISignals) => void;
}

// ── Status indicator ──────────────────────────────────────────────────────────

function StatusDot({ status }: { status: BoardroomAgentPanelProps["status"] }) {
  if (status === "streaming") {
    return (
      <span
        className="inline-block h-1.5 w-1.5 rounded-full bg-[#c79f4a]"
        style={{ animation: "dag-pulse 1s ease-in-out infinite" }}
      />
    );
  }
  if (status === "complete") {
    return (
      <svg
        width="10"
        height="10"
        viewBox="0 0 10 10"
        className="text-[#c79f4a]"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="2,5 4,7.5 8,3" />
      </svg>
    );
  }
  if (status === "error") {
    return (
      <svg
        width="10"
        height="10"
        viewBox="0 0 10 10"
        className="text-red-400/80"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      >
        <line x1="2" y1="2" x2="8" y2="8" />
        <line x1="8" y1="2" x2="2" y2="8" />
      </svg>
    );
  }
  // pending
  return (
    <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#f0ead6]/15" />
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function BoardroomAgentPanel({
  agentId,
  text,
  status,
  fullWidth = false,
  onDataExtracted,
}: BoardroomAgentPanelProps) {
  const meta = AGENT_META[agentId];
  const scrollRef = useRef<HTMLDivElement>(null);
  const isActive = status === "streaming";
  const isDim = status === "pending";

  // ── Per-agent thinking phrases ───────────────────────────────────────────
  const [phraseIdx, setPhraseIdx] = useState(0);
  const showThinking = isActive && text.length === 0;

  useEffect(() => {
    if (!showThinking) return;
    setPhraseIdx(0);
    const interval = setInterval(() => {
      setPhraseIdx((i) => (i + 1) % AGENT_THINKING_PHRASES[agentId].length);
    }, 2000);
    return () => clearInterval(interval);
  }, [showThinking, agentId]);

  const thinkingPhrase =
    AGENT_THINKING_PHRASES[agentId]?.[phraseIdx] ?? "Processing...";

  // ── JSON suppression + KPI extraction ────────────────────────────────────
  const parsed = useMemo(() => parseAgentText(text), [text]);
  const lastExtractedRef = useRef<string>("");

  useEffect(() => {
    if (parsed.extractedData.length === 0 || !onDataExtracted) return;
    const key = JSON.stringify(parsed.kpiSignals);
    if (key !== lastExtractedRef.current) {
      lastExtractedRef.current = key;
      onDataExtracted(agentId, parsed.kpiSignals);
    }
  }, [parsed, agentId, onDataExtracted]);

  // Auto-scroll to bottom as text streams in
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [text]);

  return (
    <div
      className={`flex flex-col rounded-lg bg-[#050402] p-3 transition-opacity ${
        isDim ? "opacity-40" : "opacity-100"
      } ${fullWidth ? "col-span-full" : ""}`}
      style={{
        outline: isActive
          ? "1px solid rgba(199,159,74,0.35)"
          : "1px solid rgba(240,234,214,0.06)",
        outlineOffset: "-1px",
      }}
    >
      {/* Header */}
      <div className="mb-2 flex items-center gap-2">
        {/* Icon badge */}
        <span
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded text-[9px] font-bold ${
            isActive
              ? "bg-[#c79f4a]/20 text-[#c79f4a]"
              : status === "complete"
                ? "bg-[#c79f4a]/10 text-[#c79f4a]/60"
                : status === "error"
                  ? "bg-red-900/30 text-red-400/60"
                  : "bg-[#f0ead6]/5 text-[#f0ead6]/20"
          }`}
        >
          {meta?.icon ?? agentId[0].toUpperCase()}
        </span>

        <div className="flex min-w-0 flex-col">
          <span
            className={`text-[10px] font-semibold leading-none ${
              isActive
                ? "text-[#c79f4a]"
                : status === "complete"
                  ? "text-[#f0ead6]/60"
                  : status === "error"
                    ? "text-red-400/60"
                    : "text-[#f0ead6]/20"
            }`}
          >
            {meta?.label ?? agentId}
          </span>
          <span className="text-[9px] text-[#f0ead6]/20 leading-none mt-0.5">
            {meta?.role}
          </span>
        </div>

        <div className="ml-auto">
          <StatusDot status={status} />
        </div>
      </div>

      {/* Streaming text */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto transition-opacity duration-300"
        style={{ maxHeight: fullWidth ? 180 : 120 }}
      >
        {showThinking ? (
          /* Per-agent thinking phrase — rotates while waiting for first token */
          <p className="text-[10px] text-[#c79f4a]/70 italic animate-pulse">
            {thinkingPhrase}
          </p>
        ) : text ? (
          <p
            className={`whitespace-pre-wrap break-words text-[11px] leading-relaxed ${
              isActive
                ? "text-[#f0ead6]/80"
                : status === "complete"
                  ? "text-[#f0ead6]/55"
                  : "text-[#f0ead6]/25"
            }`}
          >
            {parsed.cleanText}
            {/* Blinking cursor while streaming */}
            {isActive && (
              <span
                className="ml-px inline-block h-2.5 w-px bg-[#c79f4a]"
                style={{ animation: "dag-blink 1s step-end infinite" }}
              />
            )}
          </p>
        ) : (
          <p className="text-[10px] text-[#f0ead6]/15 italic">
            Awaiting wave...
          </p>
        )}
      </div>

      <style>{`
        @keyframes dag-pulse {
          0%, 100% { opacity: 0.4; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1); }
        }
        @keyframes dag-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}
