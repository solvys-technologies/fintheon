// [claude-code 2026-04-25] S35-Unified: server-authoritative read of UserPreferences.notifications
// for delivery gating. Replaces the per-subscription quiet_hours JSONB metadata used pre-S35
// (which couldn't sync across devices because each device wrote to its own subscription row).
//
// Falls back to legacy web_push_subscriptions.categories.quietHours when user_preferences is empty
// so existing users don't lose their settings on rollout.

import { sql, isDatabaseAvailable } from "../../config/database.js";

export type Severity = "low" | "medium" | "high" | "critical";

export interface DeliveryPrefs {
  manualDnd: boolean;
  criticalOnly: boolean;
  econOnlyMode: boolean;
  severityThreshold: Severity;
  blockedCategories: Set<string>;
  /** Quiet hours window in ET, expressed as minutes since midnight. */
  quietStartMin: number;
  quietEndMin: number;
  quietEnabled: boolean;
  tz: string;
}

const DEFAULT_PREFS: DeliveryPrefs = {
  manualDnd: false,
  criticalOnly: false,
  econOnlyMode: false,
  severityThreshold: "medium",
  blockedCategories: new Set(),
  quietStartMin: 16 * 60, // 16:00 ET — close
  quietEndMin: 9 * 60 + 30, // 09:30 ET — open
  quietEnabled: true,
  tz: "America/New_York",
};

const SEVERITY_ORDER: Severity[] = ["low", "medium", "high", "critical"];
function severityIdx(s: string): number {
  return SEVERITY_ORDER.indexOf(s as Severity);
}

function hourToMin(h: number): number {
  if (!Number.isFinite(h)) return 0;
  const clamped = Math.max(0, Math.min(24, h));
  return Math.round(clamped * 60);
}

const cache = new Map<string, { prefs: DeliveryPrefs; expiresAt: number }>();
const CACHE_TTL_MS = 30_000;

async function loadFromUserPreferences(
  userId: string,
): Promise<DeliveryPrefs | null> {
  if (!isDatabaseAvailable() || !sql) return null;
  try {
    const rows = await sql`
      SELECT prefs FROM user_preferences WHERE user_id = ${userId} LIMIT 1
    `;
    if (rows.length === 0) return null;
    const prefs = rows[0].prefs as Record<string, unknown> | null;
    const notif = (prefs?.notifications ?? null) as Record<
      string,
      unknown
    > | null;
    if (!notif) return null;

    const startHour = Number(notif.quietFromEtHour);
    const endHour = Number(notif.quietToEtHour);
    const blocked = Array.isArray(notif.blockedCategories)
      ? (notif.blockedCategories as string[])
      : [];

    return {
      manualDnd: Boolean(notif.manualDnd),
      criticalOnly: Boolean(notif.criticalOnly),
      econOnlyMode: Boolean(notif.econOnlyMode),
      severityThreshold:
        typeof notif.severityThreshold === "string" &&
        severityIdx(notif.severityThreshold) >= 0
          ? (notif.severityThreshold as Severity)
          : DEFAULT_PREFS.severityThreshold,
      blockedCategories: new Set(blocked),
      quietStartMin: Number.isFinite(startHour)
        ? hourToMin(startHour)
        : DEFAULT_PREFS.quietStartMin,
      quietEndMin: Number.isFinite(endHour)
        ? hourToMin(endHour)
        : DEFAULT_PREFS.quietEndMin,
      // Quiet hours = enabled when rth is true AND extendedHours is false.
      // The trader prefers no pings outside RTH unless they explicitly opted in.
      quietEnabled: Boolean(notif.rth) && !notif.extendedHours,
      tz: DEFAULT_PREFS.tz,
    };
  } catch {
    return null;
  }
}

