// [claude-code 2026-05-13] S64-T1: White House Press Pool RSS scraper.
// Modeled after trump-schedule.ts. The WH Pool Call feed distributes daily
// press pool reports — briefings, gaggles, travel pool notes — that signal
// scheduled or impromptu White House communications.
//
// These events are classified as "pool_call" in the economic_events table
// (category = 'Speaker', subcategory = 'pool_call') so the window scheduler
// can treat them as event-driven trading windows.

import { fetchRss } from "../agent-reach-service.js";
import { createLogger } from "../../lib/logger.js";
import { toEtParts, isFutureOrToday } from "./date-utils.js";
import type {
  ScrapedFiscalEvent,
  FiscalSource,
  ScrapeResult,
} from "./types.js";

const log = createLogger("WhPoolCall");

// The WH Press Pool RSS is published by the White House Correspondents'
// Association. It carries daily pool reports, gaggles, briefings, and
// travel pool notes.
const POOL_RSS = "https://whpool.blob.core.windows.net/whpool/rss.xml";

// Matches titles that indicate a scheduled or notable pool event (as opposed
// to routine admin posts like "Pool Log" or "Travel Pool Report #3").
// We keep a broad match — every pool report is a potential signal.
const POOL_EVENT_RX =
  /\b(pool\s+report|gaggle|briefing|call|pool\s+call|pool\s+notice|travel\s+pool|pool\s+log|pool\s+spray|pool\s+calendar)\b/i;

function extractVenue(title: string): string {
  const cleaned = title.replace(
    /^Pool\s+(Report|Log|Call|Notice)\s+#?\d*\s*[-–—:]*\s*/i,
    "",
  );
  const sliced = cleaned.split(/[|—–-]/)[0];
  return (sliced || title).trim().slice(0, 80);
}

export async function scrapePoolCallEvents(): Promise<ScrapeResult> {
  try {
    const items = await fetchRss(POOL_RSS);
    const events: ScrapedFiscalEvent[] = [];
    for (const item of items) {
      if (!POOL_EVENT_RX.test(item.title)) continue;
      const parts = toEtParts(item.pubDate);
      if (!parts) continue;
      if (!isFutureOrToday(parts.date)) continue;
      events.push({
        speaker: "PoolCall",
        venue: extractVenue(item.title),
        date: parts.date,
        time: parts.time,
        detail: item.link,
        source: "wh-pool-rss",
      });
    }
    log.info("Pool call scrape complete", {
      fetched: events.length,
      totalItems: items.length,
    });
    return { events, fetched: events.length, errored: false };
  } catch (err) {
    log.warn("scrapePoolCallEvents failed (graceful)", {
      error: err instanceof Error ? err.message : String(err),
    });
    return { events: [], fetched: 0, errored: true };
  }
}
