// [claude-code 2026-04-25] S40-P6: useTimeToPrint reads /api/riskflow/stream
// for `time-to-print` SSE events. Exposes the current event payload and a
// derived `secondsRemaining` for the countdown widget.
//
// State machine (mirrors backend):
//   imminent → live → printed → cleared (no event)
//
// Multi-event collision: a single hook instance tracks the highest-rank
// event; the widget uses the eligibility lookahead endpoint
// (/api/time-to-print/next) to render the "+N more" chip + dropdown.

import { useEffect, useMemo, useRef, useState } from "react";

export type TimeToPrintState = "imminent" | "live" | "printed" | "cleared";

export interface TimeToPrintEvent {
  id: string;
  fires_at: string;
  state: TimeToPrintState;
  event: {
    name: string;
    country: string;
    forecast?: string | null;
    actual?: string | null;
    beatMiss?: "beat" | "miss" | "inline" | null;
    surprisePercent?: number | null;
    impactRank?: number | null;
  };
}

export interface TimeToPrintUpcoming {
  id: string;
  fires_at: string;
  name: string;
  country: string;
  forecast: string | null;
  impactRank: number | null;
}

export interface UseTimeToPrintResult {
  event: TimeToPrintEvent | null;
  secondsRemaining: number;
  upcomingCount: number;
  upcoming: TimeToPrintUpcoming[];
}

const STREAM_URL = "/api/riskflow/stream";
const LOOKAHEAD_URL = "/api/time-to-print/next";

interface UpcomingResponse {
  events: Array<{
    id: string;
    fires_at: string;
    name: string;
    country: string;
    forecast: string | null;
    impactRank: number | null;
  }>;
}

export function useTimeToPrint(): UseTimeToPrintResult {
  const [current, setCurrent] = useState<TimeToPrintEvent | null>(null);
  const [upcoming, setUpcoming] = useState<TimeToPrintUpcoming[]>([]);
  const [tick, setTick] = useState(0);
  const lastEventIdRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let es: EventSource | null = null;

    const connect = () => {
      if (cancelled) return;
      es = new EventSource(STREAM_URL);
      es.addEventListener("time-to-print", (msg) => {
        try {
          const payload = JSON.parse((msg as MessageEvent).data) as TimeToPrintEvent;
          if (payload.state === "cleared") {
            if (lastEventIdRef.current === payload.id) {
              setCurrent(null);
              lastEventIdRef.current = null;
            }
            return;
          }
          setCurrent(payload);
          lastEventIdRef.current = payload.id;
        } catch {
          /* ignore malformed frame */
        }
      });
      es.addEventListener("error", () => {
        es?.close();
        if (!cancelled) {
          setTimeout(connect, 5_000);
        }
      });
    };
    connect();
    return () => {
      cancelled = true;
      es?.close();
    };
  }, []);

  // Lookahead poll for upcomingCount (drives the "+N more" chip).
  useEffect(() => {
    let cancelled = false;
    const fetchOnce = async () => {
      try {
        const res = await fetch(LOOKAHEAD_URL);
        if (!res.ok) return;
        const data = (await res.json()) as UpcomingResponse;
        if (!cancelled) setUpcoming(data.events ?? []);
      } catch {
        /* offline */
      }
    };
    void fetchOnce();
    const id = setInterval(() => void fetchOnce(), 30_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  // [S40-P6] Cadence step-down per brief:
  //   T-5:00 → T-1:00   60s tick (display only)
  //   T-1:00 → T-0:00   30s tick
  //   T-0:00 onwards    1s tick (rapid burst awaits actual)
  // Re-evaluated on each tick to step the cadence down as the event approaches.
  useEffect(() => {
    if (!current) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const schedule = () => {
      if (cancelled) return;
      const remaining = Math.max(
        0,
        Math.floor(
          (new Date(current.fires_at).getTime() - Date.now()) / 1000,
        ),
      );
      const delay =
        remaining > 60 ? 60_000 : remaining > 0 ? 30_000 : 1_000;
      timer = setTimeout(() => {
        setTick((t) => t + 1);
        schedule();
      }, delay);
    };
    schedule();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [current?.id, current?.fires_at]);

  const secondsRemaining = useMemo(() => {
    if (!current) return 0;
    return Math.max(
      0,
      Math.floor(
        (new Date(current.fires_at).getTime() - Date.now()) / 1000,
      ),
    );
  }, [current, tick]);

  // upcomingCount excludes the active event, capped at 4 stacked rows in the
  // dropdown per brief.
  const upcomingCount = useMemo(() => {
    const filtered = upcoming.filter((e) => e.id !== current?.id);
    return Math.min(4, filtered.length);
  }, [upcoming, current?.id]);

  return {
    event: current,
    secondsRemaining,
    upcomingCount,
    upcoming: upcoming.filter((e) => e.id !== current?.id).slice(0, 4),
  };
}
