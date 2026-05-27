import type { CanonicalTrade, ProjectXTrade } from "./types.js";

function sideToDirection(side: number): "long" | "short" {
  return side === 1 ? "short" : "long";
}

function numeric(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function toCanonicalTrade(
  userId: string,
  accountId: number,
  trade: ProjectXTrade,
): CanonicalTrade {
  const realizedPnl = numeric(trade.profitAndLoss);
  const hasClosedPnl =
    trade.profitAndLoss !== null && trade.profitAndLoss !== undefined;
  return {
    id: `projectx:${accountId}:${trade.id}`,
    userId,
    accountId: String(accountId),
    contract: trade.contractId,
    entryAt: trade.creationTimestamp,
    exitAt: hasClosedPnl ? trade.creationTimestamp : null,
    side: sideToDirection(trade.side),
    qty: numeric(trade.size),
    entryPrice: numeric(trade.price),
    exitPrice: hasClosedPnl ? numeric(trade.price) : null,
    realizedPnl,
    fees: numeric(trade.fees),
    origin: "user",
    rawPayload: trade as Record<string, unknown>,
  };
}
