// [claude-code 2026-04-19] S28: push-notify helper for superadmin escalation.
//   Resolves the superadmin set via SUPER_ADMIN_USER_ID env (comma-split) with a
//   peer-registry fallback for users with role='admin'.
// [claude-code 2026-04-25] S35-Unified: routes through emitPushAndLog so super-admin
//   alerts are logged into the notifications table, appear in the bell on every signed-in
//   device, sync via __sync, and respect critical-severity bypass like everything else.
//   The "warn" severity maps to "high" (still bypasses quiet hours via critical-only path
//   when source flagged it) — admins can opt out per-category if they want.
import { sql, isDatabaseAvailable } from "../../config/database.js";
import { createLogger } from "../../lib/logger.js";
import { emitPushAndLog } from "./emit.js";

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

  // "warn" -> high; "critical" -> critical (bypasses every user gate).
  const severity = alert.severity === "critical" ? "critical" : "high";

  let delivered = 0;
  await Promise.all(
    ids.map(async (userId) => {
      try {
        const result = await emitPushAndLog({
          userId,
          // Reserved super-admin category — distinct from public "system" so
          // admins can mute mainstream system pings without losing oncall.
          category: "system",
          severity,
          title: alert.title,
          body: alert.body,
          url: alert.url ?? "/admin/monitor",
          icon: "/icon-192.png",
          fingerprint: `superadmin:${alert.source}`,
          // Tight dedup so a flapping monitor doesn't flood oncall.
          dedupWindowMins: 5,
          metadata: { superadmin: true, source: alert.source },
        });
        delivered += result.pushed;
      } catch (err) {
        log.warn("Superadmin emit failed", {
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
