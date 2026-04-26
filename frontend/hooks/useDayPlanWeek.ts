// [claude-code 2026-04-26] S45-T2: useDayPlanWeek — Mon–Fri preview pills.
//   GET /api/day-plan/week on mount + 5min refresh. Tolerant to either
//   { days: WeekDayEntry[] } or a bare WeekDayEntry[] response shape.
import { useState, useEffect, useRef } from "react";
import type { WeekDayEntry } from "../types/day-plan";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";
const POLL_INTERVAL = 5 * 60_000;

export function useDayPlanWeek() {
  const [data, setData] = useState<WeekDayEntry[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchWeek() {
      try {
        const res = await fetch(`${API_BASE}/api/day-plan/week`);
        if (!res.ok) {
          if (!cancelled) {
            setError(`HTTP ${res.status}`);
            setIsLoading(false);
          }
          return;
        }
        const json = (await res.json()) as
          | WeekDayEntry[]
          | { days: WeekDayEntry[] };
        const days = Array.isArray(json) ? json : json.days;
        if (!cancelled) {
          setData(days);
          setError(null);
          setIsLoading(false);
        }
      } catch {
        // Silently retry
      }
    }

    fetchWeek();
    intervalRef.current = setInterval(fetchWeek, POLL_INTERVAL);

    return () => {
      cancelled = true;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return { data, isLoading, error };
}
