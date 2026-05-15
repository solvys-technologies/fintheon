// [claude-code 2026-03-06] Tool call/result part renderer with per-tool formatting
import { useState, useEffect } from "react";
import {
  ChevronDown,
  ChevronRight,
  Check,
  AlertCircle,
} from "lucide-react";
import { BrailleSpinner } from "../primitive/BrailleSpinner";
import { RichTextRenderer } from "../../shared/RichTextRenderer";
import type { ToolInvocationPart, ToolResultPart } from "../types";

interface ToolCallPartProps {
  part: ToolInvocationPart;
  result?: ToolResultPart;
}

const TOOL_COLORS: Record<string, string> = {
  web_search: "#A78BFA",
  market_scanner: "var(--fintheon-accent)",
  research: "#60A5FA",
  code_exec: "#34D399",
  browser: "#F59E0B",
  bash: "#34D399",
  read: "#60A5FA",
  edit: "#F59E0B",
  grep: "#A78BFA",
  glob: "#A78BFA",
  default: "#9CA3AF",
};

const TOOL_PHRASES: Record<string, string[]> = {
  bash: ["Running command...", "Executing script...", "Processing shell..."],
  read: ["Reading file...", "Scanning contents...", "Looking at code..."],
  edit: ["Editing file...", "Applying changes...", "Modifying code..."],
  grep: ["Searching codebase...", "Finding patterns...", "Indexing results..."],
  glob: ["Exploring files...", "Discovering paths...", "Listing matches..."],
  web_search: ["Searching the web...", "Scanning sources...", "Retrieving insights..."],
  code_exec: ["Running code...", "Executing logic...", "Computing result..."],
  browser: ["Navigating page...", "Loading browser...", "Rendering content..."],
  research: ["Gathering data...", "Analyzing findings...", "Synthesizing research..."],
  market_scanner: ["Scanning markets...", "Pulling tick data...", "Mapping flows..."],
  default: ["Processing...", "Working on it...", "One moment..."],
};

function getToolColor(name: string): string {
  const lower = name.toLowerCase();
  return TOOL_COLORS[lower] || TOOL_COLORS.default;
}

const expandStates = new Map<string, boolean>();

function ToolCallCard({ part, result }: ToolCallPartProps) {
  const toolName = part.toolName;
  const color = getToolColor(toolName);
  const output = result?.output || "";
  const state = part.state;
  const isRunning = state === "running" || state === "pending";
  const isDone = state === "done";
  const isError = state === "error";

  const cardKey = `${toolName}-${part.id}`;
  if (!expandStates.has(cardKey)) {
    expandStates.set(cardKey, false);
  }
  const [expanded, setExpanded] = useState(expandStates.get(cardKey)!);

  const [phrase] = useState(() => {
    const phrases =
      TOOL_PHRASES[toolName.toLowerCase()] || TOOL_PHRASES.default;
    return phrases[Math.floor(Math.random() * phrases.length)];
  });

  const toggle = () => {
    const next = !expanded;
    setExpanded(next);
    expandStates.set(cardKey, next);
  };

  useEffect(() => {
    if (isRunning) {
      setExpanded(true);
      expandStates.set(cardKey, true);
    }
  }, [isRunning]);

  useEffect(() => {
    if (state === "done" || state === "error") {
      const t = setTimeout(() => {
        setExpanded(false);
        expandStates.set(cardKey, false);
      }, 2500);
      return () => clearTimeout(t);
    }
  }, [state]);

  const headerLabel = isRunning
    ? phrase
    : isError
      ? "Error"
      : toolName.charAt(0).toUpperCase() + toolName.slice(1).toLowerCase();

  return (
    <div
      className="rounded-xl bg-[rgba(5,4,2,0.45)] overflow-hidden mb-1.5"
      style={{
        border: "1px solid rgba(199,159,74,0.15)",
        borderLeft: `2px solid ${color}`,
      }}
    >
      <button
        onClick={toggle}
        className="flex items-center gap-2 px-3 py-2.5 cursor-pointer hover:bg-[var(--fintheon-accent)]/5 transition-colors w-full text-left"
      >
        {isRunning && <BrailleSpinner size={8} gap={2} />}
        {isDone && (
          <Check size={13} className="text-green-500 flex-shrink-0" />
        )}
        {isError && (
          <AlertCircle size={13} className="text-red-500 flex-shrink-0" />
        )}
        <span className="text-xs text-zinc-400 flex-1">{headerLabel}</span>
        {expanded ? (
          <ChevronDown size={13} className="text-gray-500 flex-shrink-0" />
        ) : (
          <ChevronRight size={13} className="text-gray-500 flex-shrink-0" />
        )}
      </button>
      {expanded && output && (
        <div className="border-t border-[var(--fintheon-accent)]/10 px-3 py-2.5 text-[11px] text-zinc-400 font-mono whitespace-pre-wrap overflow-x-auto max-h-[200px] overflow-y-auto">
          <RichTextRenderer text={output} />
        </div>
      )}
    </div>
  );
}

export function ToolCallPartRenderer({ part, result }: ToolCallPartProps) {
  return <ToolCallCard part={part} result={result} />;
}
