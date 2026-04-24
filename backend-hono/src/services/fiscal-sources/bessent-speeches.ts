// [claude-code 2026-04-24] S34-T7: Bessent / Treasury Secretary scraper.
// Leverages the Treasury press-release RSS already in the news-worker allowlist.

import { fetchRss } from "../agent-reach-service.js";
import { createLogger } from "../../lib/logger.js";
import { toEtParts, isFutureOrToday } from "./date-utils.js";
import type { ScrapedFiscalEvent, ScrapeResult } from "./types.js";

const log = createLogger("BessentSpeeches");

const TREASURY_RSS = "https://home.treasury.gov/news/press-releases/feed";

// Tight matcher — we only want Bessent / Secretary-of-the-Treasury remarks,
// not every press release (tariff lists, OFAC sanctions, etc.).
const BESSENT_RX =
  /\b(bessent|secretary\s+of\s+the\s+treasury|treasury\s+secretary)\b/i;
const REMARKS_RX =
  /\b(remarks|speech|speaks|speaking|testimony|testifies|testifying|press conference|statement)\b/i;

function extractVenue(title: string): string {
  const cleaned = title.replace(
    /^Remarks\s+(by|of)\s+.*?(at|before|on)\s+/i,
    "",
  );
  const sliced = cleaned.split(/[|—–-]/)[0];
  return (sliced || title).trim().slice(0, 80);
}

export async function scrapeBessentSpeeches(): Promise<ScrapeResult> {
  try {
    const items = await fetchRss(TREASURY_RSS);
    const events: ScrapedFiscalEvent[] = [];
    for (const item of items) {
      if (!BESSENT_RX.test(item.title)) continue;
      // Require either an explicit remarks signal OR Bessent's name; Treasury
      // posts schedule updates under a handful of titles so we keep this
      // lenient.
      if (!REMARKS_RX.test(item.title) && !BESSENT_RX.test(item.title))
        continue;
      const parts = toEtParts(item.pubDate);
      if (!parts) continue;
      if (!isFutureOrToday(parts.date)) continue;
      events.push({
        speaker: "Bessent",
        venue: extractVenue(item.title),
        date: parts.date,
        time: parts.time,
        detail: item.link,
        source: "treasury-rss",
      });
    }
    return { events, fetched: events.length, errored: false };
  } catch (err) {
    log.warn("scrapeBessentSpeeches failed (graceful)", {
      error: err instanceof Error ? err.message : String(err),
    });
    return { events: [], fetched: 0, errored: true };
  }
}
