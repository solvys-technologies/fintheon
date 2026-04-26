// [claude-code 2026-04-19] S24-T1: added V4 categories (regimeProposals, lexiconProposals, walkBackReverts). Critical severity already bypasses quiet hours.
// [claude-code 2026-04-18] S2: unified emit helper — always log, push only if subscribed+allowed+not-suppressed
// [claude-code 2026-04-25] S35-Unified: delivery gate now reads server-side user_preferences
//   (manualDnd, blockedCategories, severityThreshold, quietHours) so prefs sync across devices.
//   Critical bypasses all gates; everything else routes through evaluateDeliveryGates.
/**
 * Notification emit helper
 *
 * Every trigger funnels through `emitPushAndLog`. Invariants:
 *   1. Always write a `notifications` row (per-user) so the in-app bell shows it.
 *   2. Only call web-push-sender if user is subscribed, category is on,
 *      severity >= threshold, not in quiet hours, and fingerprint didn't
 *      dedup within the cooldown window.
 *   3. Suppressed pushes are recorded with suppressed=true for observability.
 */

import { createLogger } from "../../lib/logger.js";
import {
  sendToUser,
  canDeliverToUser,
  getSubscribedUserIds,
  isPushEnabled,
  type PushPayload,
  type Severity,
} from "../web-push-sender.js";
import {
  insertNotification,
  hasRecentFingerprint,
} from "../notification-service.js";
import { evaluateDeliveryGates } from "./user-prefs-gate.js";

const log = createLogger("NotifEmit");

const TITLE_MAX = 50;
const BODY_MAX = 120;
const DEFAULT_DEDUP_WINDOW_MINS = 30;

/**
 * Registered notification categories. Adding a category here is the contract —
 * mobile SettingsContext defaults and web_push_subscriptions.categories JSONB
 * should mirror this list.
 *
 * S24-T1 additions: regimeProposals, lexiconProposals, walkBackReverts. All
 * three default to severity="high" (respects quiet hours); pass severity="critical"
 * only for L10 matrix flips, which bypass quiet hours via the gate below.
 */
export const NOTIFICATION_CATEGORIES = [
  "riskflow",
  "dailyBrief",
  "regimeActivations",
  "regimeProposals",
  "lexiconProposals",
  "walkBackReverts",
  "toolApprovals",
  // [S26-P2 T9] Agent-proposed maintenance requests — super-admin commit/deploy/deny.
  "maintenance_request",
  "chat_relay",
  // [S35-Unified] Economic-event alerts (FOMC/CPI/NFP/etc.) — distinct from riskflow so
  //   users can mute speculative riskflow chatter while keeping calendar pings, or vice versa.
  "econ_alerts",
  "test",
  "system",
] as const;
export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

function clamp(s: string, max: number): string {
  if (!s) return "";
  return s.length > max ? s.slice(0, max - 1).trimEnd() + "…" : s;
}

export interface EmitInput {
  /** Target user ID, or "all" to broadcast to every subscribed user. */
  userId: string | "all";
  category: string;
  severity: Severity;
  title: string;
  body: string;
  url?: string;
  icon?: string;
  conversationId?: string;
  /** Dedup key. Same fingerprint in last `dedupWindowMins` skips push. */
  fingerprint?: string;
  /** Optional upstream event id for traceability. */
  eventId?: string;
  /** Override cooldown window (minutes). */
  dedupWindowMins?: number;
  metadata?: Record<string, unknown>;
  /** [S25] SOTA additions — optional hero image, lock-screen actions, badge bump, item id, approval id. */
  image?: string;
  actions?: Array<{ action: string; title: string; icon?: string }>;
  badge?: number;
  itemId?: string;
  approvalId?: string;
}

export interface EmitResult {
  logged: number;
  pushed: number;
  suppressed: number;
  reasons: Record<string, number>;
}

async function emitForSingleUser(
  userId: string,
  input: EmitInput,
): Promise<{ pushed: boolean; reason?: string }> {
  const title = clamp(input.title, TITLE_MAX);
  const body = clamp(input.body, BODY_MAX);
  const dedupWindow = input.dedupWindowMins ?? DEFAULT_DEDUP_WINDOW_MINS;

  // --- Decide: push or suppress? ---
  let shouldPush = true;
  let reason: string | undefined;

  if (!isPushEnabled()) {
    shouldPush = false;
    reason = "push-disabled";
  } else if (input.fingerprint) {
    const recent = await hasRecentFingerprint(
      userId,
      input.fingerprint,
      dedupWindow,
    );
    if (recent) {
      shouldPush = false;
      reason = "dedup";
    }
  }

  if (shouldPush) {
    // First gate: does the user have *any* subscription for this category?
    // (web_push_subscriptions.categories drives per-device channel subscription.)
    const can = await canDeliverToUser(userId, input.category, input.severity);
    if (!can) {
      shouldPush = false;
      reason = "category-or-severity";
    }
  }

  if (shouldPush) {
    // Second gate: server-authoritative user preferences (DND, blocklist,
    // severity floor, quiet hours). Critical severity bypasses all of these
    // by design — handled inside evaluateDeliveryGates.
    const verdict = await evaluateDeliveryGates(
      userId,
      input.category,
      input.severity,
    );
    if (!verdict.allow) {
      shouldPush = false;
      reason = verdict.reason ?? "blocked";
    }
  }

  // --- Log (always) ---
  await insertNotification({
    userId,
    category: input.category,
    severity: input.severity,
    title,
    body,
    url: input.url,
    fingerprint: input.fingerprint,
    eventId: input.eventId,
    suppressed: !shouldPush,
    metadata: input.metadata,
  }).catch((err) => {
    log.warn("Log insert failed", {
      userId,
      error: err instanceof Error ? err.message : String(err),
    });
  });

  // --- Push (if cleared) ---
  if (shouldPush) {
    const payload: PushPayload = {
      title,
      body,
      category: input.category,
      url: input.url,
      icon: input.icon,
      conversationId: input.conversationId,
      image: input.image,
      actions: input.actions,
      badge: input.badge,
      itemId: input.itemId,
      approvalId: input.approvalId,
    };
    try {
      await sendToUser(userId, payload, input.severity);
      return { pushed: true };
    } catch (err) {
      log.warn("Push send failed", {
        userId,
        error: err instanceof Error ? err.message : String(err),
      });
      return { pushed: false, reason: "send-error" };
    }
  }

  return { pushed: false, reason };
}

export async function emitPushAndLog(input: EmitInput): Promise<EmitResult> {
  const result: EmitResult = {
    logged: 0,
    pushed: 0,
    suppressed: 0,
    reasons: {},
  };

  const targetIds: string[] =
    input.userId === "all"
      ? await getSubscribedUserIds(input.category)
      : [input.userId];

  if (targetIds.length === 0) {
    return result;
  }

  // Concurrency limit: 10 at a time
  for (let i = 0; i < targetIds.length; i += 10) {
    const batch = targetIds.slice(i, i + 10);
    const outcomes = await Promise.all(
      batch.map((uid) => emitForSingleUser(uid, input)),
    );
    for (const o of outcomes) {
      result.logged++;
      if (o.pushed) {
        result.pushed++;
      } else {
        result.suppressed++;
        if (o.reason) {
          result.reasons[o.reason] = (result.reasons[o.reason] ?? 0) + 1;
        }
      }
    }
  }

  log.info("emit.done", {
    category: input.category,
    severity: input.severity,
    ...result,
  });
  return result;
}
