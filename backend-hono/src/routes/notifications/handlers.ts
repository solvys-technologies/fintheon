// [claude-code 2026-04-18] Added history endpoint + bulk mark-read for mobile NotificationBell
/**
 * Notification Handlers
 * Request handlers for /api/notifications endpoints (in-app history + push log)
 */

import type { Context } from "hono";
import * as notificationService from "../../services/notification-service.js";
import { isDatabaseAvailable } from "../../config/database.js";

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
      return c.json({ success: true, markedCount: result.markedCount });
    }

    if (Array.isArray(body.ids) && body.ids.length > 0) {
      const result = await notificationService.markManyAsRead(userId, body.ids);
      return c.json({ success: true, markedCount: result.markedCount });
    }

    return c.json({ error: "Provide ids[] or all:true" }, 400);
  } catch (error) {
    console.error("[Notifications] Bulk mark read error:", error);
    return c.json({ error: "Failed to mark notifications as read" }, 500);
  }
}
