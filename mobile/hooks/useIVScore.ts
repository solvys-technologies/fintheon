// [claude-code 2026-04-16] Mobile IV score hook — 60s polling, snaps to user's configured instrument
import { useState, useEffect, useRef } from "react";
import type { IVScoreResponse } from "@frontend/types/market-data";
import { useSettings } from "../contexts/SettingsContext";

const API_BASE = import.meta.env.VITE_API_URL || "";
const POLL_INTERVAL = 60_000;

/** Map micro/mini symbols to their base IV instrument */
function toIVInstrument(symbol: string): string {
  const s = symbol.toUpperCase().replace("/", "");
  // Micro/mini NQ → NQ
  if (s === "MNQ" || s === "NQ") return "/NQ";
  // Micro/mini ES → ES
  if (s === "MES" || s === "ES") return "/ES";
  // Micro/mini YM → YM
  if (s === "MYM" || s === "YM") return "/YM";
  // Crude
  if (s === "MCL" || s === "CL") return "/CL";
  // Gold
  if (s === "MGC" || s === "GC") return "/GC";
  return `/${s}`;
}

export function useIVScore() {
  const { settings } = useSettings();
  const instrument = toIVInstrument(settings.selectedSymbol.symbol);

  const [data, setData] = useState<IVScoreResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchScore() {
      try {
        const res = await fetch(
          `${API_BASE}/api/market-data/iv-score?instrument=${encodeURIComponent(instrument)}`,
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
  }, [instrument]);

  const score = data?.score ?? 0;
  const scaledPoints = data?.points?.scaledPoints ?? 0;
  const adjustedPoints = data?.points?.implied?.adjustedPoints ?? 0;
  const urgency = data?.points?.urgency ?? "low";

  return { data, score, scaledPoints, adjustedPoints, urgency, isLoading };
}
