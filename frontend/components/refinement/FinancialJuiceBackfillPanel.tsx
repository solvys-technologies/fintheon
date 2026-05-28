// [claude-code 2026-05-06] Modernized: date-range picker (30-day max), uses kickstart
// mechanism (calls the working x-home-timeline collector), no borders, fading rulers.
// [claude-code 2026-05-04] Refinement control for X feed backfill.

import { useCallback, useState } from "react";
import { Zap, Calendar } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { FinancialJuiceRssRefreshControl } from "./FinancialJuiceRssRefreshControl";

const API_BASE = (
  import.meta.env.VITE_API_URL || "http://localhost:8080"
).replace(/\/$/, "");

const FADING_RULER: React.CSSProperties = {
  height: 1,
  margin: "8px 0",
  background:
    "linear-gradient(to right, rgba(199,159,74,0.18), transparent 80%)",
};

interface KickstartResult {
  fetched: number;
  candidateItems: number;
  written: number;
  kickedAt: string;
  perSource?: Array<{
    handle: string;
    fetched: number;
    candidates: number;
    accepted: number;
  }>;
}

function daysBetween(a: string, b: string): number {
  return Math.floor((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
}

export function FinancialJuiceBackfillPanel() {
  const { getAccessToken } = useAuth();
  const [result, setResult] = useState<KickstartResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [fromDate, setFromDate] = useState(() =>
    new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10),
  );
  const [toDate, setToDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );

  const maxFrom = new Date(Date.now() - 30 * 86400000)
    .toISOString()
    .slice(0, 10);
  const maxTo = new Date().toISOString().slice(0, 10);

  const runBackfill = useCallback(async () => {
    if (daysBetween(fromDate, toDate) > 30) return;
    setLoading(true);
    try {
      const token = (await getAccessToken()) ?? undefined;
      const handles = [
        "financialjuice",
        "DeItaone",
        "unusual_whales",
        "macroedgeRes",
        "OSINTTechnical",
        "nicktimiraos",
        "michaeljburry",
        "spotgamma",
        "trendspider",
      ];
      const res = await fetch(`${API_BASE}/api/riskflow/kickstart`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ handles, from: fromDate, to: toDate }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
      setResult(json);
    } catch (err) {
      console.warn("Backfill failed:", err);
    } finally {
      setLoading(false);
    }
  }, [getAccessToken, fromDate, toDate]);

  return (
    <div style={{ marginTop: 12 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div
          style={{
            color: "var(--fintheon-accent)",
            fontSize: 11,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            fontWeight: 700,
            fontFamily: "var(--font-heading)",
          }}
        >
          Backfill
        </div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginTop: 6,
          flexWrap: "wrap",
        }}
      >
        <Calendar className="w-3 h-3 text-[var(--fintheon-muted)]" />
        <input
          type="date"
          value={fromDate}
          min={maxFrom}
          max={toDate}
          onChange={(e) => setFromDate(e.target.value)}
          style={{
            background: "transparent",
            border: "none",
            color: "var(--fintheon-text)",
            fontSize: 10,
            fontFamily: "var(--font-mono)",
            padding: "2px 0",
            width: 110,
          }}
        />
        <span style={{ color: "var(--fintheon-muted)", fontSize: 10 }}>to</span>
        <input
          type="date"
          value={toDate}
          min={fromDate}
          max={maxTo}
          onChange={(e) => setToDate(e.target.value)}
          style={{
            background: "transparent",
            border: "none",
            color: "var(--fintheon-text)",
            fontSize: 10,
            fontFamily: "var(--font-mono)",
            padding: "2px 0",
            width: 110,
          }}
        />

        <button
          onClick={runBackfill}
          disabled={loading || daysBetween(fromDate, toDate) > 30}
          style={{
            background: "transparent",
            border: "none",
            color: loading ? "var(--fintheon-muted)" : "var(--fintheon-accent)",
            fontSize: 10,
            fontFamily: "var(--font-mono)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 4,
            padding: 0,
          }}
        >
          <Zap className="w-3 h-3" />
          {loading ? "Running..." : "Run"}
        </button>

        <FinancialJuiceRssRefreshControl />

        {daysBetween(fromDate, toDate) > 30 && (
          <span
            style={{
              fontSize: 9,
              color: "var(--fintheon-bearish)",
              fontFamily: "var(--font-mono)",
            }}
          >
            Max 30 days
          </span>
        )}
      </div>

      {(result || loading) && <div style={FADING_RULER} />}

      {result && (
        <div
          style={{
            display: "flex",
            gap: 20,
            fontSize: 10,
            fontFamily: "var(--font-mono)",
            color: "var(--fintheon-text)",
            flexWrap: "wrap",
            marginTop: 4,
          }}
        >
          <span>
            Fetched:{" "}
            <span
              style={{
                color: "var(--fintheon-accent)",
                fontFamily: "var(--font-data)",
                fontSize: 12,
              }}
            >
              {result.fetched}
            </span>
          </span>
          <span>Candidates: {result.candidateItems}</span>
          <span>Written: {result.written}</span>
          <span style={{ color: "var(--fintheon-muted)", fontSize: 9 }}>
            {new Date(result.kickedAt).toLocaleString()}
          </span>
        </div>
      )}
    </div>
  );
}
