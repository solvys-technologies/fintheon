// [claude-code 2026-04-19] Routines Console — operator surface for the 8 Claude Code Routines.
// Drops loopndroll-style mode controls (Infinite | Await Reply | Completion Checks | Max Turns)
// onto the Refinement Engine left panel. Detail modal exposes recent runs + per-mode config.

import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  ChevronRight,
  Pause,
  Play,
  RefreshCw,
} from "lucide-react";
import { RoutineDetailModal } from "./RoutineDetailModal";

const API_BASE = (
  import.meta.env.VITE_API_URL || "http://localhost:8080"
).replace(/\/$/, "");

export type RoutineMode =
  | "infinite"
  | "awaitReply"
  | "completionChecks"
  | "maxTurns";

export interface RoutineDefinition {
  triggerId: string;
  name: string;
  kind: "MOVE" | "AUGMENT";
  schedule: string;
  runsPerDay: number;
  description: string;
  backendFlag?: string;
  replaces?: string;
}

export interface RoutineConfig {
  triggerId: string;
  mode: RoutineMode;
  maxTurns: number;
  paused: boolean;
  notes: string | null;
  updatedAt: string;
  updatedBy: string;
}

export interface RoutineRun {
  id: string;
  triggerId: string;
  status: "ok" | "degraded" | "failed";
  severity: "info" | "warning" | "critical";
  title: string;
  detail: string | null;
  opsEntryId: string | null;
  turnCount: number;
  errorMessage: string | null;
  createdAt: string;
}

export interface RoutineRow {
  definition: RoutineDefinition;
  config: RoutineConfig;
  latestRun: RoutineRun | null;
  pendingApprovals: number;
}

const MODE_LABELS: Record<RoutineMode, string> = {
  infinite: "Infinite",
  awaitReply: "Await Reply",
  completionChecks: "Completion Checks",
  maxTurns: "Max Turns",
};

function statusChip(row: RoutineRow): {
  label: string;
  cls: string;
  Icon: typeof Activity;
} {
  if (row.config.paused) {
    return {
      label: "PAUSED",
      cls: "text-zinc-500 border-zinc-700",
      Icon: Pause,
    };
  }
  if (row.pendingApprovals > 0) {
    return {
      label: `AWAIT (${row.pendingApprovals})`,
      cls: "text-amber-400 border-amber-500/40",
      Icon: AlertTriangle,
    };
  }
  const status = row.latestRun?.status ?? null;
  if (status === "failed") {
    return {
      label: "FAILED",
      cls: "text-red-400 border-red-500/40",
      Icon: AlertTriangle,
    };
  }
  if (status === "degraded") {
    return {
      label: "DEGRADED",
      cls: "text-amber-400 border-amber-500/40",
      Icon: AlertTriangle,
    };
  }
  if (status === "ok") {
    return {
      label: "OK",
      cls: "text-emerald-400 border-emerald-500/40",
      Icon: CheckCircle,
    };
  }
  return {
    label: "IDLE",
    cls: "text-zinc-500 border-zinc-700",
    Icon: Activity,
  };
}

