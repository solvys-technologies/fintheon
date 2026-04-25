// [claude-code 2026-04-19] S28: push-notify helper for superadmin escalation.
//   Resolves the superadmin set via SUPER_ADMIN_USER_ID env (comma-split) with a
//   peer-registry fallback for users with role='admin'. Fans out via sendToUserDirect
//   so category gating doesn't silently suppress critical alerts — superadmins having
//   *any* subscription = they want these.
import { sendToUserDirect, type PushPayload } from "../web-push-sender.js";
import { sql, isDatabaseAvailable } from "../../config/database.js";
import { createLogger } from "../../lib/logger.js";

const log = createLogger("NotifySuperadmins");

async function resolveSuperadminIds(): Promise<string[]> {
  const envAllow = (process.env.SUPER_ADMIN_USER_ID || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (envAllow.length > 0) return envAllow;

  if (!isDatabaseAvailable()) return [];
  try {
    const rows = await sql`SELECT id FROM users WHERE role = 'admin'`;
    return rows.map((r: { id: string }) => String(r.id));
  } catch (err) {
    log.warn("Failed to resolve admin users", { error: String(err) });
    return [];
  }
}

export interface SuperadminAlert {
  title: string;
  body: string;
  severity: "warn" | "critical";
  /** e.g. "riskflow-worker-audit-morning" — lets the SW dedupe + badge correctly. */
  source: string;
  /** Optional deep-link target in Fintheon Mobile (e.g. /admin/monitor). */
  url?: string;
}

export async function notifySuperadmins(
  alert: SuperadminAlert,
): Promise<{ recipients: number; delivered: number }> {
  const ids = await resolveSuperadminIds();
  if (ids.length === 0) {
    log.info("No superadmins resolved — skipping push", {
      source: alert.source,
    });
    return { recipients: 0, delivered: 0 };
  }

  const payload: PushPayload = {
    title: alert.title,
    body: alert.body,
    category: "system_health",
    url: alert.url ?? "/admin/monitor",
    icon: "/icon-192.png",
  };

  let delivered = 0;
  await Promise.all(
    ids.map(async (userId) => {
      try {
        const sent = await sendToUserDirect(userId, payload);
        delivered += sent;
      } catch (err) {
        log.warn("Push to superadmin failed", {
          userId,
          error: String(err),
        });
      }
    }),
  );

  log.info("Superadmin push dispatched", {
    source: alert.source,
    severity: alert.severity,
    recipients: ids.length,
    delivered,
  });

  return { recipients: ids.length, delivered };
}
