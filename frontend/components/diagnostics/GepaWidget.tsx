// [claude-code 2026-04-19] S27-T11 W2e: GEPA self-improvement diagnostics widget.
//   Shows per-agent metric deltas + proposed/merged evolution PR counts.
//   Glassmorphic surface, accent-gold numerics, no gradients.
import React, { useEffect, useState, useCallback } from "react";

interface MetricDelta {
  accuracy: string;
  latency: string;
  cost: string;
}

interface GepaResponse {
  last_run_at: string | null;
  evolutions_proposed_7d: number;
  evolutions_merged_7d: number;
  current_metric_deltas: Record<string, MetricDelta>;
}

const AGENT_LABEL: Record<string, string> = {
  harper: "Harper",
  oracle: "Oracle",
  feucht: "Feucht",
  consul: "Consul",
  herald: "Herald",
};

const AGENT_ORDER = ["harper", "oracle", "feucht", "consul", "herald"];

function timeAgo(iso: string | null): string {
  if (!iso) return "never";
  const diff = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diff)) return "never";
  if (diff < 60_000) return "<1m ago";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

export function GepaWidget() {
  const apiBase = import.meta.env.VITE_API_URL || "http://localhost:8080";
  const [data, setData] = useState<GepaResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [reachable, setReachable] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/api/diagnostics/gepa`);
      const json: GepaResponse = await res.json();
      setData(json);
      setReachable(true);
    } catch {
      setReachable(false);
    } finally {
      setLoading(false);
    }
  }, [apiBase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const rows = data?.current_metric_deltas ?? {};
  const agents = AGENT_ORDER.filter((a) => rows[a]).concat(
    Object.keys(rows).filter((a) => !AGENT_ORDER.includes(a)),
  );

  return (
    <section
      className="rounded-lg border border-[var(--fintheon-accent)]/20 bg-[var(--fintheon-bg)]/70 p-4"
      aria-label="GEPA self-improvement — last 7 days"
    >
      <header className="flex items-center justify-between mb-3">
        <div>
          <h4 className="text-[11px] font-semibold text-[var(--fintheon-accent)] tracking-wide uppercase">
            GEPA · 7d
          </h4>
          <p className="text-[10px] text-zinc-500 mt-0.5">
            Evolutionary optimization · PR-gated review · last run{" "}
            {timeAgo(data?.last_run_at ?? null)}
          </p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="text-[10px] text-[var(--fintheon-accent)] border border-[var(--fintheon-accent)]/30 rounded px-2 py-1 hover:bg-[var(--fintheon-accent)]/10 transition-colors disabled:opacity-40"
        >
          {loading ? "…" : "Refresh"}
        </button>
      </header>

      {!reachable && (
        <div className="text-[11px] text-red-400/70 py-3">
          Could not reach backend.
        </div>
      )}

      {reachable && agents.length === 0 && (
        <div className="text-[11px] text-zinc-500 py-3">
          No GEPA metrics yet. Run the nightly job or{" "}
          <code className="text-zinc-400">bun run gepa:dry-run</code>.
        </div>
      )}

      {reachable && agents.length > 0 && (
        <div className="grid grid-cols-1 gap-2">
          {agents.map((agent) => {
            const row = rows[agent];
            const label = AGENT_LABEL[agent] ?? agent;
            return (
              <div
                key={agent}
                className="flex items-center justify-between gap-3 border border-[var(--fintheon-accent)]/10 rounded px-3 py-2"
              >
                <div className="flex flex-col min-w-0">
                  <span className="text-[11px] font-semibold text-white truncate">
                    {label}
                  </span>
                  <span className="text-[10px] text-zinc-500 tabular-nums">
                    acc {row.accuracy} · lat {row.latency} · cost {row.cost}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {data && (
        <div className="mt-3 pt-3 border-t border-[var(--fintheon-accent)]/10 flex items-center justify-between text-[10px] text-zinc-500">
          <span>
            Proposed 7d:&nbsp;
            <span
              className="tabular-nums"
              style={{ color: "var(--fintheon-accent)" }}
            >
              {data.evolutions_proposed_7d}
            </span>
          </span>
          <span>
            Merged 7d:&nbsp;
            <span
              className="tabular-nums"
              style={{ color: "var(--fintheon-accent)" }}
            >
              {data.evolutions_merged_7d}
            </span>
          </span>
        </div>
      )}
    </section>
  );
}
