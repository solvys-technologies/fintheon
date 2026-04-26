// [claude-code 2026-04-26] S45-T2: useDriftStatus — GET /api/day-plan/drift-status,
//   60s poll. Drives the Strategium header DriftIndicator pill.
import { useState, useEffect, useRef } from "react";
import type { DriftStatusResponse } from "../types/day-plan";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";
const POLL_INTERVAL = 60_000;

export function useDriftStatus() {
  const [data, setData] = useState<DriftStatusResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchStatus() {
      try {
        const res = await fetch(`${API_BASE}/api/day-plan/drift-status`);
        if (!res.ok) {
          if (!cancelled) {
            setError(`HTTP ${res.status}`);
            setIsLoading(false);
          }
          return;
        }
        const json = (await res.json()) as DriftStatusResponse;
        if (!cancelled) {
          setData(json);
          setError(null);
          setIsLoading(false);
        }
      } catch {
        // Silently retry
      }
    }

    fetchStatus();
    intervalRef.current = setInterval(fetchStatus, POLL_INTERVAL);

    return () => {
      cancelled = true;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return { data, isLoading, error };
}
