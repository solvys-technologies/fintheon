// [claude-code 2026-04-24] S34-T7: Trump schedule scraper. Noisiest source.
// Requires a venue/schedule signal in the title to avoid flooding the table
// with every White House press release.

import { fetchRss } from "../agent-reach-service.js";
import { createLogger } from "../../lib/logger.js";
import { toEtParts, isFutureOrToday } from "./date-utils.js";
import type {
  ScrapedFiscalEvent,
  FiscalSource,
  ScrapeResult,
} from "./types.js";

const log = createLogger("TrumpSchedule");

const WHITEHOUSE_RSS =
  "https://www.whitehouse.gov/briefing-room/statements-releases/feed/";
const TRUTH_RSS = "https://trumpstruth.org/feed";

// Must fire on BOTH: a speaker/venue signal AND Trump's name (unless it's the
// Truth Social mirror, where every post is already his).
const TRUMP_RX = /\b(trump|president(?:ial)?)\b/i;
const SCHEDULE_RX =
  /\b(speech|speaks?|speaking|remarks|press conference|rally|signing|ceremony|visit|address|announce[sd]?|statement|briefing|testimony)\b/i;

function extractVenue(title: string): string {
  const clean = title.replace(
    /^(remarks|statement)\s+(by|of)\s+.*?(at|before|on|in)\s+/i,
    "",
  );
  const sliced = clean.split(/[|—–-]/)[0];
  return (sliced || title).trim().slice(0, 80);
}

async function collect(
  feedUrl: string,
  source: FiscalSource,
  requireTrumpInTitle: boolean,
): Promise<ScrapedFiscalEvent[]> {
  const items = await fetchRss(feedUrl);
  const out: ScrapedFiscalEvent[] = [];
  for (const item of items) {
    if (requireTrumpInTitle && !TRUMP_RX.test(item.title)) continue;
    if (!SCHEDULE_RX.test(item.title)) continue;
    const parts = toEtParts(item.pubDate);
    if (!parts) continue;
    if (!isFutureOrToday(parts.date)) continue;
    out.push({
      speaker: "Trump",
      venue: extractVenue(item.title),
      date: parts.date,
      time: parts.time,
      detail: item.link,
      source,
    });
  }
  return out;
}

export async function scrapeTrumpSchedule(): Promise<ScrapeResult> {
  try {
    const [wh, truth] = await Promise.all([
      collect(WHITEHOUSE_RSS, "whitehouse-rss", true),
      collect(TRUTH_RSS, "truth-rss", false),
    ]);
    const events = [...wh, ...truth];
    return { events, fetched: events.length, errored: false };
  } catch (err) {
    log.warn("scrapeTrumpSchedule failed (graceful)", {
      error: err instanceof Error ? err.message : String(err),
    });
    return { events: [], fetched: 0, errored: true };
  }
}
