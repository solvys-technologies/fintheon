// [claude-code 2026-04-27] v5.33.3: Catalyst Stats panel — counts every
// catalyst-producing source (last 30 d), grouped by category × polling type.
// Surfaces TP's bulk-handling controls: mass delete by source/category/date,
// blocked-source purge (today-scoped + all-time variants) with audit + confirm, and
// 14-day mass refill across selected sources with tail rate-limit.
//
// Auth: backend admin routes are gated on Supabase JWT + superadmin allow-list
// (SUPER_ADMIN_USER_ID). The panel passes the user's access token via
// Authorization: Bearer <token> automatically — no manual secret paste.
//
// All destructive actions are confirm-gated. The purge audit pass shows a
// candidate list and a sample of up to 20 headlines before TP confirms.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Trash2, Download, ShieldAlert, RefreshCw } from "lucide-react";
import { useToast } from "../../contexts/ToastContext";
import { useAuth } from "../../contexts/AuthContext";

const API_BASE = (
  import.meta.env.VITE_API_URL || "http://localhost:8080"
).replace(/\/$/, "");

interface SourceStat {
  source: string;
  category: string | null;
  polling_type: "social" | "web";
  count: number;
}

interface PurgeAuditResponse {
  confirmed: false;
  scope: "today" | "all" | "range";
  from: string | null;
  to: string | null;
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

interface Props {
  disabled: boolean;
}

export function CatalystStatsPanel({ disabled }: Props) {
  const { addToast } = useToast();
  const { getAccessToken } = useAuth();
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
  const [auditResult, setAuditResult] = useState<PurgeAuditResponse | null>(
    null,
  );
  const [busy, setBusy] = useState<string | null>(null);

  // Build authed headers. Returns null if no token — caller short-circuits.
  const buildHeaders = useCallback(async (): Promise<Record<
    string,
    string
  > | null> => {
    const token = await getAccessToken();
    if (!token) return null;
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
  }, [getAccessToken]);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const headers = await buildHeaders();
      if (!headers) {
        addToast("Sign in required", "info");
        return;
      }
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
  }, [buildHeaders, windowDays, addToast]);

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
      const headers = await buildHeaders();
      if (!headers) return;
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
      const headers = await buildHeaders();
      if (!headers) return;
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
        `Refill ingested ${json.ingested_total ?? 0} item(s) across ${
          json.sources_total ?? 0
        } source(s)`,
        "success",
      );
      await fetchStats();
    } finally {
      setBusy(null);
    }
  };

  const onPurgeAudit = async (scope: "today" | "all") => {
    setBusy("audit");
    try {
      const headers = await buildHeaders();
      if (!headers) return;
      const res = await fetch(`${API_BASE}/api/admin/riskflow/purge`, {
        method: "POST",
        headers,
        body: JSON.stringify({ scope }),
      });
      const json = (await res.json()) as
        | PurgeAuditResponse
        | { error: string; detail?: string };
      if (!res.ok || (json as { error?: string }).error) {
        addToast(
          "Purge audit failed",
          "error",
          (json as { detail?: string }).detail ??
            (json as { error?: string }).error ??
            `${res.status}`,
        );
        return;
      }
      setAuditResult(json as PurgeAuditResponse);
    } finally {
      setBusy(null);
    }
  };

  const onPurgeConfirm = async () => {
    if (!auditResult) return;
    if (
      !window.confirm(
        `Hard-delete ${auditResult.candidate_count} catalyst(s) matching blocked domains or keywords from BOTH scored + raw tables (scope=${auditResult.scope})?`,
      )
    )
      return;
    setBusy("purge");
    try {
      const headers = await buildHeaders();
      if (!headers) return;
      const res = await fetch(`${API_BASE}/api/admin/riskflow/purge`, {
        method: "POST",
        headers,
        body: JSON.stringify({ confirm: true, scope: auditResult.scope }),
      });
      const json = (await res.json()) as {
        scored_deleted?: number;
        raw_deleted?: number;
        error?: string;
        detail?: string;
      };
      if (!res.ok || json.error) {
        addToast(
          "Purge failed",
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

      <div className="flex items-center justify-between gap-2 text-[10px] text-zinc-500 uppercase tracking-wider">
        <span>{loading ? "loading…" : `${stats.length} sources`}</span>
        <button
          onClick={fetchStats}
          disabled={loading}
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
        {grouped.length === 0 && !loading && (
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
            disabled={disabled || busy !== null || selected.size === 0}
            className="inline-flex items-center gap-1 px-2 py-1 border border-red-500/40 text-[11px] text-red-400 hover:bg-red-500/10 disabled:opacity-50"
          >
            <Trash2 className="w-3 h-3" />
            Bulk Delete
          </button>
          <button
            onClick={onRefill}
            disabled={disabled || busy !== null || selected.size === 0}
            className="inline-flex items-center gap-1 px-2 py-1 border border-[var(--fintheon-accent)]/40 text-[11px] text-[var(--fintheon-accent)] hover:bg-[var(--fintheon-accent)]/10 disabled:opacity-50"
          >
            <Download className="w-3 h-3" />
            {busy === "refill" ? "Refilling…" : "Refill 14d"}
          </button>
          <button
            onClick={() => onPurgeAudit("today")}
            disabled={disabled || busy !== null}
            className="inline-flex items-center gap-1 px-2 py-1 border border-amber-500/40 text-[11px] text-amber-400 hover:bg-amber-500/10 disabled:opacity-50"
          >
            <ShieldAlert className="w-3 h-3" />
            {busy === "audit" ? "Auditing…" : "Purge · today"}
          </button>
          <button
            onClick={() => onPurgeAudit("all")}
            disabled={disabled || busy !== null}
            className="inline-flex items-center gap-1 px-2 py-1 border border-amber-500/40 text-[11px] text-amber-400 hover:bg-amber-500/10 disabled:opacity-50"
          >
            <ShieldAlert className="w-3 h-3" />
            Purge · all-time
          </button>
        </div>
      </div>

      {auditResult && (
        <div className="border border-amber-500/40 bg-amber-500/5 p-2 flex flex-col gap-2">
          <div className="text-[11px] text-amber-300">
            {auditResult.candidate_count} candidate(s) match blocked domains or
            keywords (scope = {auditResult.scope}
            {auditResult.from
              ? ` · ${auditResult.from.slice(0, 10)} → ${(auditResult.to ?? "").slice(0, 10)}`
              : ""}
            ). Wire-relay tweets exempt. Top sample below — confirm to
            hard-delete from scored + raw tables.
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
              onClick={onPurgeConfirm}
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
