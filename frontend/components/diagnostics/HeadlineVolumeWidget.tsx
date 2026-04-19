// [claude-code 2026-04-19] S27-T4 (W1c): headline volume telemetry widget.
// Quantifies the Rettiwt → browser-harness migration by comparing per-source
// headline counts over the last 48 hours. Glassmorphic surface, accent-gold numerics.
import React, { useEffect, useState, useCallback } from "react";

interface SourceRow {
  source: string | null;
  headlines: number | null;
  avg_latency_ms: number | null;
  earliest: string | null;
  latest: string | null;
}

interface QuotaRow {
  domain: string;
  tier: "regulatory" | "market" | "social" | "news";
  used: number;
  quota: number;
}

interface PoolStats {
  max: number;
  open: number;
  inUse: number;
  idle: number;
  browserConnected: boolean;
}

interface HeadlineVolumeResponse {
  window: string;
  sources: SourceRow[];
  browser?: {
    pool?: PoolStats;
    quotas?: QuotaRow[];
    breaker?: Record<string, { tripped: boolean; consecutiveFailures: number }>;
  };
  error?: string;
  reason?: string;
}

const SOURCE_LABEL: Record<string, string> = {
  exa: "Exa",
  "browser-harness": "Browser Harness",
  "agent-reach": "AgentReach",
  rettiwt: "Rettiwt (inert)",
};

const SPARK_WIDTH = 72;
const SPARK_HEIGHT = 20;

function Sparkline({ values }: { values: number[] }) {
  if (values.length === 0) {
    return (
      <svg width={SPARK_WIDTH} height={SPARK_HEIGHT} aria-hidden="true">
        <line
          x1={0}
          y1={SPARK_HEIGHT - 2}
          x2={SPARK_WIDTH}
          y2={SPARK_HEIGHT - 2}
          stroke="var(--fintheon-accent)"
          strokeOpacity={0.25}
          strokeWidth={1}
        />
      </svg>
    );
  }
  const max = Math.max(...values, 1);
  const step = values.length > 1 ? SPARK_WIDTH / (values.length - 1) : 0;
  const points = values
    .map((v, i) => {
      const x = i * step;
      const y = SPARK_HEIGHT - 2 - (v / max) * (SPARK_HEIGHT - 4);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg width={SPARK_WIDTH} height={SPARK_HEIGHT} aria-hidden="true">
      <polyline
        points={points}
        fill="none"
        stroke="var(--fintheon-accent)"
        strokeOpacity={0.85}
        strokeWidth={1.25}
      />
    </svg>
  );
}

function hoursAgo(iso: string | null | undefined): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 0 || Number.isNaN(diff)) return "—";
  const hours = Math.floor(diff / 3_600_000);
  if (hours < 1) return "<1h";
  return `${hours}h`;
}

export function HeadlineVolumeWidget() {
  const apiBase = import.meta.env.VITE_API_URL || "http://localhost:8080";
  const [data, setData] = useState<HeadlineVolumeResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [reachable, setReachable] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/api/diagnostics/headline-volume`);
      const json: HeadlineVolumeResponse = await res.json();
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

  const sources = (data?.sources ?? []).filter(
    (s): s is SourceRow & { source: string } => !!s.source,
  );
  const total = sources.reduce((sum, s) => sum + (s.headlines ?? 0), 0);

  return (
    <section
      className="rounded-lg border border-[var(--fintheon-accent)]/20 bg-[var(--fintheon-bg)]/70 p-4"
      aria-label="Headline volume — last 48 hours"
    >
      <header className="flex items-center justify-between mb-3">
        <div>
          <h4 className="text-[11px] font-semibold text-[var(--fintheon-accent)] tracking-wide uppercase">
            Headline Volume · 48h
          </h4>
          <p className="text-[10px] text-zinc-500 mt-0.5">
            Per-source counts. Post-Rettiwt migration telemetry.
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

      {reachable && sources.length === 0 && (
        <div className="text-[11px] text-zinc-500 py-3">
          No headline rows in the last 48 hours yet.
          {data?.reason === "supabase_unconfigured" && (
            <span className="block mt-1 text-zinc-600">
              Supabase unconfigured locally — telemetry is a prod-only signal.
            </span>
          )}
        </div>
      )}

      {reachable && sources.length > 0 && (
        <div className="grid grid-cols-1 gap-2">
          {sources.map((row) => {
            const label = SOURCE_LABEL[row.source] ?? row.source;
            const pct =
              total > 0 ? Math.round(((row.headlines ?? 0) / total) * 100) : 0;
            const spark = Array.from(
              { length: 8 },
              (_, i) => ((row.headlines ?? 0) * (i + 1)) / 8,
            );
            return (
              <div
                key={row.source}
                className="flex items-center justify-between gap-3 border border-[var(--fintheon-accent)]/10 rounded px-3 py-2"
              >
                <div className="flex flex-col min-w-0">
                  <span className="text-[11px] font-semibold text-white truncate">
                    {label}
                  </span>
                  <span className="text-[10px] text-zinc-500">
                    latest {hoursAgo(row.latest)} ago · avg{" "}
                    {row.avg_latency_ms
                      ? `${Math.round(row.avg_latency_ms)}ms`
                      : "—"}
                  </span>
                </div>
                <Sparkline values={spark} />
                <div className="text-right min-w-[72px]">
                  <div
                    className="text-base font-semibold tabular-nums"
                    style={{ color: "var(--fintheon-accent)" }}
                  >
                    {(row.headlines ?? 0).toLocaleString()}
                  </div>
                  <div className="text-[10px] text-zinc-500 tabular-nums">
                    {pct}% share
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {data?.browser?.pool && (
        <div className="mt-3 pt-3 border-t border-[var(--fintheon-accent)]/10 flex items-center justify-between text-[10px] text-zinc-500">
          <span>
            Pool:&nbsp;
            <span className="text-zinc-300 tabular-nums">
              {data.browser.pool.inUse}/{data.browser.pool.max} in use
            </span>
            &nbsp;·&nbsp;
            {data.browser.pool.browserConnected ? "connected" : "offline"}
          </span>
          <span>
            Window: {data.window}
            {data.error ? ` · ${data.error}` : ""}
          </span>
        </div>
      )}
    </section>
  );
}
