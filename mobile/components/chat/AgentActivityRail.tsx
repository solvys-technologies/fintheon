// [claude-code 2026-04-25] S42-T3 mobile: agent-activity rail. Mobile variant
//   is a horizontal collapsible strip docked above the message list. Renders
//   tool_call / citation / thinking events from the bridge stream. Empty
//   state hides the strip entirely so the bubble flow is unchanged when T1
//   is dark. Tool-call status pills use a thin segmented progress bar; full
//   NothingFuse lives in frontend (mobile uses a simpler inline equivalent
//   keyed off mobile's severity tokens).

import { useState, type CSSProperties } from "react";
import { ChevronDown, ChevronRight, ChevronUp } from "lucide-react";
import type {
  CitationEvent,
  MessageActivity,
  ThinkingEvent,
  ToolCallEvent,
  ToolCallStatus,
} from "@frontend/types/bridge-stream";

interface AgentActivityRailProps {
  activity: MessageActivity;
  onCitationClick?: (citation: CitationEvent) => void;
  defaultOpen?: boolean;
}

const STATUS_COLOR: Record<ToolCallStatus, string> = {
  pending: "var(--text-disabled)",
  running: "var(--accent)",
  complete: "var(--success, #4caf50)",
  error: "var(--error, #d4615a)",
};

const STATUS_PROGRESS: Record<ToolCallStatus, number> = {
  pending: 0.05,
  running: 0.55,
  complete: 1,
  error: 1,
};

export function AgentActivityRail({
  activity,
  onCitationClick,
  defaultOpen = true,
}: AgentActivityRailProps) {
  const [open, setOpen] = useState(defaultOpen);
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

  const containerStyle: CSSProperties = {
    borderBottom: "1px solid var(--border)",
    background: "var(--surface)",
    fontFamily: "var(--font-data)",
    fontSize: 11,
    color: "var(--text-secondary, var(--text-primary))",
  };

  return (
    <aside style={containerStyle} aria-label="Agent activity">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          width: "100%",
          padding: "6px 12px",
          background: "transparent",
          border: "none",
          color: "var(--accent)",
          fontFamily: "var(--font-data)",
          fontSize: 9,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          cursor: "pointer",
        }}
        aria-expanded={open}
      >
        {open ? <ChevronDown size={10} /> : <ChevronUp size={10} />}
        <span>Activity · {toolCalls.length + citations.length + thoughts.length}</span>
      </button>
      {open && (
        <div
          style={{
            display: "flex",
            gap: 6,
            padding: "0 12px 8px",
            overflowX: "auto",
          }}
        >
          {toolCalls.map((t) => (
            <ToolCallChip key={`tc-${t.id}`} tool={t} />
          ))}
          {citations.map((c) => (
            <CitationChipRow key={`ci-${c.id}`} citation={c} onClick={handleCitation} />
          ))}
          {thoughts.map((th) => (
            <ThinkingChip key={`th-${th.id}`} thought={th} />
          ))}
        </div>
      )}
    </aside>
  );
}

function ToolCallChip({ tool }: { tool: ToolCallEvent }) {
  const value = tool.progress ?? STATUS_PROGRESS[tool.status];
  const color = STATUS_COLOR[tool.status];
  return (
    <div
      data-status={tool.status}
      style={{
        minWidth: 140,
        display: "flex",
        flexDirection: "column",
        gap: 4,
        padding: "6px 8px",
        border: "1px solid var(--border)",
        borderRadius: 4,
        background: "var(--surface-raised)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 6 }}>
        <span
          style={{
            fontSize: 10,
            color: "var(--accent)",
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            maxWidth: 90,
          }}
        >
          {tool.name}
        </span>
        <span style={{ fontSize: 9, color: "var(--text-disabled)" }}>
          {tool.status}
        </span>
      </div>
      <div
        style={{
          position: "relative",
          height: 3,
          width: "100%",
          background: "var(--surface)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            height: "100%",
            width: `${Math.max(0, Math.min(1, value)) * 100}%`,
            background: color,
            transition: "width 360ms ease-out",
          }}
        />
      </div>
      {tool.detail && (
        <span
          style={{
            fontSize: 9,
            color: "var(--text-disabled)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {tool.detail}
        </span>
      )}
    </div>
  );
}

function CitationChipRow({
  citation,
  onClick,
}: {
  citation: CitationEvent;
  onClick: (c: CitationEvent) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onClick(citation)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        minWidth: 120,
        padding: "6px 8px",
        border: "1px solid var(--border)",
        borderRadius: 4,
        background: "var(--surface-raised)",
        color: "var(--text-primary)",
        fontFamily: "inherit",
        fontSize: 11,
        cursor: "pointer",
        textAlign: "left",
      }}
    >
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          minWidth: 16,
          height: 16,
          padding: "0 4px",
          border: "1px solid color-mix(in srgb, var(--accent) 35%, transparent)",
          borderRadius: 3,
          background: "color-mix(in srgb, var(--accent) 12%, transparent)",
          color: "var(--accent)",
          fontFamily: "var(--font-data)",
          fontSize: 10,
          lineHeight: 1,
        }}
      >
        {citation.id}
      </span>
      <span
        style={{
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {citation.source || citation.url || `Source ${citation.id}`}
      </span>
    </button>
  );
}

function ThinkingChip({ thought }: { thought: ThinkingEvent }) {
  const [open, setOpen] = useState(false);
  const expandable = Boolean(thought.body && thought.body !== thought.summary);
  return (
    <div
      style={{
        minWidth: 160,
        padding: "6px 8px",
        border: "1px solid var(--border)",
        borderRadius: 4,
        background: "var(--surface-raised)",
      }}
    >
      <button
        type="button"
        onClick={() => expandable && setOpen((v) => !v)}
        disabled={!expandable}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          width: "100%",
          padding: 0,
          background: "transparent",
          border: "none",
          color: "var(--text-primary)",
          fontFamily: "inherit",
          fontSize: 11,
          fontStyle: "italic",
          cursor: expandable ? "pointer" : "default",
          textAlign: "left",
        }}
        aria-expanded={open}
      >
        {expandable && (
          <ChevronRight
            size={10}
            style={{
              flexShrink: 0,
              transform: open ? "rotate(90deg)" : "rotate(0deg)",
              transition: "transform 200ms ease-out",
              color: "var(--accent)",
            }}
          />
        )}
        <span
          style={{
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {thought.summary}
        </span>
      </button>
      {open && thought.body && (
        <p
          style={{
            margin: "4px 0 0",
            fontSize: 10,
            lineHeight: 1.4,
            color: "var(--text-secondary, var(--text-disabled))",
            whiteSpace: "pre-wrap",
          }}
        >
          {thought.body}
        </p>
      )}
    </div>
  );
}
