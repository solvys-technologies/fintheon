// [claude-code 2026-04-25] S35-T10 sunset checker — fires once on/after 2026-05-08 to
//   surface that the news-worker → riskflow-worker dual-emit aliases are due for removal.
//   Routes through notifySuperadmins (same channel Refinement Engine regime/lexicon
//   proposals use) so the prompt lands on TP's NotificationCenter + lock-screen + bell.
//
//   The agent-driven cleanup PR is a separate human-approved patch; this checker only
//   notifies. Idempotent — once the warn fires, the in-memory `fired` flag stops it
//   from re-broadcasting in the same process. Restarting the backend resets the flag,
//   so a long-running Fly machine fires once and a new machine after a restart fires
//   once more, which is the desired "remind me daily" cadence without spamming.
import cron from "node-cron";
import { createLogger } from "../../lib/logger.js";
import { notifySuperadmins } from "../notifications/notify-superadmins.js";

const log = createLogger("SunsetNewsWorker");

const SUNSET_DATE = new Date("2026-05-08T00:00:00-04:00"); // 00:00 ET
const SOURCE_TAG = "sunset-2026-05-08-news-worker";

let task: ReturnType<typeof cron.schedule> | null = null;
let firedThisProcess = false;

async function checkAndNotify(): Promise<void> {
  if (firedThisProcess) return;
  if (Date.now() < SUNSET_DATE.getTime()) return;

  firedThisProcess = true;

  const body =
    "S35-T10 sunset reached: news-worker legacy aliases ready for removal. " +
    "Drop: (1) NEWS_WORKER_PORT / FLAG_NEWS_WORKER_WRITES_RISKFLOW / NEWS_WORKER_AUDIT_ENABLED " +
    "env-var fallback reads in workers/riskflow-worker/* and cron/riskflow-worker-audit-scheduler.ts; " +
    "(2) news_worker mirror key in /api/diagnostics; (3) news-worker-audit dual-emit source tag + " +
    "legacy_source field in cron/riskflow-worker-audit-handler.ts; (4) public.news_worker_heartbeats " +
    "view in supabase. Open a small cleanup PR.";

  try {
    const result = await notifySuperadmins({
      title: "Sunset: news-worker aliases ready for removal",
      body,
      severity: "warn",
      source: SOURCE_TAG,
      url: "/admin/approvals",
    });
    log.info("Sunset notification dispatched", {
      recipients: result.recipients,
      delivered: result.delivered,
    });
  } catch (err) {
    log.error("Sunset notification failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    firedThisProcess = false; // allow retry on next tick
  }
}

/**
 * Start the sunset checker.
 * - Runs once on boot (so a fresh machine fires immediately if past sunset).
 * - Runs again every day at 09:00 ET so a long-lived machine still pings.
 */
export function startSunsetNewsWorkerChecker(): void {
  if (task) return;

  // Fire-and-forget boot check.
  void checkAndNotify();

  task = cron.schedule(
    "0 9 * * *",
    () => {
      void checkAndNotify();
    },
    { timezone: "America/New_York" },
  );
  log.info("Started — will notify daily at 09:00 ET on/after 2026-05-08");
}

export function stopSunsetNewsWorkerChecker(): void {
  if (task) {
    task.stop();
    task = null;
    log.info("Stopped");
  }
}
