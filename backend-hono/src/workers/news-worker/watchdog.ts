// [claude-code 2026-04-25] S40-P2: news-worker watchdog. Pings the riskflow
// health endpoint every HEALTH_CHECK_MS and acts on staleness:
//   - ok=true (ageSec < 300): silent heartbeat into worker_health
//   - ok=false: notifySuperadmins("News worker auto-restart: stale > 5min")
//                + record into worker_health with action_taken='restart'
//                + signal restart via process.exit(1) so launchd/Fly relaunches
//
// Daily 09:00 ET digest: 24h rollup of headline count + restart count, posted
// once. Healthy-day digests are quiet by design (one push per 24h, not per
// heartbeat).
//
// Disable via env: NEWS_WORKER_WATCHDOG_ENABLED=false.

import cron from "node-cron";
import { sql, isDatabaseAvailable } from "../../config/database.js";
import { getSupabaseClient } from "../../config/supabase.js";
import { createLogger } from "../../lib/logger.js";
import { notifySuperadmins } from "../../services/notifications/notify-superadmins.js";
import { NEWS_WORKER_CONTRACT } from "./contract.js";

const log = createLogger("NewsWorkerWatchdog");

let pingTimer: NodeJS.Timeout | null = null;
let digestTask: cron.ScheduledTask | null = null;
let running = false;
let alreadyAlerted = false;
let restartCount = 0;

interface HealthSnapshot {
  lastHeadlineAt: string | null;
  ageSec: number;
  ok: boolean;
}

export async function getHealthSnapshot(): Promise<HealthSnapshot> {
  if (!isDatabaseAvailable() || !sql) {
    return { lastHeadlineAt: null, ageSec: Number.MAX_SAFE_INTEGER, ok: false };
  }
  try {
    const rows =
      await sql`SELECT MAX(published_at) AS last FROM news_feed_items WHERE archived_at IS NULL`;
    const last = rows[0]?.last as string | null;
    if (!last) {
      return {
        lastHeadlineAt: null,
        ageSec: Number.MAX_SAFE_INTEGER,
        ok: false,
      };
    }
    const ageSec = Math.floor((Date.now() - new Date(last).getTime()) / 1000);
    return {
      lastHeadlineAt: last,
      ageSec,
      ok: ageSec < NEWS_WORKER_CONTRACT.STALE_THRESHOLD_SEC,
    };
  } catch (err) {
    log.warn("Health snapshot query threw", { error: String(err) });
    return { lastHeadlineAt: null, ageSec: Number.MAX_SAFE_INTEGER, ok: false };
  }
}

async function recordWatchdog(
  status: "ok" | "stale" | "restart",
  ageSec: number,
  action: string,
): Promise<void> {
  const sb = getSupabaseClient();
  if (!sb) return;
  await sb
    .from("worker_health")
    .insert({
      worker: "news-worker",
      status,
      age_sec: ageSec,
      action_taken: action,
    })
    .then((res) => {
      if (res.error) {
        log.warn("worker_health watchdog insert failed", {
          error: res.error.message,
        });
      }
    });
}

async function tick(): Promise<void> {
  const snap = await getHealthSnapshot();

  if (snap.ok) {
    if (alreadyAlerted) {
      // Recovery — tell TP we're back.
      alreadyAlerted = false;
      await notifySuperadmins({
        title: "News worker recovered",
        body: `Headlines flowing again (last seen ${snap.ageSec}s ago).`,
        severity: "warn",
        source: "news-worker-watchdog",
      }).catch(() => {});
      await recordWatchdog("ok", snap.ageSec, "recovery");
      return;
    }
    await recordWatchdog("ok", snap.ageSec, "heartbeat");
    return;
  }

  // Stale.
  log.error("News worker stale — initiating restart", {
    ageSec: snap.ageSec,
    lastHeadlineAt: snap.lastHeadlineAt,
  });

  if (!alreadyAlerted) {
    alreadyAlerted = true;
    restartCount += 1;
    await notifySuperadmins({
      title: "News worker auto-restart",
      body: `News worker stale — last headline ${snap.ageSec}s ago (>${NEWS_WORKER_CONTRACT.STALE_THRESHOLD_SEC}s threshold). Restarting via process.exit(1).`,
      severity: "warn",
      source: "news-worker-watchdog",
    }).catch(() => {});
  }

  await recordWatchdog("restart", snap.ageSec, "process.exit(1)");

  // Defer the exit a tick so any pending Supabase writes flush.
  setTimeout(() => {
    log.error("Exiting process so launchd/Fly relaunches");
    process.exit(1);
  }, 1_000);
}

async function fireDigest(): Promise<void> {
  if (!isDatabaseAvailable() || !sql) return;
  try {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const headlines =
      await sql`SELECT COUNT(*)::int AS c FROM news_feed_items WHERE published_at > ${yesterday} AND archived_at IS NULL`;
    const count = (headlines[0]?.c as number) ?? 0;
    const body = `News worker healthy: 24h headline count=${count}, restart count=${restartCount}`;
    await notifySuperadmins({
      title: "News worker daily health",
      body,
      severity: "warn",
      source: "news-worker-digest",
    }).catch(() => {});
    restartCount = 0;
  } catch (err) {
    log.warn("Digest threw (non-fatal)", { error: String(err) });
  }
}

export function startNewsWorkerWatchdog(): void {
  if (running) return;
  if (process.env.NEWS_WORKER_WATCHDOG_ENABLED === "false") {
    log.info("Disabled via NEWS_WORKER_WATCHDOG_ENABLED=false");
    return;
  }

  pingTimer = setInterval(() => {
    tick().catch((err) =>
      log.warn("Watchdog tick threw (swallowed)", { error: String(err) }),
    );
  }, NEWS_WORKER_CONTRACT.HEALTH_CHECK_MS);

  digestTask = cron.schedule(
    "0 9 * * *", // 09:00 ET daily
    () => {
      fireDigest().catch((err) =>
        log.warn("Digest cron threw (swallowed)", { error: String(err) }),
      );
    },
    { timezone: "America/New_York" },
  );

  running = true;
  log.info(
    `Started — pinging every ${NEWS_WORKER_CONTRACT.HEALTH_CHECK_MS}ms; daily digest 09:00 ET`,
  );
}

export function stopNewsWorkerWatchdog(): void {
  if (!running) return;
  if (pingTimer) clearInterval(pingTimer);
  pingTimer = null;
  digestTask?.stop();
  digestTask = null;
  running = false;
}
