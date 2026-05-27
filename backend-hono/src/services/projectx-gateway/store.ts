import { isPoolAvailable, query } from "../../db/optimized.js";
import type { CanonicalTrade, ProjectXAccount } from "./types.js";

interface TradeRow {
  id: string;
  contract: string;
  entry_at: string;
  exit_at: string | null;
  side: string;
  qty: string;
  entry_price: string;
  exit_price: string | null;
  realized_pnl: string;
  fees: string | null;
  origin: "user" | "autopilot";
}

export async function upsertProjectXAccounts(
  userId: string,
  accounts: ProjectXAccount[],
  activeAccountId?: string,
): Promise<string | null> {
  if (!isPoolAvailable())
    return activeAccountId ?? accounts[0]?.id?.toString() ?? null;
  const visible = accounts.filter((account) => account.isVisible !== false);
  const selected =
    visible.find((account) => String(account.id) === activeAccountId) ??
    visible.find((account) => account.canTrade !== false) ??
    visible[0] ??
    accounts[0];

  for (const account of accounts) {
    await query(
      `INSERT INTO projectx_connections (
         user_id, account_id, account_name, account_status, last_synced_at
       )
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (user_id, account_id) DO UPDATE
         SET account_name = EXCLUDED.account_name,
             account_status = EXCLUDED.account_status,
             last_synced_at = NOW(),
             updated_at = NOW()`,
      [
        userId,
        String(account.id),
        account.name,
        account.canTrade === false ? "restricted" : "active",
      ],
    );
  }

  if (selected) {
    await query(
      `UPDATE journal_broker_connections
       SET active_account_id = $2,
           account_name = $3,
           status = 'connected',
           last_error = NULL,
           metadata = jsonb_set(metadata, '{accounts}', $4::jsonb, true),
           updated_at = NOW()
       WHERE user_id = $1 AND provider = 'projectx'`,
      [userId, String(selected.id), selected.name, JSON.stringify(accounts)],
    );
  }

  return selected ? String(selected.id) : null;
}

export async function upsertCanonicalTrades(
  trades: CanonicalTrade[],
): Promise<number> {
  if (!isPoolAvailable()) return 0;
  let count = 0;
  for (const trade of trades) {
    await query(
      `INSERT INTO trades (
         id, user_id, provider, account_id, contract, entry_at, exit_at, side,
         qty, entry_price, exit_price, realized_pnl, fees, origin, raw_payload
       )
       VALUES ($1, $2, 'projectx', $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb)
       ON CONFLICT (id) DO UPDATE
         SET user_id = EXCLUDED.user_id,
             account_id = EXCLUDED.account_id,
             exit_at = EXCLUDED.exit_at,
             exit_price = EXCLUDED.exit_price,
             realized_pnl = EXCLUDED.realized_pnl,
             fees = EXCLUDED.fees,
             raw_payload = EXCLUDED.raw_payload,
             updated_at = NOW()`,
      [
        trade.id,
        trade.userId,
        trade.accountId,
        trade.contract,
        trade.entryAt,
        trade.exitAt,
        trade.side,
        trade.qty,
        trade.entryPrice,
        trade.exitPrice,
        trade.realizedPnl,
        trade.fees,
        trade.origin,
        JSON.stringify(trade.rawPayload),
      ],
    );
    count += 1;
  }
  return count;
}

export async function upsertProjectXActivity(
  trades: CanonicalTrade[],
): Promise<void> {
  if (!isPoolAvailable()) return;
  for (const trade of trades) {
    await query(
      `INSERT INTO projectx_activity_events (
         user_id, account_id, provider, external_id, event_type, event_source,
         event_timestamp, is_trade, symbol, side, quantity, price, realized_pnl,
         event_weight, payload
       )
       VALUES ($1, $2, 'projectx', $3, 'trade', 'rest', $4, TRUE, $5, $6, $7, $8, $9, 1, $10::jsonb)
       ON CONFLICT (user_id, account_id, external_id) DO UPDATE
         SET event_timestamp = EXCLUDED.event_timestamp,
             realized_pnl = EXCLUDED.realized_pnl,
             payload = EXCLUDED.payload`,
      [
        trade.userId,
        Number(trade.accountId),
        trade.id,
        trade.entryAt,
        trade.contract,
        trade.side,
        trade.qty,
        trade.entryPrice,
        trade.realizedPnl,
        JSON.stringify(trade.rawPayload),
      ],
    );
  }
}

export async function listStoredTrades(
  userId: string,
  input: { from: string; to: string; origin: "all" | "user" | "autopilot" },
): Promise<Array<Record<string, unknown>>> {
  if (!isPoolAvailable()) return [];
  const originSql = input.origin === "all" ? "" : "AND origin = $4";
  const params =
    input.origin === "all"
      ? [userId, input.from, input.to]
      : [userId, input.from, input.to, input.origin];
  const result = await query<TradeRow>(
    `SELECT id, contract, entry_at, exit_at, side, qty, entry_price, exit_price,
            realized_pnl, fees, origin
     FROM trades
     WHERE user_id = $1 AND entry_at >= $2 AND entry_at <= $3 ${originSql}
     ORDER BY entry_at DESC`,
    params,
  );
  return result.rows.map((row) => {
    const realizedPnl = Number(row.realized_pnl ?? 0);
    return {
      id: row.id,
      contract: row.contract,
      entryAt: row.entry_at,
      exitAt: row.exit_at,
      side: row.side,
      qty: Number(row.qty),
      entryPrice: Number(row.entry_price),
      exitPrice: row.exit_price === null ? null : Number(row.exit_price),
      realizedPnl,
      realizedPnL: realizedPnl,
      fees: Number(row.fees ?? 0),
      isWin: realizedPnl > 0,
      origin: row.origin,
    };
  });
}
