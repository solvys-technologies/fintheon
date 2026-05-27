import { isPoolAvailable, query } from "../db/optimized.js";
import { dbUserId } from "./projectx-gateway/user-id.js";

interface ActivitySummaryRow {
  trade_count: string;
  weighted_trades: string;
  realized_pnl: string;
  last_trade_at: string | null;
}

interface TradeSummaryRow {
  trade_count: string;
  realized_pnl: string;
  last_trade_at: string | null;
}

function clampWindow(value?: number): number {
  if (!value || !Number.isFinite(value)) return 15;
  return Math.max(5, Math.min(120, Math.floor(value)));
}

function clampThreshold(value?: number): number {
  if (!value || !Number.isFinite(value)) return 5;
  return Math.max(1, Math.min(50, Math.floor(value)));
}

function buildPenalty(weightedTrades: number, threshold: number): number {
  if (weightedTrades <= threshold) return 0;
  return Math.min(3, Number(((weightedTrades - threshold) * 0.25).toFixed(2)));
}

function warningFor(input: {
  isOvertrading: boolean;
  tradesInWindow: number;
  windowMinutes: number;
  realizedPnl: number;
}): string | undefined {
  if (!input.isOvertrading) return undefined;
  const lossText =
    input.realizedPnl < 0
      ? ` with $${Math.abs(input.realizedPnl).toFixed(0)} drawdown`
      : "";
  return `${input.tradesInWindow} trades in ${input.windowMinutes} minutes${lossText}.`;
}

export async function evaluateOvertrading(
  userId: string,
  options?: { windowMinutes?: number; threshold?: number },
): Promise<{
  isOvertrading: boolean;
  tradesInWindow: number;
  weightedTrades: number;
  threshold: number;
  penalty: number;
  warning?: string;
  realizedPnl: number;
  lastTradeAt: string | null;
}> {
  const windowMinutes = clampWindow(options?.windowMinutes);
  const threshold = clampThreshold(options?.threshold);
  const normalizedUserId = dbUserId(userId);

  if (!isPoolAvailable()) {
    return {
      isOvertrading: false,
      tradesInWindow: 0,
      weightedTrades: 0,
      threshold,
      penalty: 0,
      realizedPnl: 0,
      lastTradeAt: null,
    };
  }

  const activity = await query<ActivitySummaryRow>(
    `SELECT COUNT(*)::text AS trade_count,
            COALESCE(SUM(event_weight), 0)::text AS weighted_trades,
            COALESCE(SUM(realized_pnl), 0)::text AS realized_pnl,
            MAX(event_timestamp)::text AS last_trade_at
     FROM projectx_activity_events
     WHERE user_id = $1
       AND is_trade = TRUE
       AND event_timestamp >= NOW() - ($2::int * INTERVAL '1 minute')`,
    [normalizedUserId, windowMinutes],
  );

  let tradesInWindow = Number(activity.rows[0]?.trade_count ?? 0);
  let weightedTrades = Number(activity.rows[0]?.weighted_trades ?? 0);
  let realizedPnl = Number(activity.rows[0]?.realized_pnl ?? 0);
  let lastTradeAt = activity.rows[0]?.last_trade_at ?? null;

  if (tradesInWindow === 0) {
    const fallback = await query<TradeSummaryRow>(
      `SELECT COUNT(*)::text AS trade_count,
              COALESCE(SUM(realized_pnl), 0)::text AS realized_pnl,
              MAX(entry_at)::text AS last_trade_at
       FROM trades
       WHERE user_id = $1
         AND entry_at >= NOW() - ($2::int * INTERVAL '1 minute')`,
      [normalizedUserId, windowMinutes],
    );
    tradesInWindow = Number(fallback.rows[0]?.trade_count ?? 0);
    weightedTrades = tradesInWindow;
    realizedPnl = Number(fallback.rows[0]?.realized_pnl ?? 0);
    lastTradeAt = fallback.rows[0]?.last_trade_at ?? null;
  }

  const penalty = buildPenalty(weightedTrades, threshold);
  const isOvertrading = weightedTrades >= threshold;
  return {
    isOvertrading,
    tradesInWindow,
    weightedTrades,
    threshold,
    penalty,
    realizedPnl,
    lastTradeAt,
    warning: warningFor({
      isOvertrading,
      tradesInWindow,
      windowMinutes,
      realizedPnl,
    }),
  };
}
