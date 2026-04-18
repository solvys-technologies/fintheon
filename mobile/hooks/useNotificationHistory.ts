// [claude-code 2026-04-18] A4: notification history fetch + unread tracking for NotificationBell
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../contexts/AuthContext";

const API_BASE = import.meta.env.VITE_API_URL || "";
const POLL_MS = 30_000;

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
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (!res.ok) return;
      const data = (await res.json()) as HistoryResponse;
      setNotifications(data.notifications ?? []);
      setUnreadCount(data.unreadCount ?? 0);
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
    try {
      await fetch(`${API_BASE}/api/notifications/history/mark-read`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ all: true }),
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

  return {
    notifications,
    unreadCount,
    isLoading,
    fetchHistory,
    markRead,
    markAllRead,
  };
}
