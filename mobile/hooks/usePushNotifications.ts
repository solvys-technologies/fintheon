// [claude-code 2026-04-15] T7: Push notification lifecycle hook
// [claude-code 2026-04-17] enable() returns ok/failure so UI can surface errors; sendTestNotification returns structured result
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useSettings } from "../contexts/SettingsContext";
import { NOTIFICATION_CATEGORIES } from "../lib/user-preferences";
import {
  getPermissionStatus,
  subscribeToPush,
  unsubscribeFromPush,
  updateCategories,
} from "../lib/push";

const API_BASE = import.meta.env.VITE_API_URL || "";

export type EnableResult =
  | { ok: true }
  | {
      ok: false;
      reason:
        | "no-token"
        | "permission-denied"
        | "subscribe-failed"
        | "unsupported";
    };

export type TestResult =
  | { ok: true }
  | {
      ok: false;
      reason:
        | "no-token"
        | "not-subscribed"
        | "permission-denied"
        | "network"
        | string;
    };

function categoriesFromPreferences(
  notifications: ReturnType<typeof useSettings>["preferences"]["notifications"],
  forcePushEnabled = false,
): Record<string, boolean> {
  const blocked = new Set(notifications.blockedCategories ?? []);
  const pushEnabled =
    forcePushEnabled || notifications.deliveryChannels?.push === true;
  return Object.fromEntries(
    NOTIFICATION_CATEGORIES.map((category) => [
      category,
      pushEnabled && !blocked.has(category),
    ]),
  );
}

export function usePushNotifications() {
  const { getAccessToken } = useAuth();
  const { preferences } = useSettings();
  const [permissionStatus, setPermissionStatus] = useState<
    NotificationPermission | "unsupported"
  >(getPermissionStatus());
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setPermissionStatus(getPermissionStatus());
    if ("serviceWorker" in navigator && "PushManager" in window) {
      navigator.serviceWorker.ready
        .then(async (reg) => {
          try {
            const sub = await reg.pushManager.getSubscription();
            setIsSubscribed(!!sub);
          } catch {
            // pushManager not available (iOS Safari, insecure context, etc.)
          }
        })
        .catch(() => {
          // Service worker not registered
        });
    }
  }, []);

  const enable = useCallback(async (): Promise<EnableResult> => {
    setIsLoading(true);
    try {
      if (
        !("serviceWorker" in navigator) ||
        !("PushManager" in window) ||
        !("Notification" in window)
      ) {
        return { ok: false, reason: "unsupported" };
      }
      const token = await getAccessToken();
      if (!token) return { ok: false, reason: "no-token" };
      const ok = await subscribeToPush(
        token,
        categoriesFromPreferences(preferences.notifications, true),
        preferences.notifications.severityThreshold,
      );
      setPermissionStatus(getPermissionStatus());
      if (!ok) {
        setIsSubscribed(false);
        if (getPermissionStatus() === "denied")
          return { ok: false, reason: "permission-denied" };
        return { ok: false, reason: "subscribe-failed" };
      }
      setIsSubscribed(true);
      return { ok: true };
    } finally {
      setIsLoading(false);
    }
  }, [getAccessToken, preferences.notifications]);

  const disable = useCallback(async () => {
    setIsLoading(true);
    try {
      const token = await getAccessToken();
      if (!token) return;
      await unsubscribeFromPush(token);
      setIsSubscribed(false);
    } finally {
      setIsLoading(false);
    }
  }, [getAccessToken]);

  const syncCategories = useCallback(
    async (cats: Record<string, boolean>, severity?: string) => {
      const token = await getAccessToken();
      if (!token) return;
      await updateCategories(token, cats, severity);
    },
    [getAccessToken],
  );

  const sendTestNotification = useCallback(async (): Promise<TestResult> => {
    if (!("Notification" in window)) {
      return { ok: false, reason: "permission-denied" };
    }
    if (Notification.permission !== "granted") {
      return { ok: false, reason: "permission-denied" };
    }
    if (!isSubscribed) {
      return { ok: false, reason: "not-subscribed" };
    }
    const token = await getAccessToken();
    if (!token) return { ok: false, reason: "no-token" };

    try {
      const res = await fetch(`${API_BASE}/api/notifications/web-push/test`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        return {
          ok: false,
          reason: `http-${res.status}${body ? `: ${body.slice(0, 80)}` : ""}`,
        };
      }
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        reason: err instanceof Error ? err.message : "network",
      };
    }
  }, [getAccessToken, isSubscribed]);

  return {
    permissionStatus,
    isSubscribed,
    isLoading,
    enable,
    disable,
    syncCategories,
    sendTestNotification,
  };
}
