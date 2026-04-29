// [claude-code 2026-04-27] v5.33.4: Catalyst Stats drawer — slide-in side
// panel that mirrors the ChatPanel popover behaviour (absolute right-0,
// w-[420px], translate-x animation). Replaces the always-visible right
// rail in the Refinement Engine; only opens via the top-right button in
// the RE header.
//
// Body layout per TP:
//   - Per-category aggregate rows (category name + total catalysts that
//     match the wire-handle / web-host classification, right-aligned).
//   - Per-source ruler-divided rows under each category, source label
//     left + count right-aligned.
//   - Bulk-handling controls below: bulk delete, 14d refill, MSM Audit
//     (today + all-time variants).
//
// Auth: backend admin routes are gated on Supabase JWT + superadmin
// allow-list (SUPER_ADMIN_USER_ID env or DB role='admin'). The drawer
// passes the user's access token via Authorization: Bearer automatically.

import { useCallback, useEffect, useMemo, useState } from "react";
import { X, RefreshCw, Trash2, Download, ShieldAlert } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";

const API_BASE = (
  import.meta.env.VITE_API_URL || "http://localhost:8080"
).replace(/\/$/, "");

interface SourceStat {
  source: string;
  category: string | null;
  polling_type: "social" | "web";
  count: number;
}

interface MsmAuditResponse {
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
  open: boolean;
  onClose: () => void;
  disabled: boolean;
}

const RULER_STYLE: React.CSSProperties = {
  height: 1,
  background:
    "linear-gradient(to right, transparent 0%, color-mix(in srgb, var(--fintheon-accent) 32%, transparent) 50%, transparent 100%)",
};

