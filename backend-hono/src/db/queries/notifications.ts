/**
 * Notifications Database Queries
 * CRUD operations for user notifications
 */

import { sql, isDatabaseAvailable } from "../../config/database.js";
import type {
  Notification,
  NotificationType,
  NotificationPriority,
} from "../../types/notifications.js";

export async function getNotificationsByUserId(
  userId: string,
  limit = 50,
): Promise<Notification[]> {
  if (!isDatabaseAvailable() || !sql) return [];

  const result = await sql`
    SELECT * FROM notifications 
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;

  return result.map(mapRowToNotification);
}

export async function getUnreadCount(userId: string): Promise<number> {
  if (!isDatabaseAvailable() || !sql) return 0;

  const result = await sql`
    SELECT COUNT(*) as count FROM notifications
    WHERE user_id = ${userId} AND read = false
  `;

  return Number(result[0]?.count) || 0;
}

export async function markAsRead(
  userId: string,
  notificationId: string,
): Promise<Notification | null> {
  if (!isDatabaseAvailable() || !sql) return null;

  const result = await sql`
    UPDATE notifications
    SET read = true, read_at = NOW()
    WHERE id = ${notificationId} AND user_id = ${userId}
    RETURNING *
  `;

  if (result.length === 0) return null;
  return mapRowToNotification(result[0]);
}

export async function markAllAsRead(userId: string): Promise<number> {
  if (!isDatabaseAvailable() || !sql) return 0;

  const result = await sql`
    UPDATE notifications
    SET read = true, read_at = NOW()
    WHERE user_id = ${userId} AND read = false
    RETURNING id
  `;

  return result.length;
}

function mapRowToNotification(row: Record<string, unknown>): Notification {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    type: (row.type as NotificationType) || "system",
    title: String(row.title || ""),
    message: String(row.message || ""),
    priority: (row.priority as NotificationPriority) || "medium",
    isRead: Boolean(row.read),
    metadata: row.metadata as Record<string, unknown> | undefined,
    createdAt: new Date(row.created_at as string),
    readAt: row.read_at ? new Date(row.read_at as string) : undefined,
  };
}
