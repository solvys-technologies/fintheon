// [claude-code 2026-04-26] S45.5/F1: free-stack earnings chain runner.
// TradingView Calendar → browser-harness scrape.
// Per memory rule "No new paid services without explicit TP greenlight":
// FMP is OUT permanently; this chain is the canonical path going forward.

import { createLogger } from "../../../lib/logger.js";
import {
  fetchTradingViewEarnings,
  type TVCalendarRow,
} from "./tradingview-calendar.js";
import { fetchBrowserHarnessEarnings } from "./browser-harness-scrape.js";

const log = createLogger("EarningsChain");

export interface ChainResult {
  rows: TVCalendarRow[];
  source: "tradingview" | "browser-harness" | "none";
}

/**
 * Walk the chain in order and return the first non-empty result. Each leg
 * swallows its own errors and returns []; we only fall through to the next
 * leg on an empty array, never on a thrown exception.
 */
export async function runEarningsChain(): Promise<ChainResult> {
  const tv = await fetchTradingViewEarnings();
  if (tv.length > 0) {
    log.info("chain hit", { source: "tradingview", rows: tv.length });
    return { rows: tv, source: "tradingview" };
  }

  const harness = await fetchBrowserHarnessEarnings();
  if (harness.length > 0) {
    log.info("chain hit", { source: "browser-harness", rows: harness.length });
    return { rows: harness, source: "browser-harness" };
  }

  log.warn("chain produced zero rows from all sources");
  return { rows: [], source: "none" };
}

export type { TVCalendarRow };
