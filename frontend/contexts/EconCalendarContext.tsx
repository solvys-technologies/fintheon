// [claude-code 2026-04-16] Economic Calendar context — polls Supabase econ events on 60s interval.
// [claude-code 2026-03-07] Session date snaps to next day after 9PM
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import baseBackend from "../lib/backend";
import type { EconEventItem, EconPrintItem } from "../lib/services";

/** After 9PM local, the "session date" rolls to tomorrow */
function getSessionDate(): string {
  const now = new Date();
  if (now.getHours() >= 21) {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().slice(0, 10);
  }
  return now.toISOString().slice(0, 10);
}

interface EconCalendarContextValue {
  events: EconEventItem[];
  loading: boolean;
  error: string | null;
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  fetchPrints: (eventName: string) => Promise<EconPrintItem[]>;
  refresh: () => Promise<void>;
}

const EconCalendarContext = createContext<EconCalendarContextValue>({
  events: [],
  loading: true,
  error: null,
  selectedDate: getSessionDate(),
  setSelectedDate: () => {},
  fetchPrints: async () => [],
  refresh: async () => {},
});

const POLL_INTERVAL_MS = 60_000;

function getWeekRange(dateStr: string): { from: string; to: string } {
  const d = new Date(dateStr + "T12:00:00");
  const day = d.getDay();
  const monday = new Date(d);
  monday.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);
  return {
    from: monday.toISOString().slice(0, 10),
    to: friday.toISOString().slice(0, 10),
  };
}

export function EconCalendarProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [events, setEvents] = useState<EconEventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(getSessionDate);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchEvents = useCallback(async () => {
    try {
      const { from, to } = getWeekRange(selectedDate);
      const result = await baseBackend.econCalendar.getEvents({ from, to });
      setEvents(result);
      setError(null);
    } catch (err) {
      console.warn("[EconCalendar] Fetch error:", err);
      setError("Failed to load calendar");
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    setLoading(true);
    void fetchEvents();
    intervalRef.current = setInterval(() => {
      void fetchEvents();
    }, POLL_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchEvents]);

  const fetchPrints = useCallback(
    async (eventName: string): Promise<EconPrintItem[]> => {
      return baseBackend.econCalendar.getPrints(eventName);
    },
    [],
  );

  return (
    <EconCalendarContext.Provider
      value={{
        events,
        loading,
        error,
        selectedDate,
        setSelectedDate,
        fetchPrints,
        refresh: fetchEvents,
      }}
    >
      {children}
    </EconCalendarContext.Provider>
  );
}

export function useEconCalendar(): EconCalendarContextValue {
  return useContext(EconCalendarContext);
}
