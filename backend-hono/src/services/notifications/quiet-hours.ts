// [claude-code 2026-04-18] A5 quiet hours gate — reads per-user prefs from web_push_subscriptions.categories metadata
/**
 * Quiet hours gate
 *
 * Users can set a daily window (default 22:00–07:00 ET) during which only
 * `critical` severity pushes go through. Preferences live on the
 * web_push_subscriptions row in a `quiet_hours` JSONB column — added opportunistically
 * by the /preferences PATCH endpoint; read here with a safe fallback.
 */

import { sql, isDatabaseAvailable } from "../../config/database.js";

interface QuietHoursPref {
  enabled: boolean;
  // Minutes past midnight in the `tz` timezone (default America/New_York).
  startMin: number;
  endMin: number;
  tz?: string;
}

const DEFAULT_TZ = "America/New_York";

function parseHHMM(value: string | null | undefined): number | null {
  if (!value) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min)) return null;
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

function minutesInTZ(date: Date, tz: string): number {
  // Robust HH:mm extraction in a target timezone via Intl.DateTimeFormat
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  // Intl sometimes emits "24" for midnight — normalize.
  const hh = h === 24 ? 0 : h;
  return hh * 60 + m;
}

async function loadPref(userId: string): Promise<QuietHoursPref | null> {
  if (!isDatabaseAvailable()) return null;
  try {
    // quiet_hours may not exist on older rows; coerce safely.
    const rows = await sql`
      SELECT categories
      FROM web_push_subscriptions
      WHERE user_id = ${userId}
      LIMIT 1
    `;
    if (rows.length === 0) return null;
    const cats = rows[0].categories as Record<string, unknown> | null;
    const qh =
      cats && typeof cats === "object" ? (cats as any).quietHours : null;
    if (!qh || typeof qh !== "object") return null;

    const enabled = Boolean(qh.enabled);
    const startMin = parseHHMM(qh.start) ?? 22 * 60;
    const endMin = parseHHMM(qh.end) ?? 7 * 60;
    const tz = typeof qh.tz === "string" ? qh.tz : DEFAULT_TZ;
    return { enabled, startMin, endMin, tz };
  } catch {
    return null;
  }
}

export async function isInQuietHours(userId: string): Promise<boolean> {
  const pref = await loadPref(userId);
  if (!pref || !pref.enabled) return false;

  const now = minutesInTZ(new Date(), pref.tz ?? DEFAULT_TZ);
  const { startMin, endMin } = pref;
  if (startMin === endMin) return false;

  // Overnight window (e.g. 22:00 → 07:00): inside if now >= start OR now < end
  if (startMin > endMin) return now >= startMin || now < endMin;
  // Same-day window (e.g. 13:00 → 15:00): inside if start <= now < end
  return now >= startMin && now < endMin;
}
