// [claude-code 2026-04-27] S46.4: Catalyst Stats panel — counts every
// catalyst-producing source (last 30 d), grouped by category × polling type.
// Surfaces TP's bulk-handling controls: mass delete by source/category/date,
// MSM purge audit + confirm, and the 14-day mass refill across selected
// sources with tail rate-limit. Backend routes require the ROUTINE_SECRET
// header — TP enters it once into the panel and we persist in localStorage.
//
// All destructive actions are confirm-gated. Refill prompts for sources +
// from-date; the audit pass runs first and TP must confirm the candidate
// list before any rows are deleted.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Trash2, Download, ShieldAlert, RefreshCw } from "lucide-react";
import { useToast } from "../../contexts/ToastContext";

const API_BASE = (
  import.meta.env.VITE_API_URL || "http://localhost:8080"
).replace(/\/$/, "");
const SECRET_LS_KEY = "fintheon-routine-secret";

interface SourceStat {
  source: string;
  category: string | null;
  polling_type: "social" | "web";
  count: number;
}

interface MsmAuditResponse {
  confirmed: false;
  candidate_count: number;
  sample: Array<{
    id: string;
    headline: string;
    source_domain: string | null;
    published_at: string | null;
    url: string | null;
  }>;
  needles: string[];
}

function loadSecret(): string {
  return localStorage.getItem(SECRET_LS_KEY) ?? "";
}

function saveSecret(value: string): void {
  if (value) localStorage.setItem(SECRET_LS_KEY, value);
  else localStorage.removeItem(SECRET_LS_KEY);
}

interface Props {
  disabled: boolean;
}

