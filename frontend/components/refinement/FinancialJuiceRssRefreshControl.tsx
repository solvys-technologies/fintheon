import { useCallback, useState } from "react";
import { RefreshCw } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";

const API_BASE = (
  import.meta.env.VITE_API_URL || "http://localhost:8080"
).replace(/\/$/, "");

interface RssRefreshResult {
  refreshed: boolean;
  rateLimited: boolean;
  fetched: number;
  written: number;
  scored: number;
  rescored: number;
  error: string | null;
  backoffMs: number | null;
}

interface RssRefreshResponse {
  ok: boolean;
  result: RssRefreshResult;
}

export function FinancialJuiceRssRefreshControl() {
  const { getAccessToken } = useAuth();
  const { addToast } = useToast();
  const [result, setResult] = useState<RssRefreshResult | null>(null);
  const [loading, setLoading] = useState(false);

  const refreshRss = useCallback(async () => {
    setLoading(true);
    setResult(null);
    try {
      const token = await getAccessToken();
      if (!token) {
        addToast("Sign in required", "info");
        return;
      }

      const res = await fetch(
        `${API_BASE}/api/admin/riskflow/backfill-drip/refresh-rss`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        },
      );
      const json = (await res
        .json()
        .catch(() => null)) as RssRefreshResponse | null;
      if (json?.result) setResult(json.result);
      if (!res.ok || !json?.ok) {
        const message =
          json?.result?.error || `FinancialJuice RSS HTTP ${res.status}`;
        addToast("FJ RSS refresh failed", "error", message);
        return;
      }

      addToast(
        "FJ RSS refreshed",
        "success",
        `${json.result.written}/${json.result.fetched} written`,
      );
    } catch (err) {
      addToast(
        "FJ RSS refresh failed",
        "error",
        err instanceof Error ? err.message : String(err),
      );
    } finally {
      setLoading(false);
    }
  }, [getAccessToken, addToast]);

  return (
    <>
      <button
        onClick={refreshRss}
        disabled={loading}
        title="Refresh FinancialJuice RSS connection"
        aria-label="Refresh FinancialJuice RSS connection"
        style={{
          background: "transparent",
          border: "none",
          color: loading ? "var(--fintheon-muted)" : "var(--fintheon-accent)",
          fontSize: 10,
          fontFamily: "var(--font-mono)",
          cursor: loading ? "default" : "pointer",
          display: "flex",
          alignItems: "center",
          gap: 4,
          padding: 0,
        }}
      >
        <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
        {loading ? "Refreshing..." : "Refresh RSS"}
      </button>

      {result && (
        <>
          <span
            style={{
              color: result.error
                ? "var(--fintheon-bearish)"
                : "var(--fintheon-accent)",
              fontSize: 10,
              fontFamily: "var(--font-mono)",
            }}
          >
            RSS {result.written}/{result.fetched}
          </span>
          <span style={{ color: "var(--fintheon-muted)", fontSize: 10 }}>
            Score {result.scored}
          </span>
          {result.rateLimited && result.backoffMs && (
            <span style={{ color: "var(--fintheon-bearish)", fontSize: 10 }}>
              Backoff {Math.round(result.backoffMs / 1000)}s
            </span>
          )}
        </>
      )}
    </>
  );
}
