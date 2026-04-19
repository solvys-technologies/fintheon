// [claude-code 2026-04-19] Routines Console — detail modal with run history + per-mode config.

import { useCallback, useEffect, useState } from "react";
import { CheckCircle, X } from "lucide-react";
import type {
  RoutineConfig,
  RoutineMode,
  RoutineRow,
  RoutineRun,
} from "./RoutinesConsole";

const API_BASE = (
  import.meta.env.VITE_API_URL || "http://localhost:8080"
).replace(/\/$/, "");

interface DetailResponse {
  definition: RoutineRow["definition"];
  config: RoutineConfig;
  runs: RoutineRun[];
  pendingApprovals: Array<{
    id: string;
    title: string;
    payload: Record<string, unknown>;
    createdAt: string;
  }>;
}

interface RoutineDetailModalProps {
  row: RoutineRow;
  onClose: () => void;
  onChanged: () => void;
}

const MODE_LABELS: Record<RoutineMode, string> = {
  infinite: "Infinite",
  awaitReply: "Await Reply",
  completionChecks: "Completion Checks",
  maxTurns: "Max Turns",
};

const STATUS_COLORS: Record<RoutineRun["status"], string> = {
  ok: "text-emerald-400",
  degraded: "text-amber-400",
  failed: "text-red-400",
};

export function RoutineDetailModal({
  row,
  onClose,
  onChanged,
}: RoutineDetailModalProps) {
  const [detail, setDetail] = useState<DetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [maxTurns, setMaxTurns] = useState(row.config.maxTurns);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(
        `${API_BASE}/api/routines/${row.definition.triggerId}`,
      ).then((r) => r.json());
      setDetail(res);
      if (res?.config?.maxTurns) setMaxTurns(res.config.maxTurns);
    } catch (err) {
      console.error("[RoutineDetailModal] fetch failed:", err);
    }
  }, [row.definition.triggerId]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      await refresh();
      if (mounted) setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, [refresh]);

  const saveMaxTurns = async () => {
    setBusy(true);
    try {
      await fetch(`${API_BASE}/api/routines/${row.definition.triggerId}/mode`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: detail?.config.mode ?? row.config.mode,
          maxTurns,
        }),
      });
      await refresh();
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  const resolveApproval = async (id: string, action: "approve" | "deny") => {
    setBusy(true);
    try {
      await fetch(`${API_BASE}/api/routines/approvals/${id}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolvedBy: "desktop-superadmin" }),
      });
      await refresh();
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  const def = detail?.definition ?? row.definition;
  const cfg = detail?.config ?? row.config;
  const runs = detail?.runs ?? [];
  const pending = detail?.pendingApprovals ?? [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-[var(--fintheon-bg)] border border-[var(--fintheon-accent)]/40 rounded-md w-[640px] max-w-[92vw] max-h-[88vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
          <div>
            <div className="text-[10px] text-zinc-500 uppercase tracking-wider">
              {def.kind} · {def.runsPerDay}/day · {def.schedule}
            </div>
            <h3 className="text-sm font-semibold text-[var(--fintheon-text)]">
              {def.name}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-zinc-400 hover:text-[var(--fintheon-accent)]"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto px-4 py-3 space-y-4 text-[11px] text-zinc-300">
          {loading ? (
            <div className="text-zinc-500 animate-pulse">Loading…</div>
          ) : (
            <>
              <p className="text-zinc-400">{def.description}</p>
              {def.replaces && (
                <div className="text-[10px] text-zinc-500">
                  Replaces backend: <code>{def.replaces}</code>
                </div>
              )}
              {def.backendFlag && (
                <div className="text-[10px] text-zinc-500">
                  Env flag: <code>{def.backendFlag}=true</code>
                </div>
              )}

              <section>
                <h4 className="text-[10px] uppercase tracking-wider text-[var(--fintheon-accent)] mb-1.5">
                  Mode
                </h4>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-mono px-2 py-0.5 border border-zinc-700 rounded">
                    {MODE_LABELS[cfg.mode]}
                  </span>
                  {cfg.paused && (
                    <span className="text-[10px] font-mono px-2 py-0.5 border border-zinc-700 rounded text-zinc-500">
                      PAUSED
                    </span>
                  )}
                  {cfg.mode === "maxTurns" && (
                    <div className="flex items-center gap-1.5">
                      <label className="text-[10px] text-zinc-500">
                        max turns
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={10}
                        value={maxTurns}
                        onChange={(e) => setMaxTurns(Number(e.target.value))}
                        className="w-12 bg-transparent border border-zinc-700 rounded px-1.5 py-0.5 text-[10px] text-zinc-200"
                      />
                      <button
                        onClick={saveMaxTurns}
                        disabled={busy}
                        className="text-[10px] px-1.5 py-0.5 border border-[var(--fintheon-accent)]/40 rounded text-[var(--fintheon-accent)] hover:bg-[var(--fintheon-accent)]/10 disabled:opacity-50"
                      >
                        save
                      </button>
                    </div>
                  )}
                </div>
              </section>

              {pending.length > 0 && (
                <section>
                  <h4 className="text-[10px] uppercase tracking-wider text-amber-400 mb-1.5">
                    Pending Approvals ({pending.length})
                  </h4>
                  <div className="space-y-2">
                    {pending.map((p) => (
                      <div
                        key={p.id}
                        className="border border-amber-500/30 rounded p-2 bg-amber-500/5"
                      >
                        <div className="text-[11px] text-zinc-200 mb-1">
                          {p.title}
                        </div>
                        <pre className="text-[9px] text-zinc-500 max-h-24 overflow-auto whitespace-pre-wrap">
                          {JSON.stringify(p.payload, null, 2)}
                        </pre>
                        <div className="flex gap-2 mt-2">
                          <button
                            onClick={() => resolveApproval(p.id, "approve")}
                            disabled={busy}
                            className="text-[10px] px-2 py-0.5 border border-emerald-500/40 rounded text-emerald-400 hover:bg-emerald-500/10 disabled:opacity-50"
                          >
                            <CheckCircle className="w-3 h-3 inline mr-1" />
                            approve
                          </button>
                          <button
                            onClick={() => resolveApproval(p.id, "deny")}
                            disabled={busy}
                            className="text-[10px] px-2 py-0.5 border border-red-500/40 rounded text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                          >
                            deny
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              <section>
                <h4 className="text-[10px] uppercase tracking-wider text-[var(--fintheon-accent)] mb-1.5">
                  Recent runs ({runs.length})
                </h4>
                {runs.length === 0 ? (
                  <div className="text-[10px] text-zinc-500">
                    No runs recorded yet.
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {runs.map((run) => (
                      <div
                        key={run.id}
                        className="border border-zinc-800 rounded px-2 py-1.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={`text-[10px] font-mono uppercase ${STATUS_COLORS[run.status]}`}
                          >
                            {run.status}
                          </span>
                          <span className="text-[9px] text-zinc-500 font-mono">
                            {new Date(run.createdAt).toLocaleString()}
                          </span>
                        </div>
                        <div className="text-[10px] text-zinc-300 mt-0.5">
                          {run.title}
                        </div>
                        {run.detail && (
                          <div className="text-[9px] text-zinc-500 mt-0.5 line-clamp-2">
                            {run.detail}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <div className="text-[9px] text-zinc-600 pt-2 border-t border-zinc-800">
                trigger_id: <code>{def.triggerId}</code>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