function relativeTime(iso: string | null | undefined): string {
  if (!iso) return "never";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) return "just now";
  const m = Math.floor(ms / 60_000);
  if (m < 1) return "<1m ago";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export function RoutinesConsole() {
  const [rows, setRows] = useState<RoutineRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const fetchRows = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/routines`).then((r) => r.json());
      setRows(res.routines ?? []);
    } catch (err) {
      console.error("[RoutinesConsole] fetch failed:", err);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      await fetchRows();
      if (mounted) setLoading(false);
    })();
    const interval = setInterval(fetchRows, 30_000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [fetchRows]);

  const setMode = async (triggerId: string, mode: RoutineMode) => {
    setBusyId(triggerId);
    try {
      await fetch(`${API_BASE}/api/routines/${triggerId}/mode`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      await fetchRows();
    } finally {
      setBusyId(null);
    }
  };

  const togglePause = async (triggerId: string) => {
    setBusyId(triggerId);
    try {
      await fetch(`${API_BASE}/api/routines/${triggerId}/pause`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      await fetchRows();
    } finally {
      setBusyId(null);
    }
  };

  const rerun = async (triggerId: string) => {
    setBusyId(triggerId);
    try {
      await fetch(`${API_BASE}/api/routines/${triggerId}/rerun`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      await fetchRows();
    } finally {
      setBusyId(null);
    }
  };

  const opened = openId
    ? rows.find((r) => r.definition.triggerId === openId)
    : null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-[11px] font-semibold tracking-wider text-[var(--fintheon-accent)]">
          ROUTINES
        </h2>
        <button
          onClick={fetchRows}
          className="text-[10px] text-zinc-500 hover:text-[var(--fintheon-accent)] transition-colors"
          aria-label="Refresh routines"
        >
          <RefreshCw className="w-3 h-3" />
        </button>
      </div>

      {loading ? (
        <div className="text-[10px] text-zinc-500 animate-pulse py-2">
          Loading routines…
        </div>
      ) : rows.length === 0 ? (
        <div className="text-[10px] text-zinc-600 py-2">
          No routines registered.
        </div>
      ) : (
        <div className="space-y-1.5">
          {rows.map((row) => {
            const def = row.definition;
            const chip = statusChip(row);
            const Icon = chip.Icon;
            const busy = busyId === def.triggerId;
            return (
              <div
                key={def.triggerId}
                className="border border-zinc-800 rounded p-2 hover:border-[var(--fintheon-accent)]/30 transition-colors"
              >
                <button
                  className="w-full flex items-center justify-between gap-2 text-left"
                  onClick={() => setOpenId(def.triggerId)}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Icon
                      className={`w-3 h-3 shrink-0 ${chip.cls.split(" ")[0]}`}
                    />
                    <span className="text-[11px] text-[var(--fintheon-text)] truncate">
                      {def.name}
                    </span>
                  </div>
                  <ChevronRight className="w-3 h-3 text-zinc-600" />
                </button>

                <div className="flex items-center justify-between mt-1.5 gap-2">
                  <span
                    className={`text-[9px] font-mono px-1.5 py-0.5 border rounded ${chip.cls}`}
                  >
                    {chip.label}
                  </span>
                  <span className="text-[9px] text-zinc-500 font-mono">
                    {relativeTime(row.latestRun?.createdAt)}
                  </span>
                </div>

                <div className="flex items-center gap-1 mt-1.5">
                  <select
                    value={row.config.mode}
                    onChange={(e) =>
                      setMode(def.triggerId, e.target.value as RoutineMode)
                    }
                    disabled={busy}
                    className="flex-1 bg-transparent border border-zinc-800 rounded text-[10px] text-zinc-300 px-1 py-0.5 disabled:opacity-50"
                  >
                    {(Object.keys(MODE_LABELS) as RoutineMode[]).map((m) => (
                      <option key={m} value={m} className="bg-zinc-900">
                        {MODE_LABELS[m]}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => togglePause(def.triggerId)}
                    disabled={busy}
                    className="p-1 border border-zinc-800 rounded hover:border-[var(--fintheon-accent)]/40 disabled:opacity-50"
                    title={row.config.paused ? "Resume" : "Pause"}
                  >
                    {row.config.paused ? (
                      <Play className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <Pause className="w-3 h-3 text-zinc-400" />
                    )}
                  </button>
                  <button
                    onClick={() => rerun(def.triggerId)}
                    disabled={busy}
                    className="p-1 border border-zinc-800 rounded hover:border-[var(--fintheon-accent)]/40 disabled:opacity-50"
                    title="Manual rerun"
                  >
                    <RefreshCw className="w-3 h-3 text-zinc-400" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {opened && (
        <RoutineDetailModal
          row={opened}
          onClose={() => setOpenId(null)}
          onChanged={fetchRows}
        />
      )}
    </div>
  );
}
