// [claude-code 2026-04-15] S16-T4: Shared hook for IV score data — 60s polling, used by BlendedVIXCard + NextSessionForecastCard
import { useState, useEffect, useRef } from "react";
import type { IVScoreResponse } from "../../types/market-data";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";
const POLL_INTERVAL = 60_000;

export function useIVScoreData() {
  const [data, setData] = useState<IVScoreResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchScore() {
      try {
        const res = await fetch(
          `${API_BASE}/api/market-data/iv-score?instrument=/ES`,
        );
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled) {
          setData(json);
          setIsLoading(false);
        }
      } catch {
        // Silently retry on next poll
      }
    }

    fetchScore();
    intervalRef.current = setInterval(fetchScore, POLL_INTERVAL);

    return () => {
      cancelled = true;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return { data, isLoading };
}
