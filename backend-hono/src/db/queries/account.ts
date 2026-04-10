/**
 * Account Database Queries
 * CRUD operations for user accounts
 */

import { sql, isDatabaseAvailable } from "../../config/database.js";
import type {
  Account,
  UserTier,
  AccountSettings,
} from "../../types/account.js";

export async function getAccountByUserId(
  userId: string,
): Promise<Account | null> {
  if (!isDatabaseAvailable()) return null;

  const result = await sql`
    SELECT * FROM accounts WHERE user_id = ${userId} LIMIT 1
  `;

  if (result.length === 0) return null;

  const row = result[0];
  return mapRowToAccount(row);
}

export async function createAccount(
  userId: string,
  email: string,
  initialBalance = 0,
): Promise<Account> {
  if (!isDatabaseAvailable()) {
    throw new Error("Database not available");
  }

  const result = await sql`
    INSERT INTO accounts (user_id, email, balance, tier, trading_enabled, algo_enabled, risk_management)
    VALUES (${userId}, ${email}, ${initialBalance}, 'free', false, false, false)
    RETURNING *
  `;

  return mapRowToAccount(result[0]);
}

export async function updateAccountSettings(
  userId: string,
  settings: AccountSettings,
): Promise<Account | null> {
  if (!isDatabaseAvailable()) return null;

  const result = await sql`
    UPDATE accounts SET
      trading_enabled = COALESCE(${settings.tradingEnabled ?? null}, trading_enabled),
      algo_enabled = COALESCE(${settings.algoEnabled ?? null}, algo_enabled),
      risk_management = COALESCE(${settings.riskManagement ?? null}, risk_management),
      selected_symbol = COALESCE(${settings.selectedSymbol ?? null}, selected_symbol),
      contracts_per_trade = COALESCE(${settings.contractsPerTrade ?? null}, contracts_per_trade),
      updated_at = NOW()
    WHERE user_id = ${userId}
    RETURNING *
  `;

  if (result.length === 0) return null;
  return mapRowToAccount(result[0]);
}

export async function updateAccountTier(
  userId: string,
  tier: UserTier,
): Promise<Account | null> {
  if (!isDatabaseAvailable()) return null;

  const result = await sql`
    UPDATE accounts SET tier = ${tier}, updated_at = NOW()
    WHERE user_id = ${userId}
    RETURNING *
  `;

  if (result.length === 0) return null;
  return mapRowToAccount(result[0]);
}

function mapRowToAccount(row: Record<string, unknown>): Account {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    email: String(row.email || ""),
    tier: (row.tier as UserTier) || "free",
    balance: Number(row.balance) || 0,
    dailyPnl: Number(row.daily_pnl) || 0,
    tradingEnabled: Boolean(row.trading_enabled),
    algoEnabled: Boolean(row.algo_enabled),
    riskManagement: Boolean(row.risk_management),
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}
