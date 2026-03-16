// [claude-code 2026-03-15] ProjectX Performance Pipeline — computes daily P&L from activity events

import { getActivity } from './projectx-activity-service.js';
import { formatETDate, getETDate } from '../utils/timezone.js';

export interface DailyPnlResult {
  date: string;          // YYYY-MM-DD (ET)
  netPnl: number;
  grossPnl: number;
  winRate: number;        // 0-1
  tradesTaken: number;
  winningTrades: number;
  losingTrades: number;
  bias: 'long' | 'short' | 'neutral';
  avgPnlPerTrade: number;
  largestWin: number;
  largestLoss: number;
}

/**
 * Compute daily P&L for a given user/account by aggregating activity events.
 * Uses a full-day window (1440 minutes) to capture all trades for the date.
 * If no date is provided, defaults to today (ET).
 */
export async function computeDailyPnl(
  userId: string,
  accountId: number,
  date?: string
): Promise<DailyPnlResult> {
  const targetDate = date ?? formatETDate();

  // Pull a large window of events — 1440 min = 24h
  const { events } = await getActivity(userId, accountId, {
    windowMinutes: 1440,
    limit: 200,
    overtradingThreshold: 999, // don't penalize for P&L calc
  });

  // Filter to only trades on the target date
  const trades = events.filter((e) => {
    if (!e.isTrade) return false;
    const eventDate = e.eventTimestamp.slice(0, 10);
    return eventDate === targetDate;
  });

  const tradesTaken = trades.length;

  if (tradesTaken === 0) {
    return {
      date: targetDate,
      netPnl: 0,
      grossPnl: 0,
      winRate: 0,
      tradesTaken: 0,
      winningTrades: 0,
      losingTrades: 0,
      bias: 'neutral',
      avgPnlPerTrade: 0,
      largestWin: 0,
      largestLoss: 0,
    };
  }

  // Aggregate P&L
  let grossPositive = 0;
  let grossNegative = 0;
  let winningTrades = 0;
  let losingTrades = 0;
  let largestWin = 0;
  let largestLoss = 0;
  let longCount = 0;
  let shortCount = 0;

  for (const trade of trades) {
    const pnl = trade.realizedPnl ?? 0;

    if (pnl > 0) {
      grossPositive += pnl;
      winningTrades += 1;
      if (pnl > largestWin) largestWin = pnl;
    } else if (pnl < 0) {
      grossNegative += Math.abs(pnl);
      losingTrades += 1;
      if (pnl < largestLoss) largestLoss = pnl;
    }

    const side = (trade.side ?? '').toLowerCase();
    if (side === 'buy' || side === 'long') longCount += 1;
    else if (side === 'sell' || side === 'short') shortCount += 1;
  }

  const netPnl = grossPositive - grossNegative;
  const grossPnl = grossPositive + grossNegative;
  const winRate = tradesTaken > 0 ? winningTrades / tradesTaken : 0;
  const avgPnlPerTrade = tradesTaken > 0 ? netPnl / tradesTaken : 0;

  // Determine directional bias
  let bias: 'long' | 'short' | 'neutral' = 'neutral';
  if (longCount > shortCount) bias = 'long';
  else if (shortCount > longCount) bias = 'short';

  return {
    date: targetDate,
    netPnl: round2(netPnl),
    grossPnl: round2(grossPnl),
    winRate: round4(winRate),
    tradesTaken,
    winningTrades,
    losingTrades,
    bias,
    avgPnlPerTrade: round2(avgPnlPerTrade),
    largestWin: round2(largestWin),
    largestLoss: round2(largestLoss),
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
