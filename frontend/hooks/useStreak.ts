// [claude-code 2026-04-26] S45-T2: useStreak — GET /api/day-plan/streak,
//   mount + 5min refresh. Drives the Day Card StreakBadge.
import { useState, useEffect, useRef } from "react";
import type { StreakResponse } from "../types/day-plan";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";
const POLL_INTERVAL = 5 * 60_000;

export function useStreak() {
  const [data, setData] = useState<StreakResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchStreak() {
      try {
        const res = await fetch(`${API_BASE}/api/day-plan/streak`);
        if (!res.ok) {
          if (!cancelled) {
            setError(`HTTP ${res.status}`);
            setIsLoading(false);
          }
          return;
        }
        const json = (await res.json()) as StreakResponse;
        if (!cancelled) {
          setData(json);
          setError(null);
          setIsLoading(false);
        }
      } catch {
        // Silently retry
      }
    }

    fetchStreak();
    intervalRef.current = setInterval(fetchStreak, POLL_INTERVAL);

    return () => {
      cancelled = true;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return { data, isLoading, error };
}
