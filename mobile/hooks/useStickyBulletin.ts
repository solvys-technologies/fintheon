// [claude-code 2026-04-16] Rewrite: direct fetch() bypassing ApiClient
import { useState, useEffect, useCallback } from "react";

const API_BASE = import.meta.env.VITE_API_URL || "";

interface AntilagEntry {
  time: string;
  dayOfWeek: number;
  instrument: string;
  notes: string;
  createdAt: string;
}

interface StickyBulletinState {
  tradingNotes: string;
  eventOfWeek: string;
  antilagTimes: AntilagEntry[];
  isLoading: boolean;
  refresh: () => void;
}

export function useMobileStickyBulletin(): StickyBulletinState {
  const [tradingNotes, setTradingNotes] = useState("");
  const [eventOfWeek, setEventOfWeek] = useState("");
  const [antilagTimes, setAntilagTimes] = useState<AntilagEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/sticky-bulletin`);
      if (!res.ok) return;
      const json = await res.json();
      const d = json.data ?? json;
      setTradingNotes(d.tradingNotes || "");
      setEventOfWeek(d.eventOfWeek || "");
      setAntilagTimes(d.antilagTimes || []);
    } catch (err) {
      console.error("[StickyBulletin] fetch failed:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    tradingNotes,
    eventOfWeek,
    antilagTimes,
    isLoading,
    refresh: fetchData,
  };
}
