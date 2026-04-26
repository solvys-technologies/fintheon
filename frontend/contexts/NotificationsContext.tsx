// [claude-code 2026-04-25] S35-Unified: server-backed notification list + cross-device clear/read.
//
// Why a new context vs. polling inside NotificationToast?
//   The bell, the toast feed, and the badge counter all need the same data. Centralizing
//   here means a single 10s poll, a single BroadcastChannel listener, and one place that
//   decides what optimistic-UI looks like when the user clears something.
//
// Cross-device sync model:
//   - GET /api/notifications every 10s (visible-tab gated).
//   - BroadcastChannel "fintheon:notifications" — desktop has no service worker, so the
//     channel is mostly a same-tab fanout for now. When the mobile SW receives a __sync
//     event we'll forward via postMessage; same-origin tabs (Electron renderer windows)
//     pick up the channel message and re-fetch.
//   - X-Fintheon-Device header on every mutation so the server can mark the originating
//     endpoint and other devices skip self-echo.

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { getAccessToken } from "../lib/supabase";

const API_BASE =
  (import.meta as any).env?.VITE_API_URL || "http://localhost:8080";
const POLL_MS = 10_000;
const BROADCAST_CHANNEL = "fintheon:notifications";
const DEVICE_ID_KEY = "fintheon:device-id";

export interface ServerNotification {
  id: string;
  category: string;
  severity: "low" | "medium" | "high" | "critical";
  title: string;
  body: string;
  url?: string;
  metadata?: Record<string, unknown>;
  read: boolean;
  createdAt: string;
  readAt?: string;
  clearedAt?: string;
}

interface NotificationsContextValue {
  notifications: ServerNotification[];
  unreadCount: number;
  loading: boolean;
  refresh: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  clearOne: (id: string) => Promise<void>;
  clearAll: () => Promise<void>;
}

const NotificationsContext = createContext<NotificationsContextValue>({
  notifications: [],
  unreadCount: 0,
  loading: false,
  refresh: async () => {},
  markRead: async () => {},
  markAllRead: async () => {},
  clearOne: async () => {},
  clearAll: async () => {},
});

function getDeviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `dev-${Math.random().toString(36).slice(2)}-${Date.now()}`;
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  } catch {
    return "anonymous-device";
  }
}

async function authedFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response | null> {
  try {
    const token = await getAccessToken();
    if (!token) return null;
    return await fetch(`${API_BASE}${path}`, {
      ...init,
      credentials: "include",
      headers: {
        ...(init.headers ?? {}),
        Authorization: `Bearer ${token}`,
        "X-Fintheon-Device": getDeviceId(),
      },
    });
  } catch {
    return null;
  }
}

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<ServerNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const inFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setLoading(true);
    try {
      const res = await authedFetch("/api/notifications?limit=50");
      if (!res || !res.ok) return;
      const json = (await res.json()) as {
        notifications?: ServerNotification[];
        unreadCount?: number;
      };
      setNotifications(json.notifications ?? []);
      setUnreadCount(Number(json.unreadCount ?? 0));
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }, []);

  // Initial fetch + visible-tab polling.
  useEffect(() => {
    void refresh();
    const id = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, POLL_MS);
    const onVis = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [refresh]);

  // Cross-tab + SW-driven refetch trigger.
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel(BROADCAST_CHANNEL);
    const handler = (ev: MessageEvent) => {
      const data = ev.data as { kind?: string } | null;
      if (!data) return;
      // Any sync kind means our local view is stale — refresh.
      if (
        data.kind === "preferences" ||
        data.kind?.startsWith("notification") ||
        data.kind?.startsWith("notifications")
      ) {
        void refresh();
      }
    };
    channel.addEventListener("message", handler);
    return () => {
      channel.removeEventListener("message", handler);
      channel.close();
    };
  }, [refresh]);

  // Listen for service-worker messages (mobile SW forwards __sync events).
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.serviceWorker) return;
    const handler = (ev: MessageEvent) => {
      const data = ev.data as { type?: string; kind?: string } | null;
      if (!data || data.type !== "fintheon:sync") return;
      void refresh();
    };
    navigator.serviceWorker.addEventListener("message", handler);
    return () =>
      navigator.serviceWorker.removeEventListener("message", handler);
  }, [refresh]);

  const markRead = useCallback(
    async (id: string) => {
      // Optimistic update
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === id
            ? { ...n, read: true, readAt: new Date().toISOString() }
            : n,
        ),
      );
      setUnreadCount((c) => Math.max(0, c - 1));

      const res = await authedFetch(`/api/notifications/${id}/read`, {
        method: "POST",
      });
      if (!res || !res.ok) {
        // Reconcile from server on failure
        void refresh();
      }
    },
    [refresh],
  );

  const markAllRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
    const res = await authedFetch("/api/notifications/read-all", {
      method: "POST",
    });
    if (!res || !res.ok) void refresh();
  }, [refresh]);

  const clearOne = useCallback(
    async (id: string) => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      setUnreadCount((c) => {
        const cleared = notifications.find((n) => n.id === id);
        return cleared && !cleared.read ? Math.max(0, c - 1) : c;
      });
      const res = await authedFetch(`/api/notifications/${id}/clear`, {
        method: "POST",
      });
      if (!res || !res.ok) void refresh();
    },
    [notifications, refresh],
  );

  const clearAll = useCallback(async () => {
    setNotifications([]);
    setUnreadCount(0);
    const res = await authedFetch("/api/notifications/clear-all", {
      method: "POST",
    });
    if (!res || !res.ok) void refresh();
  }, [refresh]);

  const value = useMemo<NotificationsContextValue>(
    () => ({
      notifications,
      unreadCount,
      loading,
      refresh,
      markRead,
      markAllRead,
      clearOne,
      clearAll,
    }),
    [
      notifications,
      unreadCount,
      loading,
      refresh,
      markRead,
      markAllRead,
      clearOne,
      clearAll,
    ],
  );

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
}

export const useServerNotifications = () => useContext(NotificationsContext);
