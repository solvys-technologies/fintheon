import { isPoolAvailable, query } from "../../db/optimized.js";
import {
  missingCredentialFields,
  resolveProjectXCredentials,
} from "./credentials.js";
import { dbUserId } from "./user-id.js";

interface StatusRow {
  status: string;
  active_account_id: string | null;
  account_name: string | null;
  last_synced_at: string | null;
  last_error: string | null;
}

interface SummaryRow {
  trade_count: string;
  daily_pnl: string;
  last_trade_at: string | null;
}

export async function getProjectXStatus(userId: string) {
  const credentials = await resolveProjectXCredentials(userId);
  const missing = missingCredentialFields(credentials);
  const normalizedUserId = dbUserId(userId);
  const base = {
    configured: missing.length === 0,
    missing,
    source: credentials?.source ?? null,
  };

  if (!isPoolAvailable()) {
    return {
      ...base,
      status: missing.length ? "needs_credentials" : "configured",
      activeAccountId: credentials?.activeAccountId ?? null,
      accountName: null,
      lastSyncedAt: null,
      lastError: null,
      tradeCountToday: 0,
      dailyPnl: 0,
      lastTradeAt: null,
    };
  }

  const connection = await query<StatusRow>(
    `SELECT status, active_account_id, account_name, last_synced_at, last_error
     FROM journal_broker_connections
     WHERE user_id = $1 AND provider = 'projectx'
     LIMIT 1`,
    [userId],
  ).catch(() => ({ rows: [] as StatusRow[] }));

  const summary = await query<SummaryRow>(
    `SELECT COUNT(*)::text AS trade_count,
            COALESCE(SUM(realized_pnl), 0)::text AS daily_pnl,
            MAX(entry_at)::text AS last_trade_at
     FROM trades
     WHERE user_id = $1 AND entry_at >= CURRENT_DATE`,
    [normalizedUserId],
  ).catch(() => ({ rows: [] as SummaryRow[] }));

  const row = connection.rows[0];
  const summaryRow = summary.rows[0];

  return {
    ...base,
    status:
      row?.status ?? (missing.length ? "needs_credentials" : "configured"),
    activeAccountId:
      row?.active_account_id ?? credentials?.activeAccountId ?? null,
    accountName: row?.account_name ?? null,
    lastSyncedAt: row?.last_synced_at ?? null,
    lastError: row?.last_error ?? null,
    tradeCountToday: Number(summaryRow?.trade_count ?? 0),
    dailyPnl: Number(summaryRow?.daily_pnl ?? 0),
    lastTradeAt: summaryRow?.last_trade_at ?? null,
  };
}
