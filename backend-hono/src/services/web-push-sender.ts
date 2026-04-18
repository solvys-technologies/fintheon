// [claude-code 2026-04-18] S2: exported canDeliverToUser/meetsSeverityThreshold gates for emit.ts reuse
// [claude-code 2026-04-15] T7: Web push sending service — VAPID auth, category filtering, stale sub cleanup
import webpush from "web-push";
import { sql, isDatabaseAvailable } from "../config/database.js";
import { createLogger } from "../lib/logger.js";

const log = createLogger("WebPushSender");

const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY || "";
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || "";
const VAPID_SUBJECT =
  process.env.VAPID_SUBJECT || "mailto:admin@pricedinresearch.io";

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
  log.info("VAPID keys configured");
} else {
  log.warn("VAPID keys not set — web push disabled");
}

export interface PushPayload {
  title: string;
  body: string;
  category: string;
  url?: string;
  icon?: string;
  /** Optional conversation ID — consumed by service worker for deep-linking. */
  conversationId?: string;
}

export const SEVERITY_ORDER = ["low", "medium", "high", "critical"] as const;
export type Severity = (typeof SEVERITY_ORDER)[number];

export function meetsSeverityThreshold(
  itemSeverity: string,
  threshold: string,
): boolean {
  const itemIdx = SEVERITY_ORDER.indexOf(itemSeverity as Severity);
  const threshIdx = SEVERITY_ORDER.indexOf(threshold as Severity);
  return itemIdx >= threshIdx;
}

export function isPushEnabled(): boolean {
  return Boolean(VAPID_PUBLIC && VAPID_PRIVATE && isDatabaseAvailable());
}

async function deleteStaleSubscription(endpoint: string): Promise<void> {
  try {
    await sql`DELETE FROM web_push_subscriptions WHERE endpoint = ${endpoint}`;
    log.info("Deleted stale subscription", { endpoint: endpoint.slice(0, 60) });
  } catch (err) {
    log.warn("Failed to delete stale sub", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

async function sendOne(
  sub: { endpoint: string; keys: any },
  payload: PushPayload,
): Promise<void> {
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: sub.keys },
      JSON.stringify(payload),
    );
  } catch (err: any) {
    if (err?.statusCode === 410 || err?.statusCode === 404) {
      await deleteStaleSubscription(sub.endpoint);
    } else {
      log.warn("Push send failed", {
        endpoint: sub.endpoint.slice(0, 60),
        status: err?.statusCode,
        error: err?.message,
      });
    }
  }
}

/**
 * Check whether this user has at least one subscription that would accept
 * a push for the given category + severity. Used by emit.ts to decide
 * whether to mark a log row as `suppressed`.
 */
export async function canDeliverToUser(
  userId: string,
  category: string,
  severity?: string,
): Promise<boolean> {
  if (!isPushEnabled()) return false;
  const rows = await sql`
    SELECT severity_threshold
    FROM web_push_subscriptions
    WHERE user_id = ${userId}
      AND categories->>${category} = 'true'
  `;
  if (rows.length === 0) return false;
  if (!severity) return true;
  return rows.some((r: any) =>
    meetsSeverityThreshold(severity, r.severity_threshold),
  );
}

export async function sendToUser(
  userId: string,
  payload: PushPayload,
  severity?: string,
): Promise<void> {
  if (!isPushEnabled()) return;
  const rows = await sql`
    SELECT endpoint, keys, severity_threshold
    FROM web_push_subscriptions
    WHERE user_id = ${userId}
      AND categories->>${payload.category} = 'true'
  `;
  const eligible = severity
    ? rows.filter((r) => meetsSeverityThreshold(severity, r.severity_threshold))
    : rows;
  await Promise.all(eligible.map((r) => sendOne(r, payload)));
}

/**
 * Send to every active subscription for a user, bypassing category filtering.
 * Used for user-initiated signals (e.g. relay dispatch) where the user explicitly
 * asked for delivery — category filters are for ambient alerts, not user actions.
 */
export async function sendToUserDirect(
  userId: string,
  payload: PushPayload,
): Promise<number> {
  if (!isPushEnabled()) return 0;
  const rows = await sql`
    SELECT endpoint, keys
    FROM web_push_subscriptions
    WHERE user_id = ${userId}
  `;
  if (rows.length === 0) {
    log.info("No subscriptions for direct push", { userId });
    return 0;
  }
  await Promise.all(rows.map((r) => sendOne(r, payload)));
  return rows.length;
}

export async function sendToAllUsers(
  payload: PushPayload,
  severity?: string,
): Promise<void> {
  if (!isPushEnabled()) return;
  const rows = await sql`
    SELECT endpoint, keys, severity_threshold
    FROM web_push_subscriptions
    WHERE categories->>${payload.category} = 'true'
  `;
  const eligible = severity
    ? rows.filter((r) => meetsSeverityThreshold(severity, r.severity_threshold))
    : rows;

  // Concurrency limit: 10 at a time
  for (let i = 0; i < eligible.length; i += 10) {
    await Promise.all(
      eligible.slice(i, i + 10).map((r) => sendOne(r, payload)),
    );
  }
}

/**
 * Enumerate all user IDs with at least one subscription for this category.
 * Used by emit.ts when broadcasting (userId:"all") so we can create one
 * notifications-log row per subscribed user.
 */
export async function getSubscribedUserIds(
  category: string,
): Promise<string[]> {
  if (!isPushEnabled()) return [];
  const rows = await sql`
    SELECT DISTINCT user_id FROM web_push_subscriptions
    WHERE categories->>${category} = 'true'
  `;
  return rows.map((r: any) => String(r.user_id));
}
