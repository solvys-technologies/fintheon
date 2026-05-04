// [claude-code 2026-05-04] Refinement control for FinancialJuice slow-drip
// backfill. Starts/stops a backend job that inserts 10-15 missing tweets every
// 30 minutes in chronological order.

import { useCallback, useEffect, useState } from "react";
import { Hourglass, PauseCircle, PlayCircle } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";

const API_BASE = (import.meta.env.VITE_API_URL || "http://localhost:8080").replace(
  /\/$/,
  "",
);

interface DripStatus {
  running: boolean;
  startedAt: string | null;
  lastRunAt: string | null;
  nextRunAt: string | null;
  lastWritten: number;
  totalWritten: number;
  lastScored: number;
  totalScored: number;
  lastError: string | null;
}

export function FinancialJuiceBackfillPanel() {
  const { getAccessToken } = useAuth();
  const [status, setStatus] = useState<DripStatus | null>(null);
  const [loading, setLoading] = useState(false);

  const call = useCallback(
    async (path: string, method: "GET" | "POST") => {
      const token = (await getAccessToken()) ?? undefined;
      const res = await fetch(`${API_BASE}/api/admin/riskflow/${path}`, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error || `Request failed: ${res.status}`);
      }
      setStatus(json.status as DripStatus);
    },
    [getAccessToken],
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      await call("backfill-drip/status", "GET");
    } finally {
      setLoading(false);
    }
  }, [call]);

  useEffect(() => {
    void refresh();
    const id = setInterval(() => {
      void refresh();
    }, 15_000);
    return () => clearInterval(id);
  }, [refresh]);

  return (
    <div
      style={{
        marginTop: 12,
        padding: "10px 12px",
        background: "rgba(10, 9, 5, 0.72)",
        backdropFilter: "blur(18px) saturate(1.08)",
        border: "1px solid rgba(199, 159, 74, 0.12)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ color: "var(--fintheon-accent)", fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 700 }}>
          FinancialJuice Backfill
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button
            type="button"
            onClick={() => void call("backfill-drip/start", "POST")}
            style={{ border: "1px solid rgba(199,159,74,0.22)", background: "transparent", color: "var(--fintheon-accent)", padding: "2px 8px", fontSize: 10, display: "flex", alignItems: "center", gap: 4 }}
          >
            <PlayCircle className="w-3 h-3" />
            Start
          </button>
          <button
            type="button"
            onClick={() => void call("backfill-drip/stop", "POST")}
            style={{ border: "1px solid rgba(199,159,74,0.22)", background: "transparent", color: "var(--fintheon-text)", padding: "2px 8px", fontSize: 10, display: "flex", alignItems: "center", gap: 4 }}
          >
            <PauseCircle className="w-3 h-3" />
            Stop
          </button>
        </div>
      </div>

      <div style={{ marginTop: 6, color: "var(--fintheon-muted)", fontSize: 10, fontFamily: "var(--font-mono)" }}>
        Slow drip: random 10-15 posts every 30m from @financialjuice (2026-05-01 to 2026-05-03), inserted oldest-first.
      </div>

      <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 6, fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--fintheon-text)" }}>
        <span>Status: {status?.running ? "running" : "stopped"}</span>
        <span>Last write: {status?.lastWritten ?? 0}</span>
        <span>Total written: {status?.totalWritten ?? 0}</span>
        <span>Total scored: {status?.totalScored ?? 0}</span>
        <span>Last run: {status?.lastRunAt ? new Date(status.lastRunAt).toLocaleTimeString() : "-"}</span>
        <span>Next run: {status?.nextRunAt ? new Date(status.nextRunAt).toLocaleTimeString() : "-"}</span>
      </div>

      {loading && (
        <div style={{ marginTop: 8, fontSize: 10, color: "var(--fintheon-muted)", fontFamily: "var(--font-mono)", display: "flex", alignItems: "center", gap: 4 }}>
          <Hourglass className="w-3 h-3" />
          Updating status...
        </div>
      )}
      {status?.lastError && (
        <div style={{ marginTop: 8, fontSize: 10, color: "var(--fintheon-bearish)", fontFamily: "var(--font-mono)" }}>
          Last error: {status.lastError}
        </div>
      )}
    </div>
  );
}