export function CatalystStatsPanel({ disabled }: Props) {
  const { addToast } = useToast();
  const [secret, setSecret] = useState<string>(() => loadSecret());
  const [showSecret, setShowSecret] = useState(false);
  const [stats, setStats] = useState<SourceStat[]>([]);
  const [loading, setLoading] = useState(false);
  const [windowDays] = useState(30);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [refillFromDate, setRefillFromDate] = useState<string>(() => {
    const d = new Date(Date.now() - 14 * 86_400_000);
    return d.toISOString().slice(0, 10);
  });
  const [refillToDate, setRefillToDate] = useState<string>(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [auditResult, setAuditResult] = useState<MsmAuditResponse | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const headers = useMemo<Record<string, string>>(
    () => ({
      "Content-Type": "application/json",
      "x-routine-secret": secret,
    }),
    [secret],
  );

  const fetchStats = useCallback(async () => {
    if (!secret) return;
    setLoading(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/admin/riskflow/source-stats?days=${windowDays}`,
        { headers },
      );
      if (!res.ok) {
        const detail = await res.text();
        addToast(
          `Source stats failed (${res.status})`,
          "error",
          detail.slice(0, 200),
        );
        return;
      }
      const json = (await res.json()) as { stats: SourceStat[] };
      setStats(json.stats ?? []);
    } catch (err) {
      addToast(
        "Source stats failed",
        "error",
        err instanceof Error ? err.message : String(err),
      );
    } finally {
      setLoading(false);
    }
  }, [secret, headers, windowDays, addToast]);

  useEffect(() => {
    void fetchStats();
  }, [fetchStats]);

  const grouped = useMemo(() => {
    const out = new Map<string, SourceStat[]>();
    for (const stat of stats) {
      const key = `${stat.category ?? "Web/Gov"} · ${stat.polling_type}`;
      const list = out.get(key) ?? [];
      list.push(stat);
      out.set(key, list);
    }
    for (const list of out.values()) list.sort((a, b) => b.count - a.count);
    return Array.from(out.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [stats]);

  const toggleSource = (source: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(source)) next.delete(source);
      else next.add(source);
      return next;
    });
  };

  const onSecretSave = () => {
    saveSecret(secret);
    addToast("Routine secret saved", "success");
    void fetchStats();
  };

  const onBulkDelete = async () => {
    if (selected.size === 0) {
      addToast("Pick at least one source first", "info");
      return;
    }
    const sources = Array.from(selected);
    if (
      !window.confirm(
        `Delete every catalyst from ${sources.length} source(s) between ${refillFromDate} and ${refillToDate}? This is permanent.`,
      )
    )
      return;
    setBusy("delete");
    try {
      const res = await fetch(`${API_BASE}/api/admin/riskflow/bulk-delete`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          sources,
          from: refillFromDate,
          to: refillToDate,
        }),
      });
      const json = (await res.json()) as {
        scored_deleted?: number;
        raw_deleted?: number;
        error?: string;
        detail?: string;
      };
      if (!res.ok || json.error) {
        addToast(
          "Bulk delete failed",
          "error",
          json.detail ?? json.error ?? `${res.status}`,
        );
        return;
      }
      addToast(
        `Deleted ${json.scored_deleted ?? 0} scored + ${json.raw_deleted ?? 0} raw`,
        "success",
      );
      await fetchStats();
    } finally {
      setBusy(null);
    }
  };

  const onRefill = async () => {
    if (selected.size === 0) {
      addToast("Pick at least one source first", "info");
      return;
    }
    setBusy("refill");
    try {
      const res = await fetch(`${API_BASE}/api/admin/riskflow/refill`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          sources: Array.from(selected),
          from: refillFromDate,
          to: refillToDate,
          tail_handle_ms: 1500,
          tail_cycle_ms: 5000,
        }),
      });
      const json = (await res.json()) as {
        ingested_total?: number;
        sources_total?: number;
        error?: string;
        detail?: string;
      };
      if (!res.ok || json.error) {
        addToast(
          "Refill failed",
          "error",
          json.detail ?? json.error ?? `${res.status}`,
        );
        return;
      }
      addToast(
        `Refill ingested ${json.ingested_total ?? 0} item(s) across ${json.sources_total ?? 0} source(s)`,
        "success",
      );
      await fetchStats();
    } finally {
      setBusy(null);
    }
  };

  const onMsmAudit = async () => {
    setBusy("audit");
    try {
      const res = await fetch(`${API_BASE}/api/admin/riskflow/msm-purge`, {
        method: "POST",
        headers,
        body: JSON.stringify({}),
      });
      const json = (await res.json()) as
        | MsmAuditResponse
        | { error: string; detail?: string };
      if (!res.ok || (json as { error?: string }).error) {
        addToast(
          "MSM audit failed",
          "error",
          (json as { detail?: string }).detail ??
            (json as { error?: string }).error ??
            `${res.status}`,
        );
        return;
      }
      setAuditResult(json as MsmAuditResponse);
    } finally {
      setBusy(null);
    }
  };

  const onMsmConfirm = async () => {
    if (!auditResult) return;
    if (
      !window.confirm(
        `Hard-delete ${auditResult.candidate_count} catalyst(s) matching mainstream-media patterns from BOTH scored + raw tables?`,
      )
    )
      return;
    setBusy("purge");
    try {
      const res = await fetch(`${API_BASE}/api/admin/riskflow/msm-purge`, {
        method: "POST",
        headers,
        body: JSON.stringify({ confirm: true }),
      });
      const json = (await res.json()) as {
        scored_deleted?: number;
        raw_deleted?: number;
        error?: string;
        detail?: string;
      };
      if (!res.ok || json.error) {
        addToast(
          "MSM purge failed",
          "error",
          json.detail ?? json.error ?? `${res.status}`,
        );
        return;
      }
      addToast(
        `Purged ${json.scored_deleted ?? 0} scored + ${json.raw_deleted ?? 0} raw rows`,
        "success",
      );
      setAuditResult(null);
      await fetchStats();
    } finally {
      setBusy(null);
    }
  };

  const totalCount = stats.reduce((sum, s) => sum + s.count, 0);

  return (
    <div className="flex flex-col gap-3">
      <div
        style={{
          fontFamily: "var(--font-data)",
          fontSize: 10,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "var(--fintheon-muted)",
        }}
      >
        Catalyst Stats · last {windowDays}d ·{" "}
        <span className="text-[var(--fintheon-accent)] tabular-nums">
          {totalCount}
        </span>{" "}
        catalysts · {stats.length} sources
      </div>

      {!secret && (
        <div className="border border-dashed border-[var(--fintheon-accent)]/40 px-3 py-2 text-[11px] text-[var(--fintheon-muted)]">
          Paste ROUTINE_SECRET to enable Catalyst Stats + bulk handling.
        </div>
      )}
      <div className="flex items-center gap-2">
        <input
          type={showSecret ? "text" : "password"}
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          placeholder="ROUTINE_SECRET"
          disabled={disabled}
          className="flex-1 bg-transparent border border-[var(--fintheon-glass-border)] px-2 py-1 text-[11px] font-mono text-[var(--fintheon-text)] placeholder:text-zinc-700 focus:outline-none focus:border-[var(--fintheon-accent)]/60"
        />
        <button
          onClick={() => setShowSecret((v) => !v)}
          className="text-[10px] uppercase tracking-wider text-zinc-500 hover:text-[var(--fintheon-accent)]"
        >
          {showSecret ? "Hide" : "Show"}
        </button>
        <button
          onClick={onSecretSave}
          disabled={disabled}
          className="text-[10px] uppercase tracking-wider px-2 py-1 border border-[var(--fintheon-accent)]/40 text-[var(--fintheon-accent)] disabled:opacity-50"
        >
          Save
        </button>
      </div>

      <div className="flex items-center justify-between gap-2 text-[10px] text-zinc-500 uppercase tracking-wider">
        <span>{loading ? "loading…" : `${stats.length} sources`}</span>
        <button
          onClick={fetchStats}
          disabled={!secret || loading}
          className="inline-flex items-center gap-1 hover:text-[var(--fintheon-accent)]"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      <div className="flex flex-col gap-2 max-h-[40vh] overflow-y-auto pr-1">
        {grouped.map(([group, list]) => (
          <div
            key={group}
            className="border border-[var(--fintheon-glass-border)] bg-black/20"
          >
            <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-[var(--fintheon-accent)] border-b border-[var(--fintheon-glass-border)]">
              {group}
            </div>
            <ul className="divide-y divide-[var(--fintheon-glass-border)]">
              {list.map((stat) => (
                <li
                  key={stat.source}
                  className="flex items-center gap-2 px-2 py-1 text-[11px]"
                >
                  <input
                    type="checkbox"
                    disabled={disabled}
                    checked={selected.has(stat.source)}
                    onChange={() => toggleSource(stat.source)}
                    className="accent-[var(--fintheon-accent)]"
                  />
                  <span className="flex-1 truncate text-zinc-300 font-mono">
                    {stat.source.replace(/^twitter:/, "@")}
                  </span>
                  <span className="tabular-nums text-[var(--fintheon-accent)]">
                    {stat.count}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
        {grouped.length === 0 && !loading && secret && (
          <div className="text-center py-8 text-[11px] text-zinc-600">
            No catalysts in window.
          </div>
        )}
      </div>

      <div className="border-t border-[var(--fintheon-glass-border)] pt-2 flex flex-col gap-2">
        <div className="text-[10px] uppercase tracking-wider text-[var(--fintheon-accent)]">
          Bulk Handling
        </div>
        <div className="flex items-center gap-2 text-[11px]">
          <label className="text-zinc-500">From</label>
          <input
            type="date"
            value={refillFromDate}
            onChange={(e) => setRefillFromDate(e.target.value)}
            disabled={disabled}
            className="bg-transparent border border-[var(--fintheon-glass-border)] px-1 py-0.5 text-[11px] text-zinc-300"
          />
          <label className="text-zinc-500">To</label>
          <input
            type="date"
            value={refillToDate}
            onChange={(e) => setRefillToDate(e.target.value)}
            disabled={disabled}
            className="bg-transparent border border-[var(--fintheon-glass-border)] px-1 py-0.5 text-[11px] text-zinc-300"
          />
        </div>
        <div className="text-[10px] text-zinc-500">
          {selected.size} source(s) selected
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={onBulkDelete}
            disabled={
              disabled || !secret || busy !== null || selected.size === 0
            }
            className="inline-flex items-center gap-1 px-2 py-1 border border-red-500/40 text-[11px] text-red-400 hover:bg-red-500/10 disabled:opacity-50"
          >
            <Trash2 className="w-3 h-3" />
            Bulk Delete
          </button>
          <button
            onClick={onRefill}
            disabled={
              disabled || !secret || busy !== null || selected.size === 0
            }
            className="inline-flex items-center gap-1 px-2 py-1 border border-[var(--fintheon-accent)]/40 text-[11px] text-[var(--fintheon-accent)] hover:bg-[var(--fintheon-accent)]/10 disabled:opacity-50"
          >
            <Download className="w-3 h-3" />
            {busy === "refill" ? "Refilling…" : "Refill 14d"}
          </button>
          <button
            onClick={onMsmAudit}
            disabled={disabled || !secret || busy !== null}
            className="inline-flex items-center gap-1 px-2 py-1 border border-amber-500/40 text-[11px] text-amber-400 hover:bg-amber-500/10 disabled:opacity-50"
          >
            <ShieldAlert className="w-3 h-3" />
            {busy === "audit" ? "Auditing…" : "MSM Audit"}
          </button>
        </div>
      </div>

      {auditResult && (
        <div className="border border-amber-500/40 bg-amber-500/5 p-2 flex flex-col gap-2">
          <div className="text-[11px] text-amber-300">
            {auditResult.candidate_count} candidate(s) match MSM patterns. Top
            sample below — confirm to hard-delete from scored + raw tables.
          </div>
          <ul className="max-h-[180px] overflow-y-auto text-[10px] text-zinc-400 font-mono divide-y divide-amber-500/10">
            {auditResult.sample.map((row) => (
              <li key={row.id} className="py-1">
                <div className="truncate text-zinc-300">{row.headline}</div>
                <div className="text-zinc-600">
                  {row.source_domain ?? "?"} ·{" "}
                  {row.published_at?.slice(0, 10) ?? "?"}
                </div>
              </li>
            ))}
          </ul>
          <div className="flex items-center gap-2">
            <button
              onClick={onMsmConfirm}
              disabled={busy !== null}
              className="px-2 py-1 border border-red-500/40 text-[11px] text-red-400 hover:bg-red-500/10 disabled:opacity-50"
            >
              {busy === "purge"
                ? "Purging…"
                : `Confirm purge (${auditResult.candidate_count})`}
            </button>
            <button
              onClick={() => setAuditResult(null)}
              className="px-2 py-1 text-[11px] text-zinc-500 hover:text-zinc-300"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
