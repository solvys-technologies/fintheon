// [claude-code 2026-04-19] S27-T9 W2e: Smart Model Routing diagnostics widget.
// Per-agent model + 24h call count, cost, latency. Budget status + degrade flag.
// Glassmorphic surface, accent-gold numerics, no gradients — matches HeadlineVolumeWidget.
import React, { useEffect, useState, useCallback } from "react";

interface AgentRow {
  model: string;
  calls: number;
  total_cost_usd: number;
  avg_latency_ms: number;
}

interface BudgetStatus {
  user_id: string;
  used_usd: number;
  cap_usd: number;
  degraded: boolean;
}

interface RoutingResponse {
  last_24h: Record<string, AgentRow>;
  budget_status?: BudgetStatus;
}

const AGENT_LABEL: Record<string, string> = {
  harper: "Harper",
  oracle: "Oracle",
  feucht: "Feucht",
  consul: "Consul",
  herald: "Herald",
  "harper-voice": "Harper-Voice",
};

const AGENT_ORDER = ["harper", "oracle", "feucht", "consul", "herald"];

function prettyModel(model: string): string {
  return model
    .replace(/^claude-/, "")
    .replace(/-2025\d{4}$/, "")
    .replace(/-2026\d{4}$/, "");
}

export function RoutingWidget() {
  const apiBase = import.meta.env.VITE_API_URL || "http://localhost:8080";
  const [data, setData] = useState<RoutingResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [reachable, setReachable] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/api/diagnostics/routing`);
      const json: RoutingResponse = await res.json();
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

  const rows = data?.last_24h ?? {};
  const budget = data?.budget_status;
  const agents = AGENT_ORDER.filter((a) => rows[a]).concat(
    Object.keys(rows).filter((a) => !AGENT_ORDER.includes(a)),
  );

  return (
    <section
      className="rounded-lg border border-[var(--fintheon-accent)]/20 bg-[var(--fintheon-bg)]/70 p-4"
      aria-label="Smart Model Routing — last 24 hours"
    >
      <header className="flex items-center justify-between mb-3">
        <div>
          <h4 className="text-[11px] font-semibold text-[var(--fintheon-accent)] tracking-wide uppercase">
            Smart Model Routing · 24h
          </h4>
          <p className="text-[10px] text-zinc-500 mt-0.5">
            Per-agent model selection + live cost and latency.
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
          No LLM calls recorded in the last 24 hours.
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
                  <span className="text-[10px] text-zinc-500 truncate">
                    {prettyModel(row.model)} · {row.calls} call
                    {row.calls === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="text-right min-w-[96px]">
                  <div
                    className="text-base font-semibold tabular-nums"
                    style={{ color: "var(--fintheon-accent)" }}
                  >
                    ${row.total_cost_usd.toFixed(2)}
                  </div>
                  <div className="text-[10px] text-zinc-500 tabular-nums">
                    avg {row.avg_latency_ms}ms
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {budget && (
        <div className="mt-3 pt-3 border-t border-[var(--fintheon-accent)]/10 flex items-center justify-between text-[10px] text-zinc-500">
          <span>
            Budget:&nbsp;
            <span
              className="text-zinc-300 tabular-nums"
              style={{
                color: budget.degraded ? "#f0c36d" : undefined,
              }}
            >
              ${budget.used_usd.toFixed(2)} / ${budget.cap_usd.toFixed(2)}
            </span>
          </span>
          <span>
            {budget.degraded
              ? "Degraded (Opus → Sonnet for Harper/Oracle)"
              : "Within cap"}
          </span>
        </div>
      )}
    </section>
  );
}