export function CatalystStatsDrawer({ open, onClose, disabled }: Props) {
  const { addToast } = useToast();
  const { getAccessToken } = useAuth();
  const [stats, setStats] = useState<SourceStat[]>([]);
  const [loading, setLoading] = useState(false);
  const [windowDays] = useState(30);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [refillFromDate, setRefillFromDate] = useState<string>(() =>
    new Date(Date.now() - 14 * 86_400_000).toISOString().slice(0, 10),
  );
  const [refillToDate, setRefillToDate] = useState<string>(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [auditResult, setAuditResult] = useState<MsmAuditResponse | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

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

  // Pull on first open + whenever the drawer is reopened.
  useEffect(() => {
    if (open) void fetchStats();
  }, [open, fetchStats]);

  // Group sources by category for the aggregate display.
  const grouped = useMemo(() => {
    const out = new Map<
      string,
      {
        aggregate: number;
        sources: SourceStat[];
        pollingType: "social" | "web";
      }
    >();
    for (const stat of stats) {
      const key = `${stat.category ?? "Web/Gov"}`;
      const entry = out.get(key) ?? {
        aggregate: 0,
        sources: [],
        pollingType: stat.polling_type,
      };
      entry.aggregate += stat.count;
      entry.sources.push(stat);
      out.set(key, entry);
    }
    for (const entry of out.values()) {
      entry.sources.sort((a, b) => b.count - a.count);
    }
    return Array.from(out.entries()).sort(
      (a, b) => b[1].aggregate - a[1].aggregate,
    );
  }, [stats]);

  const totalCount = stats.reduce((sum, s) => sum + s.count, 0);

  // [claude-code 2026-04-28] S48-T3: web-only sources filtered for dedicated section
  const webSources = useMemo(
    () => stats.filter((s) => s.polling_type === "web"),
    [stats],
  );

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

  const onMsmAudit = async (scope: "today" | "all") => {
    setBusy("audit");
    try {
      const headers = await buildHeaders();
      if (!headers) return;
      const res = await fetch(`${API_BASE}/api/admin/riskflow/msm-purge`, {
        method: "POST",
        headers,
        body: JSON.stringify({ scope }),
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
        `Hard-delete ${auditResult.candidate_count} catalyst(s) matching mainstream-media patterns (scope=${auditResult.scope})?`,
      )
    )
      return;
    setBusy("purge");
    try {
      const headers = await buildHeaders();
      if (!headers) return;
      const res = await fetch(`${API_BASE}/api/admin/riskflow/msm-purge`, {
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

  return (
    <div
      className={`absolute right-0 top-0 bottom-0 w-[420px] z-40 flex flex-col bg-[var(--fintheon-bg)] border-l border-[var(--fintheon-accent)]/20 shadow-2xl transition-all duration-300 ease-in-out ${open ? "translate-x-0 opacity-100" : "translate-x-full opacity-0 pointer-events-none invisible"}`}
    >
      {/* Header — title + refresh + close, mirrors ChatPanel chrome density */}
      <div className="flex items-center justify-between px-3 py-2 flex-shrink-0 border-b border-[var(--fintheon-accent)]/15">
        <div className="flex items-center gap-2">
          <span
            className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--fintheon-accent)]"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Catalyst Stats
          </span>
          <span className="text-[10px] text-zinc-500">
            last {windowDays}d ·{" "}
            <span className="text-[var(--fintheon-accent)] tabular-nums">
              {totalCount}
            </span>{" "}
            · {stats.length} sources
          </span>
        </div>
        <div className="flex items-center gap-0.5">
          <button
            onClick={fetchStats}
            disabled={loading}
            className="p-1.5 rounded-md text-zinc-600 hover:text-[var(--fintheon-accent)] hover:bg-[var(--fintheon-accent)]/8 transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}
            />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-zinc-600 hover:text-[var(--fintheon-accent)] hover:bg-[var(--fintheon-accent)]/8 transition-colors"
            title="Close"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3 flex flex-col gap-4">
        {/* Polling breakdown — category aggregates + per-source ruler rows */}
        <div className="flex flex-col">
          {grouped.length === 0 && !loading && (
            <div className="text-center py-8 text-[11px] text-zinc-600">
              No catalysts in window.
            </div>
          )}
          {grouped.map(([cat, entry]) => (
            <div key={cat} className="flex flex-col">
              <div aria-hidden="true" style={RULER_STYLE} />
              {/* Category aggregate row */}
              <div className="flex items-baseline justify-between py-2">
                <div className="flex flex-col">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--fintheon-accent)]">
                    {cat}
                  </span>
                  <span className="text-[9px] uppercase tracking-wider text-zinc-600">
                    {entry.pollingType === "social" ? "social" : "web"} ·{" "}
                    {entry.sources.length} source
                    {entry.sources.length === 1 ? "" : "s"}
                  </span>
                </div>
                <span
                  className="text-[var(--fintheon-accent)] tabular-nums text-right"
                  style={{
                    fontFamily: "Doto, ui-monospace, monospace",
                    fontSize: 18,
                    letterSpacing: "0.02em",
                  }}
                >
                  {entry.aggregate}
                </span>
              </div>
              {/* Source rows — ruler divided */}
              {entry.sources.map((stat) => (
                <div key={stat.source} className="flex flex-col">
                  <div aria-hidden="true" style={RULER_STYLE} />
                  <label className="flex items-center gap-2 px-1 py-1.5 text-[11px] cursor-pointer hover:bg-[var(--fintheon-accent)]/5">
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
                    <span className="tabular-nums text-zinc-300 text-right">
                      {stat.count}
                    </span>
                  </label>
                </div>
              ))}
            </div>
          ))}
          {grouped.length > 0 && <div aria-hidden="true" style={RULER_STYLE} />}
        </div>

        {/* [claude-code 2026-04-28] S48-T3: Web URL source section — filtered to polling_type: "web" */}
        <div
          style={{
            marginTop: 24,
            paddingTop: 12,
            borderTop: "1px solid var(--fintheon-glass-border)",
          }}
        >
          <h3
            style={{
              fontFamily: "var(--font-heading)",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "var(--fintheon-accent)",
              marginBottom: 6,
            }}
          >
            WEB SOURCES
          </h3>
          {webSources.length === 0 ? (
            <p
              style={{
                fontSize: 10,
                color: "var(--fintheon-muted)",
                fontFamily: "var(--font-body)",
              }}
            >
              No web sources ingested in this window
            </p>
          ) : (
            <div className="flex flex-col">
              {webSources.map((s) => (
                <div
                  key={s.source}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "2px 4px",
                    borderBottom:
                      "1px solid color-mix(in srgb, var(--fintheon-accent) 4%, transparent)",
                  }}
                >
                  <span
                    style={{
                      fontSize: 10,
                      color: "var(--fintheon-text)",
                      fontFamily: "var(--font-mono)",
                      flex: 1,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {s.source}
                  </span>
                  <span
                    style={{
                      fontSize: 10,
                      fontFamily: "var(--font-data)",
                      color: "var(--fintheon-muted)",
                      flexShrink: 0,
                      marginLeft: 8,
                    }}
                  >
                    {s.count}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Bulk handling */}
        <div className="flex flex-col gap-2">
          <div aria-hidden="true" style={RULER_STYLE} />
          <div className="text-[10px] uppercase tracking-wider text-[var(--fintheon-accent)] pt-1">
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
              onClick={() => onMsmAudit("today")}
              disabled={disabled || busy !== null}
              className="inline-flex items-center gap-1 px-2 py-1 border border-amber-500/40 text-[11px] text-amber-400 hover:bg-amber-500/10 disabled:opacity-50"
            >
              <ShieldAlert className="w-3 h-3" />
              {busy === "audit" ? "Auditing…" : "MSM · today"}
            </button>
            <button
              onClick={() => onMsmAudit("all")}
              disabled={disabled || busy !== null}
              className="inline-flex items-center gap-1 px-2 py-1 border border-amber-500/40 text-[11px] text-amber-400 hover:bg-amber-500/10 disabled:opacity-50"
            >
              <ShieldAlert className="w-3 h-3" />
              MSM · all-time
            </button>
          </div>
        </div>

        {/* Audit candidates */}
        {auditResult && (
          <div className="border border-amber-500/40 bg-amber-500/5 p-2 flex flex-col gap-2">
            <div className="text-[11px] text-amber-300">
              {auditResult.candidate_count} candidate(s) (scope ={" "}
              {auditResult.scope}
              {auditResult.from
                ? ` · ${auditResult.from.slice(0, 10)} → ${(auditResult.to ?? "").slice(0, 10)}`
                : ""}
              ). Wire-relay tweets exempt. Confirm to hard-delete.
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
    </div>
  );
}
