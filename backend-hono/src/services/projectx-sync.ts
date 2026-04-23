// [claude-code 2026-04-22] S29-T1: ProjectX trades sync worker — polls every 15 min, upserts to Supabase

import { createLogger } from "../lib/logger.js";
import { getTrades } from "./projectx-service.js";
import { query } from "../db/optimized.js";

const log = createLogger("ProjectXSync");

const SYNC_INTERVAL_MS = 15 * 60 * 1000;
const LOOKBACK_HOURS = 48;

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

  const accountId = process.env.PROJECTX_ACCOUNT_ID;
  if (!accountId || !process.env.PROJECTX_API_KEY) {
    log.warn("PROJECTX_API_KEY / PROJECTX_ACCOUNT_ID missing — sync skipped");
    return;
  }

  if (status.isRunning) {
    log.info("Previous sync still running — skipping cycle");
    return;
  }

  status.isRunning = true;
  status.lastError = null;

  try {
    const now = new Date();
    const from = new Date(
      now.getTime() - LOOKBACK_HOURS * 60 * 60 * 1000,
    ).toISOString();
    const to = now.toISOString();

    const trades = await getTrades(accountId, from, to);

    if (trades.length === 0) {
      log.info("Sync cycle complete — 0 trades in window");
      status.lastSyncedCount = 0;
      status.lastRunAt = now.toISOString();
      return;
    }

    let upserted = 0;
    for (const t of trades) {
      await query(
        `INSERT INTO trades (id, contract, entry_at, exit_at, side, qty, entry_price, exit_price, realized_pnl, origin)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'user')
         ON CONFLICT (id) DO UPDATE
           SET exit_at       = EXCLUDED.exit_at,
               exit_price    = EXCLUDED.exit_price,
               realized_pnl  = EXCLUDED.realized_pnl`,
        [
          t.id,
          t.contract,
          t.entryAt,
          t.exitAt,
          t.side,
          t.qty,
          t.entryPrice,
          t.exitPrice,
          t.realizedPnL,
        ],
      );
      upserted++;
    }

    status.lastSyncedCount = upserted;
    status.lastRunAt = now.toISOString();
    log.info(`Sync cycle complete — ${upserted} trades upserted`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    status.lastError = msg;
    log.error("Sync cycle failed", { error: msg });
  } finally {
    status.isRunning = false;
  }
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
