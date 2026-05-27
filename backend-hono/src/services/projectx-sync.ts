// [claude-code 2026-04-26] S45-T1: trades INSERT now includes user_id sourced from PROJECTX_USER_ID (per-account override) or SYSTEM_USER_ID (autopilot fallback). Historical NULL rows backfilled by orchestrator at unification — out of scope here.
// [claude-code 2026-04-22] S29-T1: ProjectX trades sync worker — polls every 15 min, upserts to Supabase

import { createLogger } from "../lib/logger.js";
import { syncProjectXForUser } from "./projectx-gateway/sync.js";

const log = createLogger("ProjectXSync");

const SYNC_INTERVAL_MS = 5 * 60 * 1000;

interface SyncStatus {
  lastRunAt: string | null;
  lastSyncedCount: number;
  lastError: string | null;
  isRunning: boolean;
}

const status: SyncStatus = {
  lastRunAt: null,
  lastSyncedCount: 0,
  lastError: null,
  isRunning: false,
};

export function getLastSyncStatus(): Readonly<SyncStatus> {
  return { ...status };
}

async function runSyncCycle(): Promise<void> {
  if (process.env.PROJECTX_SYNC_DISABLED === "true") {
    log.info("Sync disabled (PROJECTX_SYNC_DISABLED=true) — skipping");
    return;
  }

  if (!process.env.PROJECTX_API_KEY || !process.env.PROJECTX_USERNAME) {
    log.warn("PROJECTX_USERNAME / PROJECTX_API_KEY missing — sync skipped");
    return;
  }

  if (status.isRunning) {
    log.info("Previous sync still running — skipping cycle");
    return;
  }

  status.isRunning = true;
  status.lastError = null;

  try {
    const userId = resolveUserId();
    const result = await syncProjectXForUser(userId, { mode: "fallback" });
    const upserted = Number(result.upsertedCount ?? 0);
    status.lastSyncedCount = Number.isFinite(upserted) ? upserted : 0;
    status.lastRunAt = new Date().toISOString();
    log.info(`Sync cycle complete — ${status.lastSyncedCount} trades upserted`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    status.lastError = msg;
    log.error("Sync cycle failed", { error: msg });
  } finally {
    status.isRunning = false;
  }
}

function resolveUserId(): string | null {
  const explicit = process.env.PROJECTX_USER_ID;
  if (explicit) return explicit;
  const fallback = process.env.SYSTEM_USER_ID;
  return fallback ?? null;
}

let syncTimer: ReturnType<typeof setInterval> | null = null;

export function startTradesSync(): void {
  if (syncTimer) return;

  if (process.env.PROJECTX_SYNC_DISABLED === "true") {
    log.info("ProjectX trades sync disabled (PROJECTX_SYNC_DISABLED=true)");
    return;
  }

  log.info(
    `ProjectX trades sync started (${SYNC_INTERVAL_MS / 60_000}min interval)`,
  );

  syncTimer = setInterval(() => {
    runSyncCycle().catch((err) =>
      log.error("Unhandled sync error", { error: String(err) }),
    );
  }, SYNC_INTERVAL_MS);
  syncTimer.unref?.();

  // First run immediately so we don't wait 15 min after boot
  setImmediate(() => {
    runSyncCycle().catch((err) =>
      log.error("Unhandled sync error (boot run)", { error: String(err) }),
    );
  });
}
