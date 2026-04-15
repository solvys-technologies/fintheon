// [claude-code 2026-04-15] T4: Economic calendar hook — fetches today + tomorrow events
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../contexts/AuthContext";
import { getMobileBackend } from "../lib/backend";
import type { EconEventItem } from "@frontend/lib/services/data";

interface EconCalendarState {
  events: EconEventItem[];
  isLoading: boolean;
  refresh: () => void;
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function tomorrowStr(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function useEconCalendar(): EconCalendarState {
  const { getAccessToken } = useAuth();
  const [events, setEvents] = useState<EconEventItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetch_ = useCallback(async () => {
    setIsLoading(true);
    try {
      const backend = getMobileBackend(getAccessToken);
      const items = await backend.econCalendar.getEvents({
        from: todayStr(),
        to: tomorrowStr(),
      });
      // Sort by time ascending
      items.sort((a, b) => (a.time ?? "").localeCompare(b.time ?? ""));
      setEvents(items);
    } catch {
      setEvents([]);
    } finally {
      setIsLoading(false);
    }
  }, [getAccessToken]);

  useEffect(() => {
    fetch_();
  }, [fetch_]);

  return { events, isLoading, refresh: fetch_ };
}
