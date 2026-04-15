// [claude-code 2026-04-15] T3: Mobile StickyBulletin data hook — fetch notes + antilag times
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../contexts/AuthContext";
import { getMobileBackend } from "../lib/backend";

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
  const { getAccessToken } = useAuth();
  const [tradingNotes, setTradingNotes] = useState("");
  const [eventOfWeek, setEventOfWeek] = useState("");
  const [antilagTimes, setAntilagTimes] = useState<AntilagEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const backend = getMobileBackend(getAccessToken);
      const res = await backend.stickyBulletin.get();
      setTradingNotes(res.data.tradingNotes || "");
      setEventOfWeek(res.data.eventOfWeek || "");
      setAntilagTimes(res.data.antilagTimes || []);
    } catch {
      // silent — stale data is acceptable
    } finally {
      setIsLoading(false);
    }
  }, [getAccessToken]);

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
