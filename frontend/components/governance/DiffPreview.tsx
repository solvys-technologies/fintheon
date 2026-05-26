import { useState } from "react";

interface DiffPreviewProps {
  before: unknown;
  after: unknown;
  label?: string;
}

interface DiffLine {
  type: "added" | "removed" | "unchanged";
  text: string;
}

function toLines(value: unknown): string[] {
  if (value === null || value === undefined) return ["(empty)"];
  if (typeof value === "string") return value.split("\n");
  return JSON.stringify(value, null, 2).split("\n");
}

function computeDiff(before: string[], after: string[]): DiffLine[] {
  const result: DiffLine[] = [];
  const maxLen = Math.max(before.length, after.length);
  for (let i = 0; i < maxLen; i++) {
    if (i < before.length && i < after.length) {
      if (before[i] === after[i]) {
        result.push({ type: "unchanged", text: before[i] });
      } else {
        result.push({ type: "removed", text: before[i] });
        result.push({ type: "added", text: after[i] });
      }
    } else if (i < before.length) {
      result.push({ type: "removed", text: before[i] });
    } else {
      result.push({ type: "added", text: after[i] });
    }
  }
  return result;
}

const MAX_VISIBLE = 20;

export function DiffPreview({ before, after, label }: DiffPreviewProps) {
  const [expanded, setExpanded] = useState(false);

  const isSame = JSON.stringify(before) === JSON.stringify(after);
  if (isSame) {
    return (
      <div className="text-[#f0ead6]/40 text-xs font-mono py-2 px-3">
        No changes to display
      </div>
    );
  }

  const beforeLines = toLines(before);
  const afterLines = toLines(after);
  const diff = computeDiff(beforeLines, afterLines);
  const isLong = diff.length > MAX_VISIBLE;
  const visible = isLong && !expanded ? diff.slice(0, MAX_VISIBLE) : diff;

  return (
    <div className="rounded border border-[#c79f4a]/20 bg-[#050402]/60 overflow-hidden">
      {label && (
        <div className="px-3 py-1 border-b border-[#c79f4a]/20 text-[#f0ead6]/40 text-xs">
          {label}
        </div>
      )}
      <div className="font-mono text-xs overflow-x-auto">
        {visible.map((line, i) => (
          <div
            key={i}
            className={
              line.type === "added"
                ? "bg-[#c79f4a]/8 text-[#c79f4a] px-3 py-px"
                : line.type === "removed"
                  ? "bg-red-900/20 text-red-400/70 px-3 py-px"
                  : "text-[#f0ead6]/40 px-3 py-px"
            }
          >
            <span className="select-none mr-2 opacity-60">
              {line.type === "added"
                ? "+"
                : line.type === "removed"
                  ? "-"
                  : " "}
            </span>
            {line.text}
          </div>
        ))}
        {isLong && !expanded && (
          <button
            onClick={() => setExpanded(true)}
            className="w-full px-3 py-1.5 text-[#f0ead6]/30 text-xs hover:text-[#c79f4a] transition-colors border-t border-[#c79f4a]/10"
          >
            Show all {diff.length} changes
          </button>
        )}
      </div>
    </div>
  );
}