async function loadFromLegacySubscriptionMetadata(
  userId: string,
): Promise<DeliveryPrefs | null> {
  if (!isDatabaseAvailable() || !sql) return null;
  try {
    const rows = await sql`
      SELECT categories FROM web_push_subscriptions
      WHERE user_id = ${userId} LIMIT 1
    `;
    if (rows.length === 0) return null;
    const cats = rows[0].categories as Record<string, unknown> | null;
    const qh =
      cats && typeof cats === "object"
        ? ((cats as Record<string, unknown>).quietHours as
            | Record<string, unknown>
            | undefined)
        : undefined;
    if (!qh) return null;

    const start = typeof qh.start === "string" ? qh.start : "";
    const end = typeof qh.end === "string" ? qh.end : "";
    const m1 = /^(\d{1,2}):(\d{2})$/.exec(start.trim());
    const m2 = /^(\d{1,2}):(\d{2})$/.exec(end.trim());
    return {
      ...DEFAULT_PREFS,
      blockedCategories: new Set(),
      quietEnabled: qh.enabled !== false,
      quietStartMin: m1
        ? Number(m1[1]) * 60 + Number(m1[2])
        : DEFAULT_PREFS.quietStartMin,
      quietEndMin: m2
        ? Number(m2[1]) * 60 + Number(m2[2])
        : DEFAULT_PREFS.quietEndMin,
      tz: typeof qh.tz === "string" ? qh.tz : DEFAULT_PREFS.tz,
    };
  } catch {
    return null;
  }
}

export async function getDeliveryPrefs(userId: string): Promise<DeliveryPrefs> {
  const cached = cache.get(userId);
  if (cached && cached.expiresAt > Date.now()) return cached.prefs;

  const fromPrefs = await loadFromUserPreferences(userId);
  const prefs =
    fromPrefs ??
    (await loadFromLegacySubscriptionMetadata(userId)) ??
    DEFAULT_PREFS;

  cache.set(userId, { prefs, expiresAt: Date.now() + CACHE_TTL_MS });
  return prefs;
}

/** Tests evict between cases. */
export function _clearDeliveryPrefsCache(): void {
  cache.clear();
}

function minutesInTZ(date: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  const hh = h === 24 ? 0 : h;
  return hh * 60 + m;
}

/**
 * Centralized deliver-or-suppress decision used by emit.ts.
 * Returns { allow: false, reason } when the push should be suppressed.
 *
 * Order matters — we check the cheapest gate first and return the first hit
 * so observability (`reasons` counter) tells you the *primary* cause.
 */
export async function evaluateDeliveryGates(
  userId: string,
  category: string,
  severity: Severity,
): Promise<{ allow: boolean; reason?: string }> {
  const prefs = await getDeliveryPrefs(userId);

  if (severity === "critical") {
    // Critical bypasses every user gate by design — margin calls, system-down.
    return { allow: true };
  }

  // econOnlyMode: hard mute every channel except econ_alerts. Lets the user keep
  // calendar pings without listening to riskflow / regime / brief noise.
  if (prefs.econOnlyMode && category !== "econ_alerts") {
    return { allow: false, reason: "econ-only-mode" };
  }

  if (prefs.blockedCategories.has(category)) {
    return { allow: false, reason: "category-blocked" };
  }

  const itemIdx = severityIdx(severity);
  const threshIdx = severityIdx(prefs.severityThreshold);
  if (itemIdx < threshIdx) {
    return { allow: false, reason: "severity-threshold" };
  }

  if (prefs.criticalOnly) {
    // already returned for critical above; anything else fails here
    return { allow: false, reason: "critical-only" };
  }

  if (prefs.manualDnd) {
    return { allow: false, reason: "manual-dnd" };
  }

  if (prefs.quietEnabled) {
    const now = minutesInTZ(new Date(), prefs.tz);
    const { quietStartMin: s, quietEndMin: e } = prefs;
    let inQuiet = false;
    if (s !== e) {
      if (s > e) inQuiet = now >= s || now < e;
      else inQuiet = now >= s && now < e;
    }
    if (inQuiet) return { allow: false, reason: "quiet-hours" };
  }

  return { allow: true };
}
