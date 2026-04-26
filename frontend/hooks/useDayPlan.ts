// [claude-code 2026-04-26] S45-T2: useDayPlan — GET /api/day-plan/today on mount,
//   60s poll. Mirrors useIVScoreData shape: {data, isLoading, error}.
import { useState, useEffect, useRef } from "react";
import type { DayPlan } from "../types/day-plan";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";
const POLL_INTERVAL = 60_000;

export function useDayPlan() {
  const [data, setData] = useState<DayPlan | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchPlan() {
      try {
        const res = await fetch(`${API_BASE}/api/day-plan/today`);
        if (!res.ok) {
          if (!cancelled) {
            setError(`HTTP ${res.status}`);
            setIsLoading(false);
          }
          return;
        }
        const json = (await res.json()) as DayPlan;
        if (!cancelled) {
          setData(json);
          setError(null);
          setIsLoading(false);
        }
      } catch {
        // Silently retry on next poll
      }
    }

    fetchPlan();
    intervalRef.current = setInterval(fetchPlan, POLL_INTERVAL);

    return () => {
      cancelled = true;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return { data, isLoading, error };
}
