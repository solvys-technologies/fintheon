// [claude-code 2026-04-15] S16-T4: Shared hook for IV score data — 60s polling, used by BlendedVIXCard + NextSessionForecastCard
// [claude-code 2026-05-03] S57: expose fetch errors for dashboard volatility strip parity.
import { useState, useEffect, useRef } from "react";
import type { IVScoreResponse } from "../../types/market-data";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";
const POLL_INTERVAL = 60_000;

export function useIVScoreData() {
  const [data, setData] = useState<IVScoreResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchScore() {
      try {
        const res = await fetch(
          `${API_BASE}/api/market-data/iv-score?instrument=/ES`,
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!cancelled) {
          setData(json);
          setError(null);
          setIsLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Fetch failed");
          setIsLoading(false);
        }
      }
    }

    fetchScore();
    intervalRef.current = setInterval(fetchScore, POLL_INTERVAL);

    return () => {
      cancelled = true;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return { data, isLoading, error };
}
