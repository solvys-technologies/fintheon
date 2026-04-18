// [claude-code 2026-04-18] Extended for unified push+history table; added insert + bulk mark-read + dedup lookup
/**
 * Notification Service
 * Business logic for notification operations (in-app history + push log)
 */

import * as notificationQueries from "../db/queries/notifications.js";
import type {
  Notification,
  NotificationInsert,
  NotificationListResponse,
} from "../types/notifications.js";

export async function getNotifications(
  userId: string,
  limit = 50,
  unreadOnly = false,
): Promise<NotificationListResponse> {
  const notifications = await notificationQueries.getNotificationsByUserId(
    userId,
    limit,
    unreadOnly,
  );
  const unreadCount = await notificationQueries.getUnreadCount(userId);

  return {
    notifications,
    total: notifications.length,
    unreadCount,
  };
}

export async function markAsRead(
  userId: string,
  notificationId: string,
): Promise<Notification | null> {
  return notificationQueries.markAsRead(userId, notificationId);
}

export async function markManyAsRead(
  userId: string,
  ids: string[],
): Promise<{ markedCount: number }> {
  const count = await notificationQueries.markManyAsRead(userId, ids);
  return { markedCount: count };
}

export async function markAllAsRead(
  userId: string,
): Promise<{ markedCount: number }> {
  const count = await notificationQueries.markAllAsRead(userId);
  return { markedCount: count };
}

export async function insertNotification(
  input: NotificationInsert,
): Promise<Notification | null> {
  return notificationQueries.insertNotification(input);
}

export async function hasRecentFingerprint(
  userId: string,
  fingerprint: string,
  windowMins = 30,
): Promise<boolean> {
  return notificationQueries.hasRecentFingerprint(
    userId,
    fingerprint,
    windowMins,
  );
}
