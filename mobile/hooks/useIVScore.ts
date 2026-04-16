// [claude-code 2026-04-15] Mobile IV score hook — 60s polling, mirrors frontend/useIVScoreData
import { useState, useEffect, useRef } from "react";
import type { IVScoreResponse } from "@frontend/types/market-data";

const API_BASE = import.meta.env.VITE_API_URL || "";
const POLL_INTERVAL = 60_000;

export function useIVScore() {
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

  const score = data?.score ?? 0;
  const scaledPoints = data?.points?.scaledPoints ?? 0;
  const adjustedPoints = data?.points?.implied?.adjustedPoints ?? 0;
  const urgency = data?.points?.urgency ?? "low";

  return { data, score, scaledPoints, adjustedPoints, urgency, isLoading };
}
