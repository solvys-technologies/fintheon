// [claude-code 2026-04-26] S45.5/F1: Steel-Consul / browser-harness fallback
// scrape of the TradingView Earnings Calendar UI. Engaged when the JSON
// scanner endpoint 429s or schema-shifts. Stub today — full implementation
// requires HTML parsing of the calendar page; tracked as TODO so the chain
// orchestrator can degrade gracefully without throwing.

import { createLogger } from "../../../lib/logger.js";
import type { TVCalendarRow } from "./tradingview-calendar.js";

const log = createLogger("BrowserHarnessScrape");

export async function fetchBrowserHarnessEarnings(): Promise<TVCalendarRow[]> {
  log.info(
    "browser-harness earnings scrape stubbed — TradingView scanner is the live source today",
  );
  return [];
}
