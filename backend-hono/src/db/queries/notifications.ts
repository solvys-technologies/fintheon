// [claude-code 2026-04-18] Extended for emit.ts: category/severity/url/fingerprint/suppressed + dedup lookup
/**
 * Notifications Database Queries
 * CRUD operations for user notifications (in-app history + push log)
 */

import { sql, isDatabaseAvailable } from "../../config/database.js";
import type {
  Notification,
  NotificationInsert,
} from "../../types/notifications.js";

export async function getNotificationsByUserId(
  userId: string,
  limit = 50,
  unreadOnly = false,
): Promise<Notification[]> {
  if (!isDatabaseAvailable() || !sql) return [];

  const result = unreadOnly
    ? await sql`
        SELECT * FROM notifications
        WHERE user_id = ${userId} AND read = false AND suppressed = false
        ORDER BY created_at DESC
        LIMIT ${limit}
      `
    : await sql`
        SELECT * FROM notifications
        WHERE user_id = ${userId} AND suppressed = false
        ORDER BY created_at DESC
        LIMIT ${limit}
      `;

  return result.map(mapRowToNotification);
}

export async function getUnreadCount(userId: string): Promise<number> {
  if (!isDatabaseAvailable() || !sql) return 0;

  const result = await sql`
    SELECT COUNT(*) as count FROM notifications
    WHERE user_id = ${userId} AND read = false AND suppressed = false
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

export async function markManyAsRead(
  userId: string,
  ids: string[],
): Promise<number> {
  if (!isDatabaseAvailable() || !sql || ids.length === 0) return 0;

  const result = await sql`
    UPDATE notifications
    SET read = true, read_at = NOW()
    WHERE user_id = ${userId} AND id = ANY(${ids}::uuid[])
    RETURNING id
  `;

  return result.length;
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

export async function insertNotification(
  input: NotificationInsert,
): Promise<Notification | null> {
  if (!isDatabaseAvailable() || !sql) return null;

  const result = await sql`
    INSERT INTO notifications (
      user_id, category, severity, title, body, url,
      fingerprint, event_id, suppressed, metadata
    ) VALUES (
      ${input.userId},
      ${input.category},
      ${input.severity},
      ${input.title},
      ${input.body},
      ${input.url ?? null},
      ${input.fingerprint ?? null},
      ${input.eventId ?? null},
      ${input.suppressed ?? false},
      ${JSON.stringify(input.metadata ?? {})}::jsonb
    )
    RETURNING *
  `;

  if (result.length === 0) return null;
  return mapRowToNotification(result[0]);
}

/**
 * Dedup lookup — returns true if a non-suppressed notification with the same
 * fingerprint fired for this user within the last `windowMins` minutes.
 * Used by emit.ts to collapse duplicate RiskFlow headlines.
 */
export async function hasRecentFingerprint(
  userId: string,
  fingerprint: string,
  windowMins = 30,
): Promise<boolean> {
  if (!isDatabaseAvailable() || !sql) return false;

  const result = await sql`
    SELECT 1 FROM notifications
    WHERE user_id = ${userId}
      AND fingerprint = ${fingerprint}
      AND suppressed = false
      AND created_at > NOW() - (${windowMins} || ' minutes')::interval
    LIMIT 1
  `;

  return result.length > 0;
}

function mapRowToNotification(row: Record<string, unknown>): Notification {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    category: String(row.category || "system"),
    severity: String(row.severity || "medium") as Notification["severity"],
    title: String(row.title || ""),
    body: String(row.body || ""),
    url: row.url ? String(row.url) : undefined,
    fingerprint: row.fingerprint ? String(row.fingerprint) : undefined,
    eventId: row.event_id ? String(row.event_id) : undefined,
    suppressed: Boolean(row.suppressed),
    metadata: row.metadata as Record<string, unknown> | undefined,
    read: Boolean(row.read),
    createdAt: new Date(row.created_at as string),
    readAt: row.read_at ? new Date(row.read_at as string) : undefined,
  };
}
