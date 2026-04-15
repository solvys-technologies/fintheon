// [claude-code 2026-04-15] T7: Push notification lifecycle hook
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useSettings } from "../contexts/SettingsContext";
import {
  getPermissionStatus,
  subscribeToPush,
  unsubscribeFromPush,
  updateCategories,
} from "../lib/push";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";

export function usePushNotifications() {
  const { getAccessToken } = useAuth();
  const { settings } = useSettings();
  const [permissionStatus, setPermissionStatus] = useState<
    NotificationPermission | "unsupported"
  >(getPermissionStatus());
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setPermissionStatus(getPermissionStatus());
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.ready.then(async (reg) => {
        const sub = await reg.pushManager.getSubscription();
        setIsSubscribed(!!sub);
      });
    }
  }, []);

  const enable = useCallback(async () => {
    setIsLoading(true);
    try {
      const token = await getAccessToken();
      if (!token) return;
      const { severityThreshold: _, ...cats } = settings.notificationPrefs;
      const ok = await subscribeToPush(token, cats);
      setIsSubscribed(ok);
      setPermissionStatus(getPermissionStatus());
    } finally {
      setIsLoading(false);
    }
  }, [getAccessToken, settings.notificationPrefs]);

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

  const sendTestNotification = useCallback(async () => {
    const token = await getAccessToken();
    if (!token) return;
    await fetch(`${API_BASE}/api/notifications/web-push/test`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
  }, [getAccessToken]);

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
