// [claude-code 2026-04-19] S25: mirror unreadCount into app-icon badge (setAppBadge) and
//   notify the SW to reset its local counter on mark-all-read.
// [claude-code 2026-04-18] A4: notification history fetch + unread tracking for NotificationBell
// [claude-code 2026-04-25] S35-Unified: clearOne / clearAll endpoints + SW fintheon:sync
//   listener so notifications cleared on desktop disappear on mobile within a second.
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { clearBadge, notifyServiceWorkerClear, setBadge } from "../lib/badge";

const API_BASE = import.meta.env.VITE_API_URL || "";
const POLL_MS = 30_000;
const DEVICE_ID_KEY = "fintheon:device-id";

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

export interface NotificationItem {
  id: string;
  userId: string;
  category: string;
  severity: "low" | "medium" | "high" | "critical";
  title: string;
  body: string;
  url?: string;
  /** Upstream proposal/event id for approve/deny routing. */
  eventId?: string;
  metadata?: Record<string, unknown>;
  read: boolean;
  createdAt: string;
  readAt?: string;
}

interface HistoryResponse {
  notifications: NotificationItem[];
  total: number;
  unreadCount: number;
}

export function useNotificationHistory() {
  const { getAccessToken, user } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchHistory = useCallback(async () => {
    if (!user) return;
    const token = await getAccessToken();
    if (!token) return;
    setIsLoading(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/notifications/history?limit=50`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "X-Fintheon-Device": getDeviceId(),
          },
        },
      );
      if (!res.ok) return;
      const data = (await res.json()) as HistoryResponse;
      setNotifications(data.notifications ?? []);
      setUnreadCount(data.unreadCount ?? 0);
      // [S25] Mirror server truth into the app-icon badge (no-op if unsupported)
      void setBadge(data.unreadCount ?? 0);
    } catch {
      // Network error — keep prior state
    } finally {
      setIsLoading(false);
    }
  }, [getAccessToken, user]);

  const markRead = useCallback(
    async (ids: string[]) => {
      if (ids.length === 0) return;
      const token = await getAccessToken();
      if (!token) return;
      // Optimistic update
      setNotifications((prev) =>
        prev.map((n) =>
          ids.includes(n.id)
            ? { ...n, read: true, readAt: new Date().toISOString() }
            : n,
        ),
      );
      setUnreadCount((c) => Math.max(0, c - ids.length));
      try {
        await fetch(`${API_BASE}/api/notifications/history/mark-read`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            "X-Fintheon-Device": getDeviceId(),
          },
          body: JSON.stringify({ ids }),
        });
      } catch {
        // Best effort
      }
    },
    [getAccessToken],
  );

  const markAllRead = useCallback(async () => {
    const token = await getAccessToken();
    if (!token) return;
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, read: true, readAt: new Date().toISOString() })),
    );
    setUnreadCount(0);
    // [S25] Clear badge + notify SW so its local counter resets too
    void clearBadge();
    notifyServiceWorkerClear();
    try {
      await fetch(`${API_BASE}/api/notifications/history/mark-read`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "X-Fintheon-Device": getDeviceId(),
        },
        body: JSON.stringify({ all: true }),
      });
    } catch {
      // Best effort
    }
  }, [getAccessToken]);

  /** Soft-clear a single notification on the server. Other devices remove it via __sync. */
  const clearOne = useCallback(
    async (id: string) => {
      const token = await getAccessToken();
      if (!token) return;
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      setUnreadCount((c) => {
        const cleared = notifications.find((n) => n.id === id);
        return cleared && !cleared.read ? Math.max(0, c - 1) : c;
      });
      try {
        await fetch(`${API_BASE}/api/notifications/${id}/clear`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "X-Fintheon-Device": getDeviceId(),
          },
        });
      } catch {
        // Best effort
      }
    },
    [getAccessToken, notifications],
  );

  /** Clear-all on the server. Fans __sync so desktop + every other mobile clears too. */
  const clearAll = useCallback(async () => {
    const token = await getAccessToken();
    if (!token) return;
    setNotifications([]);
    setUnreadCount(0);
    void clearBadge();
    notifyServiceWorkerClear();
    try {
      await fetch(`${API_BASE}/api/notifications/clear-all`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "X-Fintheon-Device": getDeviceId(),
        },
      });
    } catch {
      // Best effort
    }
  }, [getAccessToken]);

  useEffect(() => {
    if (!user) return;
    fetchHistory();
    pollTimer.current = setInterval(fetchHistory, POLL_MS);
    const onVisibility = () => {
      if (document.visibilityState === "visible") fetchHistory();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [user, fetchHistory]);

  // [S35-Unified] Refetch instantly when the SW receives a __sync push from another device.
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.serviceWorker) return;
    const handler = (ev: MessageEvent) => {
      const data = ev.data as { type?: string; kind?: string } | null;
      if (!data || data.type !== "fintheon:sync") return;
      void fetchHistory();
    };
    navigator.serviceWorker.addEventListener("message", handler);
    return () =>
      navigator.serviceWorker.removeEventListener("message", handler);
  }, [fetchHistory]);

  return {
    notifications,
    unreadCount,
    isLoading,
    fetchHistory,
    markRead,
    markAllRead,
    clearOne,
    clearAll,
  };
}
