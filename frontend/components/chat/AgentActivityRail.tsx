// [claude-code 2026-04-25] S42-T3: live agent-activity rail. Consumes
//   tool_call / citation / thinking events from the bridge stream and renders
//   them as compact rows. Tool-call status uses NothingFuse-style segmented
//   progress (imported, never modified — T8 owns the fuse). Items animate in
//   via the `t-badge` solvys-transition. Empty state collapses to nothing so
//   the rail is invisible while T1 is dark.

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { NothingFuse } from "../shared/NothingFuse";
import type {
  CitationEvent,
  MessageActivity,
  ThinkingEvent,
  ToolCallEvent,
  ToolCallStatus,
} from "../../types/bridge-stream";

interface AgentActivityRailProps {
  activity: MessageActivity;
  /** Visual variant — vertical rail (web) vs horizontal strip (mobile). */
  variant?: "vertical" | "horizontal";
  /** Click handler for citation rows; falls back to fintheon:artifact event. */
  onCitationClick?: (citation: CitationEvent) => void;
  className?: string;
}

const STATUS_SEVERITY: Record<
  ToolCallStatus,
  "neutral" | "low" | "medium" | "high" | "critical"
> = {
  pending: "neutral",
  running: "medium",
  complete: "low",
  error: "critical",
};

const STATUS_VALUE: Record<ToolCallStatus, number> = {
  pending: 0.05,
  running: 0.55,
  complete: 1,
  error: 1,
};

export function AgentActivityRail({
  activity,
  variant = "vertical",
  onCitationClick,
  className,
}: AgentActivityRailProps) {
  const { toolCalls, citations, thoughts } = activity;
  const isEmpty =
    toolCalls.length === 0 && citations.length === 0 && thoughts.length === 0;
  if (isEmpty) return null;

  const handleCitation = (c: CitationEvent) => {
    if (onCitationClick) return onCitationClick(c);
    if (typeof window === "undefined") return;
    window.dispatchEvent(
      new CustomEvent("fintheon:artifact", {
        detail: { kind: "citation", payload: c },
      }),
    );
  };

  const isHorizontal = variant === "horizontal";

  return (
    <aside
      className={[
        "flex gap-2 border-[#c79f4a]/15 bg-[#0a0905] text-[11px] text-[#f0ead6]/70",
        isHorizontal
          ? "flex-row overflow-x-auto border-b px-3 py-2"
          : "w-64 flex-col border-l p-3",
        className ?? "",
      ].join(" ")}
      aria-label="Agent activity"
    >
      {!isHorizontal && (
        <header className="mb-1 text-[9px] font-mono uppercase tracking-[0.18em] text-[#c79f4a]/60">
          Activity
        </header>
      )}
      {toolCalls.map((t) => (
        <ToolCallRow key={`tc-${t.id}`} tool={t} horizontal={isHorizontal} />
      ))}
      {citations.map((c) => (
        <CitationRow
          key={`ci-${c.id}`}
          citation={c}
          horizontal={isHorizontal}
          onClick={handleCitation}
        />
      ))}
      {thoughts.map((th) => (
        <ThinkingRow
          key={`th-${th.id}`}
          thought={th}
          horizontal={isHorizontal}
        />
      ))}
    </aside>
  );
}

interface ToolCallRowProps {
  tool: ToolCallEvent;
  horizontal: boolean;
}

function ToolCallRow({ tool, horizontal }: ToolCallRowProps) {
  const value = tool.progress ?? STATUS_VALUE[tool.status];
  const severity = STATUS_SEVERITY[tool.status];
  return (
    <div
      data-open="true"
      className={[
        "t-badge flex flex-col gap-1 rounded-sm border border-[#c79f4a]/15 bg-[#050402] px-2 py-1.5",
        horizontal ? "min-w-[160px]" : "w-full",
      ].join(" ")}
      data-status={tool.status}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate font-mono text-[10px] uppercase tracking-wider text-[#c79f4a]/80">
          {tool.name}
        </span>
        <span className="text-[9px] uppercase text-[#f0ead6]/40">
          {tool.status}
        </span>
      </div>
      <NothingFuse
        value={value}
        severity={severity}
        thickness={3}
        segments={8}
        animateIn
      />
      {tool.detail && (
        <span className="truncate font-mono text-[9px] text-[#f0ead6]/40">
          {tool.detail}
        </span>
      )}
    </div>
  );
}

interface CitationRowProps {
  citation: CitationEvent;
  horizontal: boolean;
  onClick: (c: CitationEvent) => void;
}

function CitationRow({ citation, horizontal, onClick }: CitationRowProps) {
  return (
    <button
      type="button"
      data-open="true"
      onClick={() => onClick(citation)}
      className={[
        "t-badge flex items-center gap-2 rounded-sm border border-[#c79f4a]/15 bg-[#050402] px-2 py-1.5 text-left transition-colors hover:border-[#c79f4a]/40 hover:bg-[#c79f4a]/5",
        horizontal ? "min-w-[140px]" : "w-full",
      ].join(" ")}
    >
      <span className="inline-flex h-[15px] min-w-[15px] items-center justify-center rounded-[3px] border border-[#c79f4a]/35 bg-[#c79f4a]/10 px-1 font-mono text-[10px] tabular-nums leading-none text-[#c79f4a]">
        {citation.id}
      </span>
      <span className="truncate text-[11px] text-[#f0ead6]/80">
        {citation.source || citation.url || `Source ${citation.id}`}
      </span>
    </button>
  );
}

interface ThinkingRowProps {
  thought: ThinkingEvent;
  horizontal: boolean;
}

function ThinkingRow({ thought, horizontal }: ThinkingRowProps) {
  const [open, setOpen] = useState(false);
  const expandable = Boolean(thought.body && thought.body !== thought.summary);
  return (
    <div
      data-open="true"
      className={[
        "t-badge flex flex-col rounded-sm border border-[#c79f4a]/10 bg-[#050402] px-2 py-1.5",
        horizontal ? "min-w-[180px]" : "w-full",
      ].join(" ")}
    >
      <button
        type="button"
        onClick={() => expandable && setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-left"
        aria-expanded={open}
        disabled={!expandable}
      >
        {expandable && (
          <ChevronRight
            size={10}
            className="shrink-0 text-[#c79f4a]/60 transition-transform"
            style={{ transform: open ? "rotate(90deg)" : "rotate(0deg)" }}
          />
        )}
        <span className="truncate text-[11px] italic text-[#f0ead6]/70">
          {thought.summary}
        </span>
      </button>
      {open && thought.body && (
        <p className="mt-1 whitespace-pre-wrap text-[10px] leading-snug text-[#f0ead6]/55">
          {thought.body}
        </p>
      )}
    </div>
  );
}
