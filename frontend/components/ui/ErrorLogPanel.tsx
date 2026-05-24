// [claude-code 2026-03-22] ErrorLogPanel — persistent error log with expandable "More Info" dropdowns

import { useState } from "react";
import { ChevronDown, ChevronRight, Trash2 } from "lucide-react";
import { useErrorLog } from "../../hooks/useErrorLog";
import type { ErrorLogEntry } from "../../lib/errorLog";

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function ErrorRow({ entry }: { entry: ErrorLogEntry }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border-b border-[var(--fintheon-accent)]/10 last:border-b-0">
      {/* Collapsed row */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-[var(--fintheon-accent)]/5 transition-colors"
      >
        {expanded ? (
          <ChevronDown className="w-3 h-3 text-[var(--fintheon-accent)]/50 shrink-0" />
        ) : (
          <ChevronRight className="w-3 h-3 text-[var(--fintheon-accent)]/50 shrink-0" />
        )}

        <span className="text-[10px] text-zinc-500 w-12 shrink-0 font-mono">
          {relativeTime(entry.timestamp)}
        </span>

        {entry.status && (
          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 shrink-0">
            {entry.status}
          </span>
        )}

        <span className="text-[11px] text-[var(--fintheon-text)]/80 truncate">
          {entry.message}
        </span>
      </button>

      {/* Expanded "More Info" */}
      {expanded && (
        <div className="px-3 pb-3 pl-8 space-y-2">
          {entry.endpoint && (
            <div className="text-[10px]">
              <span className="text-zinc-500">Endpoint: </span>
              <span className="text-[var(--fintheon-text)]/60 font-mono">
                {entry.endpoint}
              </span>
            </div>
          )}

          <div className="text-[10px]">
            <span className="text-zinc-500">Code: </span>
            <span className="text-[var(--fintheon-text)]/60 font-mono">
              {entry.code}
            </span>
          </div>

          {entry.status && (
            <div className="text-[10px]">
              <span className="text-zinc-500">HTTP Status: </span>
              <span className="text-red-400 font-mono">{entry.status}</span>
            </div>
          )}

          <div className="text-[10px]">
            <span className="text-zinc-500">Message: </span>
            <span className="text-[var(--fintheon-text)]/70">
              {entry.message}
            </span>
          </div>

          {entry.fix && (
            <div className="text-[10px] px-2 py-1.5 rounded bg-[var(--fintheon-accent)]/8 border border-[var(--fintheon-accent)]/15">
              <span className="text-[var(--fintheon-accent)]">Fix: </span>
              <span className="text-[var(--fintheon-text)]/70">
                {entry.fix}
              </span>
            </div>
          )}

          {entry.stack && (
            <details className="text-[10px]">
              <summary className="text-zinc-500 cursor-pointer hover:text-zinc-400 transition-colors select-none">
                Stack Trace
              </summary>
              <pre className="mt-1 p-2 rounded bg-black/30 border border-zinc-800 text-[9px] text-zinc-400 font-mono whitespace-pre-wrap overflow-x-auto max-h-40 overflow-y-auto">
                {entry.stack}
              </pre>
            </details>
          )}

          <div className="text-[9px] text-zinc-600 font-mono">
            {entry.timestamp}
          </div>
        </div>
      )}
    </div>
  );
}

export function ErrorLogPanel() {
  const { errors, clearErrors } = useErrorLog();

  return (
    <div className="fintheon-rail-surface h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-[var(--fintheon-accent)]/10">
        <span className="text-[10px] text-zinc-500 uppercase tracking-wider">
          Error Log ({errors.length})
        </span>
        {errors.length > 0 && (
          <button
            type="button"
            onClick={clearErrors}
            className="flex items-center gap-1 text-[10px] text-zinc-600 hover:text-red-400 transition-colors"
            title="Clear all errors"
          >
            <Trash2 className="w-3 h-3" />
            <span>Clear</span>
          </button>
        )}
      </div>

      {/* Error list */}
      <div className="flex-1 overflow-y-auto">
        {errors.length === 0 ? (
          <div className="flex items-center justify-center h-full text-[11px] text-zinc-600">
            No errors recorded
          </div>
        ) : (
          errors.map((entry) => <ErrorRow key={entry.id} entry={entry} />)
        )}
      </div>
    </div>
  );
}
