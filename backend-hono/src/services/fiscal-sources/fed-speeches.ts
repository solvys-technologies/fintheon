// [claude-code 2026-04-24] S34-T7: Fed speaker scraper. RSS-first; HTML fallback.
// Feeds the populator with Powell / FOMC member speeches + testimony.

import { fetchRss, scrapeUrl } from "../agent-reach-service.js";
import { createLogger } from "../../lib/logger.js";
import { toEtParts, isFutureOrToday } from "./date-utils.js";
import type { ScrapedFiscalEvent, ScrapeResult } from "./types.js";

const log = createLogger("FedSpeeches");

const FED_SPEECHES_RSS = "https://www.federalreserve.gov/feeds/speeches.xml";
const FED_CALENDAR_HTML =
  "https://www.federalreserve.gov/newsevents/calendar.htm";

const POWELL_RX = /powell/i;
// Deliberately narrow — we want the speaker signal, not every press release.
const SPEECH_TITLE_RX =
  /\b(speech|speaks?|speaking|remarks|testimony|testifies|testifying|press conference|statement)\b/i;

function pickSpeaker(title: string): "Powell" | "Fed" {
  return POWELL_RX.test(title) ? "Powell" : "Fed";
}

function extractVenue(title: string): string {
  // Fed speech titles usually read: "Speaker Name: Title — Venue, Date".
  // Grab the substring after the last em/en dash or colon as the venue hint;
  // fall back to the full title truncated.
  const dashSplit = title.split(/\s+[—–-]\s+/);
  if (dashSplit.length > 1)
    return dashSplit[dashSplit.length - 1].trim().slice(0, 80);
  const colonSplit = title.split(/:\s+/);
  if (colonSplit.length > 1)
    return colonSplit[colonSplit.length - 1].trim().slice(0, 80);
  return title.trim().slice(0, 80);
}

async function viaRss(): Promise<ScrapedFiscalEvent[]> {
  const items = await fetchRss(FED_SPEECHES_RSS);
  const events: ScrapedFiscalEvent[] = [];
  for (const item of items) {
    if (!SPEECH_TITLE_RX.test(item.title)) continue;
    const parts = toEtParts(item.pubDate);
    if (!parts) continue;
    if (!isFutureOrToday(parts.date)) continue;
    events.push({
      speaker: pickSpeaker(item.title),
      venue: extractVenue(item.title),
      date: parts.date,
      time: parts.time,
      detail: item.link,
      source: "fed-rss",
    });
  }
  return events;
}

async function viaHtml(): Promise<ScrapedFiscalEvent[]> {
  const article = await scrapeUrl(FED_CALENDAR_HTML);
  if (!article || !article.text) return [];
  // The calendar page is structured but scrapeUrl already flattened it. We
  // keep the fallback minimal: one synthetic pointer row so the modal has at
  // least a URL to surface until RSS recovers. Detail = the calendar URL.
  return [
    {
      speaker: "Fed",
      venue: "FOMC calendar (pending parse)",
      date: toEtParts(new Date())?.date ?? "",
      time: "00:00",
      detail: FED_CALENDAR_HTML,
      source: "fed-html",
    },
  ].filter((e) => e.date);
}

export async function scrapeFedSpeeches(): Promise<ScrapeResult> {
  try {
    const rss = await viaRss();
    if (rss.length > 0) {
      return { events: rss, fetched: rss.length, errored: false };
    }
    const html = await viaHtml();
    return { events: html, fetched: html.length, errored: false };
  } catch (err) {
    log.warn("scrapeFedSpeeches failed (graceful)", {
      error: err instanceof Error ? err.message : String(err),
    });
    return { events: [], fetched: 0, errored: true };
  }
}
