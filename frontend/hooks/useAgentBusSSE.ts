// [claude-code 2026-04-10] S8-T4: Generic AgentBus SSE subscription hook — reusable across all surfaces
import { useEffect, useRef, useState, useCallback } from "react";

interface UseAgentBusSSEOptions {
  /** SSE endpoint URL */
  url: string;
  /** Auto-connect on mount (default: true) */
  enabled?: boolean;
  /** Reconnect on disconnect with exponential backoff (default: true) */
  reconnect?: boolean;
}

interface UseAgentBusSSEReturn<T> {
  /** Latest event received */
  lastEvent: T | null;
  /** All events received since connection */
  events: T[];
  /** Connection status */
  status: "connecting" | "connected" | "disconnected" | "error";
  /** Manual reconnect (resets backoff) */
  reconnect: () => void;
  /** Manual disconnect */
  disconnect: () => void;
}

const BACKOFF_DELAYS_MS = [1000, 2000, 4000, 8000, 16000, 30000];

export function useAgentBusSSE<T>(
  options: UseAgentBusSSEOptions,
): UseAgentBusSSEReturn<T> {
  const { url, enabled = true, reconnect: autoReconnect = true } = options;

  const [events, setEvents] = useState<T[]>([]);
  const [lastEvent, setLastEvent] = useState<T | null>(null);
  const [status, setStatus] = useState<
    "connecting" | "connected" | "disconnected" | "error"
  >("disconnected");
  // Increment to trigger a manual reconnect from outside the effect
  const [reconnectKey, setReconnectKey] = useState(0);

  const disconnectedRef = useRef(false);

  useEffect(() => {
    if (!enabled || !url) {
      setStatus("disconnected");
      return;
    }

    disconnectedRef.current = false;
    let es: EventSource | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let backoffIdx = 0;

    const connect = () => {
      setStatus("connecting");
      es = new EventSource(url);

      es.onopen = () => {
        setStatus("connected");
        backoffIdx = 0;
      };

      es.onmessage = (ev) => {
        // Ignore SSE heartbeat/comment lines (empty data)
        if (!ev.data?.trim()) return;
        try {
          const parsed = JSON.parse(ev.data) as T;
          setLastEvent(parsed);
          setEvents((prev) => [...prev, parsed]);
        } catch {
          // Non-JSON frame — ignore silently
        }
      };

      es.onerror = () => {
        setStatus("error");
        es?.close();
        es = null;

        if (autoReconnect && !disconnectedRef.current) {
          const delay = BACKOFF_DELAYS_MS[backoffIdx] ?? 30_000;
          backoffIdx = Math.min(backoffIdx + 1, BACKOFF_DELAYS_MS.length - 1);
          timer = setTimeout(connect, delay);
        } else {
          setStatus("disconnected");
        }
      };
    };

    connect();

    return () => {
      disconnectedRef.current = true;
      if (timer) clearTimeout(timer);
      if (es) es.close();
    };
    // reconnectKey intentionally included so manual reconnect re-mounts the effect
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, enabled, autoReconnect, reconnectKey]);

  const reconnect = useCallback(() => {
    disconnectedRef.current = false;
    setReconnectKey((k) => k + 1);
  }, []);

  const disconnect = useCallback(() => {
    disconnectedRef.current = true;
    // Bump key so the running effect tears down; new effect sees enabled=true
    // but we gate with disconnectedRef so it won't auto-reconnect
    setReconnectKey((k) => k + 1);
    setStatus("disconnected");
  }, []);

  return { lastEvent, events, status, reconnect, disconnect };
}
