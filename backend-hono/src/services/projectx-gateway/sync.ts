import { isPoolAvailable, query } from "../../db/optimized.js";
import { generateBlindspots } from "../blindspots/generator.js";
import { erMonitor } from "../psych/er-monitor.js";
import { searchProjectXAccounts, searchProjectXTrades } from "./client.js";
import {
  missingCredentialFields,
  resolveProjectXCredentials,
} from "./credentials.js";
import { toCanonicalTrade } from "./mapper.js";
import {
  listStoredTrades,
  upsertCanonicalTrades,
  upsertProjectXAccounts,
  upsertProjectXActivity,
} from "./store.js";
import type { CanonicalTrade, ProjectXSyncInput } from "./types.js";

const FALLBACK_LOOKBACK_MS = 48 * 60 * 60 * 1000;
const ACTIVE_LOOKBACK_MS = 6 * 60 * 60 * 1000;
const CALENDAR_LOOKBACK_MS = 35 * 24 * 60 * 60 * 1000;

function defaultRange(mode: ProjectXSyncInput["mode"]): {
  from: string;
  to: string;
} {
  const now = Date.now();
  const lookback =
    mode === "active"
      ? ACTIVE_LOOKBACK_MS
      : mode === "calendar"
        ? CALENDAR_LOOKBACK_MS
        : FALLBACK_LOOKBACK_MS;
  return {
    from: new Date(now - lookback).toISOString(),
    to: new Date(now).toISOString(),
  };
}

function statusFromError(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined;
  const status = (error as { status?: unknown }).status;
  return typeof status === "number" ? status : undefined;
}

async function markConnectionError(
  userId: string,
  message: string,
): Promise<void> {
  if (!isPoolAvailable()) return;
  await query(
    `UPDATE journal_broker_connections
     SET status = 'error', last_error = $2, updated_at = NOW()
     WHERE user_id = $1 AND provider = 'projectx'`,
    [userId, message],
  ).catch(() => undefined);
}

async function writeSyncRun(input: {
  userId: string;
  accountId?: string;
  mode: string;
  status: "success" | "error" | "needs_credentials";
  fetchedCount?: number;
  upsertedCount?: number;
  error?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  if (!isPoolAvailable()) return;
  await query(
    `INSERT INTO journal_sync_runs (
       user_id, provider, account_id, mode, finished_at, status,
       fetched_count, upserted_count, error, metadata
     )
     VALUES ($1, 'projectx', $2, $3, NOW(), $4, $5, $6, $7, $8::jsonb)`,
    [
      input.userId,
      input.accountId ?? null,
      input.mode,
      input.status,
      input.fetchedCount ?? 0,
      input.upsertedCount ?? 0,
      input.error ?? null,
      JSON.stringify(input.metadata ?? {}),
    ],
  ).catch(() => undefined);
}

async function runPostSyncLoop(userId: string, trades: CanonicalTrade[]) {
  const dates = Array.from(
    new Set(trades.map((trade) => trade.entryAt.slice(0, 10))),
  );
  await Promise.all(
    dates.slice(0, 5).map((date) =>
      generateBlindspots(userId, date).catch(() => ({
        psych: [],
        trading: [],
      })),
    ),
  );
  for (const trade of trades) {
    await erMonitor.recordTrade({
      userId,
      contract: trade.contract,
      qty: trade.qty,
      entryAt: trade.entryAt,
      realizedPnL: trade.realizedPnl,
      isClose: trade.exitAt !== null,
    });
  }
}

export async function syncProjectXForUser(
  userId: string,
  input: ProjectXSyncInput,
): Promise<Record<string, unknown>> {
  const credentials = await resolveProjectXCredentials(userId);
  const missing = missingCredentialFields(credentials);
  if (missing.length > 0) {
    await writeSyncRun({
      userId,
      mode: input.mode,
      status: "needs_credentials",
      error: `Missing ${missing.join(", ")}`,
    });
    return { success: false, status: "needs_credentials", missing };
  }

  const range = input.from && input.to ? input : defaultRange(input.mode);
  try {
    const accounts = await searchProjectXAccounts(credentials!);
    const activeAccountId = await upsertProjectXAccounts(
      userId,
      accounts,
      credentials?.activeAccountId,
    );
    if (!activeAccountId) {
      return { success: false, status: "no_accounts", accounts: [] };
    }

    const rawTrades = await searchProjectXTrades(
      credentials!,
      Number(activeAccountId),
      range.from!,
      range.to!,
    );
    const trades = rawTrades.map((trade) =>
      toCanonicalTrade(userId, Number(activeAccountId), trade),
    );
    const upsertedCount = await upsertCanonicalTrades(trades);
    await upsertProjectXActivity(trades);
    await runPostSyncLoop(userId, trades);

    if (isPoolAvailable()) {
      await query(
        `UPDATE journal_broker_connections
         SET status = 'connected', last_synced_at = NOW(), last_error = NULL
         WHERE user_id = $1 AND provider = 'projectx'`,
        [userId],
      );
    }

    await writeSyncRun({
      userId,
      accountId: activeAccountId,
      mode: input.mode,
      status: "success",
      fetchedCount: rawTrades.length,
      upsertedCount,
      metadata: { from: range.from, to: range.to },
    });
    return {
      success: true,
      status: "synced",
      accountId: activeAccountId,
      accountCount: accounts.length,
      fetchedCount: rawTrades.length,
      upsertedCount,
      from: range.from,
      to: range.to,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await markConnectionError(userId, message);
    await writeSyncRun({
      userId,
      mode: input.mode,
      status: "error",
      error: message,
      metadata: { status: statusFromError(error) },
    });
    return {
      success: false,
      status: statusFromError(error) === 429 ? "rate_limited" : "error",
      error: message,
      httpStatus: statusFromError(error),
    };
  }
}

export async function listProjectXTrades(
  userId: string,
  input: { from: string; to: string; origin: "all" | "user" | "autopilot" },
) {
  return listStoredTrades(userId, input);
}
