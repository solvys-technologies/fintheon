// [claude-code 2026-04-18] Added history endpoint + bulk mark-read for mobile NotificationBell
// [claude-code 2026-04-25] S35-Unified: clear-one / clear-all endpoints + cross-device sync broadcast
/**
 * Notification Handlers
 * Request handlers for /api/notifications endpoints (in-app history + push log)
 */

import type { Context } from "hono";
import * as notificationService from "../../services/notification-service.js";
import { isDatabaseAvailable } from "../../config/database.js";
import { broadcastSyncToUser } from "../../services/notifications/sync-broadcast.js";

/**
 * Receivers identify their own actions via the X-Fintheon-Device header (a stable
 * SW-registration-derived hash). Falls back to null which means "every other device
 * including this one will refetch" — safe but wasteful.
 */
function deviceHeader(c: Context): string | null {
  const raw = c.req.header("x-fintheon-device");
  if (!raw) return null;
  // Trim to a sane length; the header is opaque to the server.
  return raw.slice(0, 200);
}

export async function handleGetNotifications(c: Context) {
  const userId = c.get("userId") as string | undefined;
  if (!userId) return c.json({ error: "Unauthorized" }, 401);

  if (!isDatabaseAvailable()) {
    return c.json({ notifications: [], total: 0, unreadCount: 0 });
  }

  try {
    const limit = Number(c.req.query("limit")) || 50;
    const unreadOnly = c.req.query("unreadOnly") === "true";
    const notifications = await notificationService.getNotifications(
      userId,
      limit,
      unreadOnly,
    );
    return c.json(notifications);
  } catch {
    return c.json({ notifications: [], total: 0, unreadCount: 0 });
  }
}

export async function handleMarkAsRead(c: Context) {
  const userId = c.get("userId") as string | undefined;
  const notificationId = c.req.param("id");
  if (!userId) return c.json({ error: "Unauthorized" }, 401);
  if (!notificationId)
    return c.json({ error: "Notification ID is required" }, 400);

  try {
    const notification = await notificationService.markAsRead(
      userId,
      notificationId,
    );
    if (!notification) return c.json({ error: "Notification not found" }, 404);

    void broadcastSyncToUser(userId, {
      kind: "notification.read",
      id: notificationId,
      originEndpoint: deviceHeader(c) ?? undefined,
    }).catch(() => {});

    return c.json({ success: true, notification });
  } catch (error) {
    console.error("[Notifications] Mark read error:", error);
    return c.json({ error: "Failed to mark notification as read" }, 500);
  }
}

export async function handleMarkAllAsRead(c: Context) {
  const userId = c.get("userId") as string | undefined;
  if (!userId) return c.json({ error: "Unauthorized" }, 401);

  try {
    const result = await notificationService.markAllAsRead(userId);

    if (result.markedCount > 0) {
      void broadcastSyncToUser(userId, {
        kind: "notifications.read_all",
        originEndpoint: deviceHeader(c) ?? undefined,
      }).catch(() => {});
    }

    return c.json({ success: true, markedCount: result.markedCount });
  } catch (error) {
    console.error("[Notifications] Mark all read error:", error);
    return c.json({ error: "Failed to mark all notifications as read" }, 500);
  }
}

/**
 * POST /api/notifications/history/mark-read
 * Body: { ids?: string[]; all?: boolean }
 * Bulk mark-read for NotificationDrawer.
 */
export async function handleMarkReadBulk(c: Context) {
  const userId = c.get("userId") as string | undefined;
  if (!userId) return c.json({ error: "Unauthorized" }, 401);

  try {
    const body = (await c.req.json().catch(() => ({}))) as {
      ids?: string[];
      all?: boolean;
    };

    if (body.all) {
      const result = await notificationService.markAllAsRead(userId);
      if (result.markedCount > 0) {
        void broadcastSyncToUser(userId, {
          kind: "notifications.read_all",
          originEndpoint: deviceHeader(c) ?? undefined,
        }).catch(() => {});
      }
      return c.json({ success: true, markedCount: result.markedCount });
    }

    if (Array.isArray(body.ids) && body.ids.length > 0) {
      const result = await notificationService.markManyAsRead(userId, body.ids);
      if (result.markedCount > 0) {
        void broadcastSyncToUser(userId, {
          kind: "notifications.read_all",
          originEndpoint: deviceHeader(c) ?? undefined,
        }).catch(() => {});
      }
      return c.json({ success: true, markedCount: result.markedCount });
    }

    return c.json({ error: "Provide ids[] or all:true" }, 400);
  } catch (error) {
    console.error("[Notifications] Bulk mark read error:", error);
    return c.json({ error: "Failed to mark notifications as read" }, 500);
  }
}

/**
 * POST /api/notifications/:id/clear — soft-dismiss a single notification.
 * Sets cleared_at, fans __sync to other devices.
 */
export async function handleClearOne(c: Context) {
  const userId = c.get("userId") as string | undefined;
  const notificationId = c.req.param("id");
  if (!userId) return c.json({ error: "Unauthorized" }, 401);
  if (!notificationId)
    return c.json({ error: "Notification ID is required" }, 400);

  try {
    const device = deviceHeader(c);
    const cleared = await notificationService.clearOne(
      userId,
      notificationId,
      device,
    );
    if (!cleared) return c.json({ error: "Notification not found" }, 404);

    void broadcastSyncToUser(userId, {
      kind: "notification.cleared",
      id: notificationId,
      originEndpoint: device ?? undefined,
    }).catch(() => {});

    return c.json({ success: true, notification: cleared });
  } catch (error) {
    console.error("[Notifications] Clear error:", error);
    return c.json({ error: "Failed to clear notification" }, 500);
  }
}

/**
 * POST /api/notifications/clear-all — soft-dismiss every active notification.
 * Body is ignored.
 */
export async function handleClearAll(c: Context) {
  const userId = c.get("userId") as string | undefined;
  if (!userId) return c.json({ error: "Unauthorized" }, 401);

  try {
    const device = deviceHeader(c);
    const result = await notificationService.clearAll(userId, device);

    if (result.clearedCount > 0) {
      void broadcastSyncToUser(userId, {
        kind: "notifications.cleared_all",
        originEndpoint: device ?? undefined,
      }).catch(() => {});
    }

    return c.json({ success: true, clearedCount: result.clearedCount });
  } catch (error) {
    console.error("[Notifications] Clear all error:", error);
    return c.json({ error: "Failed to clear notifications" }, 500);
  }
}
