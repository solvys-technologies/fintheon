// [claude-code 2026-04-29] S53-T3: Econ watch health hook — consumes runtime payload
// and /api/econ/active-watch to surface pipeline vs natural-empty differentiation.
import { useEffect, useRef, useState, useCallback } from "react";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8080";
const POLL_INTERVAL_MS = 30_000;
const STALE_WINDOW_MS = 15 * 60 * 1000;

export type WatchHealthState =
  | "loading"
  | "backend-down"
  | "pipeline-degraded"
  | "idle"
  | "healthy";

export interface ActiveWatchEvent {
  id: string;
  eventName: string;
  country: string | null;
  category: string | null;
  scheduledAt: string;
  forecast: number | null;
  previous: number | null;
  actual: number | null;
  status: "upcoming" | "printed" | "missed";
}

export interface EconWatchHealth {
  state: WatchHealthState;
  events: ActiveWatchEvent[];
  backendReachable: boolean;
  triggerEnabled: boolean;
  feedStatus: string | null;
  emptyReason: string | null;
}

function deriveState(
  backendReachable: boolean,
  triggerEnabled: boolean,
  feedIsHealthy: boolean,
  eventsLen: number,
): WatchHealthState {
  if (!backendReachable) return "backend-down";
  if (!triggerEnabled || !feedIsHealthy) return "pipeline-degraded";
  if (eventsLen === 0) return "idle";
  return "healthy";
}

function deriveEmptyReason(
  state: WatchHealthState,
  triggerEnabled: boolean,
  feedStatus: string | null,
  backendReachable: boolean,
): string | null {
  switch (state) {
    case "backend-down":
      return "Backend unreachable — check network or diagnostics";
    case "pipeline-degraded":
      if (!triggerEnabled && feedStatus && feedStatus !== "healthy")
        return `Feed pipeline degraded (${feedStatus}) + econ trigger disabled`;
      if (!triggerEnabled) return "Econ keyword trigger is disabled";
      if (feedStatus && feedStatus !== "healthy")
        return `Feed pipeline degraded (${feedStatus})`;
      return "Pipeline health check required";
    case "idle":
      return "No events in active watch window";
    case "loading":
    case "healthy":
    default:
      return null;
  }
}

export function useEconWatchHealth(): EconWatchHealth {
  const [events, setEvents] = useState<ActiveWatchEvent[]>([]);
  const [backendReachable, setBackendReachable] = useState(false);
  const [triggerEnabled, setTriggerEnabled] = useState(false);
  const [feedStatus, setFeedStatus] = useState<string | null>(null);
  const [initialised, setInitialised] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const poll = useCallback(async () => {
    // Fetch active-watch events
    try {
      const watchRes = await fetch(`${API_BASE}/api/econ/active-watch`);
      if (!watchRes.ok) throw new Error(`HTTP ${watchRes.status}`);
      const json = (await watchRes.json()) as { events?: ActiveWatchEvent[] };
      if (mountedRef.current) {
        setBackendReachable(true);
        setEvents(Array.isArray(json.events) ? json.events : []);
      }
    } catch {
      if (mountedRef.current) setBackendReachable(false);
    }

    // Fetch trigger status
    try {
      const triggerRes = await fetch(`${API_BASE}/api/econ/trigger-status`);
      if (triggerRes.ok) {
        const data = (await triggerRes.json()) as { enabled?: boolean };
        if (mountedRef.current) setTriggerEnabled(Boolean(data.enabled));
      } else {
        if (mountedRef.current) setTriggerEnabled(false);
      }
    } catch {
      if (mountedRef.current) setTriggerEnabled(false);
    }

    // Fetch feed health
    try {
      const feedRes = await fetch(`${API_BASE}/api/diagnostics/feed-health`);
      if (feedRes.ok) {
        const data = (await feedRes.json()) as { status?: string };
        if (mountedRef.current) setFeedStatus(data.status ?? null);
      }
    } catch {
      // Non-fatal
    }

    if (mountedRef.current && !initialised) setInitialised(true);
  }, [initialised]);

  useEffect(() => {
    poll();
    const interval = window.setInterval(poll, POLL_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [poll]);

  const feedIsHealthy = feedStatus === "healthy";
  const state = initialised
    ? deriveState(
        backendReachable,
        triggerEnabled,
        feedIsHealthy,
        events.length,
      )
    : "loading";
  const emptyReason =
    events.length === 0
      ? deriveEmptyReason(state, triggerEnabled, feedStatus, backendReachable)
      : null;

  return {
    state,
    events,
    backendReachable,
    triggerEnabled,
    feedStatus,
    emptyReason,
  };
}
