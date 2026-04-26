// [claude-code 2026-04-25] S40-P7: Consul-as-megacap-analyst. Subscribes to
// two trigger sources:
//   1. earnings_events row insert where symbol IN MEGACAP_TICKERS
//   2. news_feed_items insert where headline contains a megacap ticker AND
//      riskType IN ("merger", "partnership_deal")
//
// On trigger: dispatches a Consul boardroom task with ticker context.
// Scoring focus: revenue, guidance, capex, AI exposure. Result feeds
// NarrativeFlow as a high-priority catalyst card.
//
// Implementation note: rather than wire a Postgres LISTEN/NOTIFY which would
// add real-time complexity, this exposes a `triggerMegacapAnalyst()` function
// that the existing catalyst-promoter + earnings refresh paths call when they
// detect a relevant event. Polling-free, deterministic, easy to replay in
// fixtures.

import { createLogger } from "../../lib/logger.js";
import {
  MEGACAP_TICKER_SET,
  MEGACAP_TICKERS,
  type MegacapTicker,
} from "../earnings/megacap-tickers.js";
import { classifyToSector, ownerForSector } from "../../config/risk-sectors.js";
import { spawnSectorDispatch } from "../boardroom-spawner.js";

const log = createLogger("MegacapAnalyst");

export interface MegacapTrigger {
  source: "earnings" | "news";
  symbol: MegacapTicker;
  headline?: string;
  riskType?: string | null;
  context?: Record<string, unknown>;
}

export function findMegacapInHeadline(headline: string): MegacapTicker | null {
  const upper = headline.toUpperCase();
  // Match $TICKER or whole-word TICKER, longest-first to avoid GOO/GOOGL collisions.
  const sorted = [...MEGACAP_TICKERS].sort((a, b) => b.length - a.length);
  for (const t of sorted) {
    const pattern = new RegExp(`(\\$|\\b)${t}\\b`);
    if (pattern.test(upper)) return t;
  }
  return null;
}

export function isMegacapEarningsCatalyst(input: {
  riskType?: string | null;
  symbol?: string | null;
}): boolean {
  if (!input.symbol) return false;
  if (!MEGACAP_TICKER_SET.has(input.symbol.toUpperCase())) return false;
  return input.riskType === "earnings";
}

export function isMegacapDealCatalyst(input: {
  headline: string;
  riskType?: string | null;
}): { ok: boolean; symbol: MegacapTicker | null } {
  const isDealRiskType =
    input.riskType === "merger" || input.riskType === "partnership_deal";
  if (!isDealRiskType) return { ok: false, symbol: null };
  const symbol = findMegacapInHeadline(input.headline);
  return { ok: symbol != null, symbol };
}

export interface MegacapDispatchResult {
  dispatched: boolean;
  reason: string;
  taskId?: string;
}

/**
 * Dispatch a boardroom task to Consul scoped to the megacap context.
 * In v1 we record the trigger to worker_health and emit a structured log line
 * the boardroom scheduler picks up at its next tick. Real boardroom-spawner
 * wiring is intentionally light to avoid a hard dependency from the catalyst
 * pipeline into the agent runtime.
 */
export async function triggerMegacapAnalyst(
  trigger: MegacapTrigger,
): Promise<MegacapDispatchResult> {
  // Sanity guard.
  if (!MEGACAP_TICKER_SET.has(trigger.symbol)) {
    return {
      dispatched: false,
      reason: `not_megacap:${trigger.symbol}`,
    };
  }

  const sector = classifyToSector({
    headline: trigger.headline ?? "",
    riskType: trigger.riskType,
  });

  log.info("Megacap dispatch", {
    source: trigger.source,
    symbol: trigger.symbol,
    sector,
    headlinePreview: trigger.headline?.slice(0, 80),
  });

  // Megacap analyst is Consul-scoped per brief — override sector owner.
  await spawnSectorDispatch({
    headline: trigger.headline ?? `${trigger.symbol} — megacap event`,
    riskType: trigger.riskType ?? null,
    symbol: trigger.symbol,
    sector,
    ownerPersona: "consul",
    scoringFocus: ["revenue", "guidance", "capex", "ai_exposure"],
  });

  return {
    dispatched: true,
    reason: "ok",
  };
}

/**
 * [claude-code 2026-04-25] S40-P7: generic sector-aware dispatch helper —
 * non-megacap items hit this path. Catalyst promoter calls
 * `dispatchBySector(catalyst)` for items that survive the junk + dedup gates.
 */
export async function dispatchBySector(input: {
  headline: string;
  riskType?: string | null;
  symbol?: string | null;
}): Promise<void> {
  const sector = classifyToSector({
    headline: input.headline,
    riskType: input.riskType,
  });
  const owner = ownerForSector(sector);
  await spawnSectorDispatch({
    headline: input.headline,
    riskType: input.riskType ?? null,
    symbol: input.symbol ?? null,
    sector,
    ownerPersona: owner,
  });
}
