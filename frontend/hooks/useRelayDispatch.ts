// [claude-code 2026-04-18] S21-T1 Relay dispatch hook — polls /api/relay/health for mobile
// reachability, exposes dispatch() + disconnect() actions, and subscribes to /mirror-stream
// SSE while dispatched so messages typed on mobile appear on desktop in real time.
import { useCallback, useEffect, useRef } from "react";
import { getAccessToken } from "../lib/supabase";
import {
  useRelayDispatchStore,
  type MirrorMessage,
} from "../lib/relay-dispatch-store";

const API_BASE =
  import.meta.env.VITE_API_URL !== undefined &&
  import.meta.env.VITE_API_URL !== null
    ? (import.meta.env.VITE_API_URL as string)
    : "http://localhost:8080";

const HEALTH_POLL_MS = 15_000;

interface UseRelayDispatchResult {
  isMobileReachable: boolean | null;
  isDispatched: boolean;
  dispatchedConversationId: string | null;
  deviceLabel: string | null;
  isDispatching: boolean;
  mirrorMessages: MirrorMessage[];
  dispatch: (conversationId: string, deviceLabel?: string) => Promise<void>;
  disconnect: () => Promise<void>;
}

/**
 * Returns live dispatch state + actions. Safe to call from multiple surfaces; the
 * store is shared so sidebar and main chat see the same dispatch.
 */
export function useRelayDispatch(): UseRelayDispatchResult {
  const state = useRelayDispatchStore();
  const {
    setMobileReachable,
    beginDispatch,
    endDispatch,
    setDispatching,
    appendMirrorMessage,
  } = state;

  // ── 1. Periodic health poll ────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const token = await getAccessToken();
        const headers: Record<string, string> = {};
        if (token) headers.Authorization = `Bearer ${token}`;
        const res = await fetch(`${API_BASE}/api/relay/health`, { headers });
        if (cancelled) return;
        if (!res.ok) {
          setMobileReachable(false);
          return;
        }
        const data = (await res.json()) as {
          connected: boolean;
          dispatch?: {
            conversationId: string;
            deviceLabel: string;
          } | null;
        };
        setMobileReachable(Boolean(data.connected));
        // Reconcile server-side dispatch state with local store on first poll
        // (e.g. reload while dispatched — keep showing the banner).
        if (
          data.dispatch &&
          state.dispatchedConversationId !== data.dispatch.conversationId
        ) {
          beginDispatch(
            data.dispatch.conversationId,
            data.dispatch.deviceLabel,
          );
        } else if (!data.dispatch && state.dispatchedConversationId) {
          endDispatch();
        }
      } catch {
        if (!cancelled) setMobileReachable(false);
      }
    }

    void poll();
    const timer = setInterval(poll, HEALTH_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── 2. Mirror-stream SSE while dispatched ──────────────────────────────────
  const eventSourceRef = useRef<EventSource | null>(null);
  useEffect(() => {
    const convId = state.dispatchedConversationId;
    if (!convId) {
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
      return;
    }

    let es: EventSource | null = null;

    (async () => {
      const token = await getAccessToken();
      // EventSource can't set Authorization header natively — pass token via query.
      // Server should also support Bearer for authed SSE; keeping query as fallback.
      const url = new URL(`${API_BASE}/api/relay/mirror-stream`);
      url.searchParams.set("conversationId", convId);
      if (token) url.searchParams.set("access_token", token);
      es = new EventSource(url.toString(), { withCredentials: false });
      eventSourceRef.current = es;

      es.onmessage = (event) => {
        try {
          const frame = JSON.parse(event.data);
          if (frame?.type === "mirror-message" && frame.payload) {
            appendMirrorMessage(frame.payload as MirrorMessage);
          }
        } catch {
          // Ignore malformed frames
        }
      };
      es.onerror = () => {
        // Let the browser retry automatically; just log.
        console.warn("[useRelayDispatch] mirror-stream error");
      };
    })();

    return () => {
      es?.close();
      if (eventSourceRef.current === es) eventSourceRef.current = null;
    };
  }, [state.dispatchedConversationId, appendMirrorMessage]);

  // ── 3. Actions ─────────────────────────────────────────────────────────────
  const dispatch = useCallback(
    async (conversationId: string, deviceLabel?: string) => {
      setDispatching(true);
      try {
        const token = await getAccessToken();
        const res = await fetch(`${API_BASE}/api/relay/dispatch`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ conversationId, deviceLabel }),
        });
        if (!res.ok) {
          const errBody = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(errBody.error || `dispatch failed (${res.status})`);
        }
        const data = (await res.json()) as {
          ok: boolean;
          deviceLabel: string;
          pushedTo: number;
        };
        beginDispatch(conversationId, data.deviceLabel ?? "your mobile");
      } finally {
        setDispatching(false);
      }
    },
    [beginDispatch, setDispatching],
  );

  const disconnect = useCallback(async () => {
    const convId = state.dispatchedConversationId;
    // Optimistic end — UI snaps back immediately
    endDispatch();
    try {
      const token = await getAccessToken();
      await fetch(`${API_BASE}/api/relay/disconnect`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ conversationId: convId }),
      });
    } catch {
      // Swallow — if the server missed it, health poll will resync.
    }
  }, [endDispatch, state.dispatchedConversationId]);

  return {
    isMobileReachable: state.isMobileReachable,
    isDispatched: Boolean(state.dispatchedConversationId),
    dispatchedConversationId: state.dispatchedConversationId,
    deviceLabel: state.deviceLabel,
    isDispatching: state.isDispatching,
    mirrorMessages: state.mirrorMessages,
    dispatch,
    disconnect,
  };
}
