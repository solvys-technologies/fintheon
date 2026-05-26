// [claude-code 2026-03-16] Hermes Command Center: activity log sub-component
import { useState, useEffect, useRef, useCallback } from "react";

export interface ActivityLogEntry {
  id: string;
  timestamp: string;
  agentRouted: string;
  intentDetected: string;
  preview: string;
}

interface HermesActivityLogProps {
  entries: ActivityLogEntry[];
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

export function HermesActivityLog({ entries }: HermesActivityLogProps) {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [entries.length]);

  if (entries.length === 0) {
    return (
      <div className="flex h-full items-center justify-end text-right text-[11px] text-zinc-600">
        No activity yet. Send a message to begin.
      </div>
    );
  }

  return (
    <div
      ref={listRef}
      className="overflow-y-auto h-full space-y-1 pr-1 text-right"
    >
      {entries.map((entry) => (
        <div
          key={entry.id}
          className="flex items-start justify-between gap-3 px-3 py-2"
        >
          <span className="text-[10px] text-zinc-500 font-mono whitespace-nowrap mt-0.5">
            {formatTime(entry.timestamp)}
          </span>
          <div className="min-w-0 flex-1 text-right">
            <div className="flex items-center justify-end gap-2">
              <span className="text-[11px] font-semibold text-[var(--fintheon-accent)]">
                {entry.agentRouted}
              </span>
              <span className="text-[10px] text-zinc-500">
                {entry.intentDetected}
              </span>
            </div>
            <p className="truncate text-right text-[10px] text-zinc-500">
              {entry.preview}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

// Hook to track activity from chat messages
export function useActivityLog() {
  const [entries, setEntries] = useState<ActivityLogEntry[]>([]);

  const logActivity = useCallback(
    (agentRouted: string, intentDetected: string, preview: string) => {
      setEntries((prev) => {
        const next = [
          ...prev,
          {
            id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            timestamp: new Date().toISOString(),
            agentRouted,
            intentDetected,
            preview: preview.slice(0, 120),
          },
        ];
        // Keep last 10
        return next.slice(-10);
      });
    },
    [],
  );

  return { entries, logActivity };
}
