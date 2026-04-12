import { createLogger } from "../../lib/logger.js";
import {
  exaSearch,
  isExaAvailable,
  type ExaSearchResult,
} from "../exa-service.js";
// rettiwtSearch removed — all X content comes from curated timelines only
import { scrapeMultiple, type ScrapedArticle } from "../agent-reach-service.js";
import { fetchEconCalendar } from "../econ-calendar-service.js";
import { writeRawItems, type RawRiskFlowItem } from "../supabase-service.js";
import { filterWithContentGuard } from "./content-guard.js";
import { getPollingConfig } from "./polling-config.js";

const log = createLogger("ExaScheduledMonitor");

const HOT_INTERVAL_MS = 30 * 60_000;
const OFF_PEAK_INTERVAL_MS = 60 * 60_000;
const RECENT_PUBLICATION_WINDOW_MS = 2 * 60 * 60 * 1000;
const UPCOMING_WINDOW_MS = 4 * 60 * 60 * 1000;

const SCHEDULED_EVENT_QUERIES = [
  "Federal Reserve speech remarks scheduled today",
  "Fed Chair press conference scheduled",
  "Treasury Secretary statement scheduled",
  "Congressional hearing Federal Reserve today",
  "Presidential address economic policy today",
  "FOMC member scheduled remarks today",
] as const;

const SCHEDULED_KEYWORDS = [
  "scheduled",
  "schedule",
  "to speak",
  "will speak",
  "remarks",
  "press conference",
  "hearing",
  "testimony",
  "address",
  "briefing",
  "conference call",
] as const;

const TIME_HINTS = [
  "today",
  "tonight",
  "this morning",
  "this afternoon",
  "this evening",
  "tomorrow",
  "am",
  "pm",
  "et",
] as const;

let monitorTimeout: ReturnType<typeof setTimeout> | null = null;
const sessionSeenIds = new Set<string>();

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hashString(value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

function parsePublishedMs(publishedDate?: string): number | null {
  if (!publishedDate) return null;
  const parsed = Date.parse(publishedDate);
  return Number.isNaN(parsed) ? null : parsed;
}

function looksScheduled(result: ExaSearchResult): boolean {
  const haystack = normalizeText(`${result.title} ${result.text}`);
  const hasScheduleSignal = SCHEDULED_KEYWORDS.some((kw) =>
    haystack.includes(kw),
  );
  const hasTimeSignal = TIME_HINTS.some((kw) => haystack.includes(kw));
  return hasScheduleSignal && hasTimeSignal;
}

function isRecentlyPublished(result: ExaSearchResult): boolean {
  const publishedMs = parsePublishedMs(result.publishedDate);
  if (publishedMs === null) return false;
  const age = Date.now() - publishedMs;
  return age >= 0 && age <= RECENT_PUBLICATION_WINDOW_MS;
}

function referencesUpcomingWindow(result: ExaSearchResult): boolean {
  const haystack = normalizeText(`${result.title} ${result.text}`);
  if (haystack.includes("next 4 hours") || haystack.includes("within 4 hours"))
    return true;
  return TIME_HINTS.some((kw) => haystack.includes(kw));
}

function overlapsEconCalendar(
  result: ExaSearchResult,
  existingEventNames: string[],
): boolean {
  const title = normalizeText(result.title);
  return existingEventNames.some((name) => {
    if (!name) return false;
    return title.includes(name) || name.includes(title);
  });
}

function toRawRiskFlowItem(result: ExaSearchResult): RawRiskFlowItem {
  const normalizedTitle = normalizeText(result.title);
  const publishedBucket =
    result.publishedDate?.slice(0, 13) ?? new Date().toISOString().slice(0, 13);
  const id = `exa-scheduled-${hashString(`${normalizedTitle}|${publishedBucket}`)}`;
  const body = [result.url, result.text]
    .filter(Boolean)
    .join("\n")
    .slice(0, 1200);

  return {
    tweet_id: id,
    source: "ExaMonitor",
    headline: result.title,
    body: body || undefined,
    symbols: [],
    tags: ["scheduled-event", "eventType:scheduled"],
    is_breaking: false,
    urgency: "normal",
    published_at: result.publishedDate ?? new Date().toISOString(),
    submitted_by: "exa-scheduled-monitor",
  };
}

const EVENT_CALENDAR_URLS = [
  "https://www.federalreserve.gov/newsevents/calendar.htm",
  "https://home.treasury.gov/news/press-releases",
];

function scrapedToExaResult(article: ScrapedArticle): ExaSearchResult {
  return {
    title: article.title,
    url: article.url,
    text: article.text,
    publishedDate: article.publishedDate,
  };
}

export async function checkForScheduledEvents(): Promise<void> {
  if (!isExaAvailable()) {
    log.info(
      "[ExaMonitor] EXA_API_KEY not configured; trying Agent-Reach only",
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  const econEvents = await fetchEconCalendar({ from: today, to: today }).catch(
    (err) => {
      log.warn("[ExaMonitor] Econ calendar fetch failed (non-fatal)", {
        error: String(err),
      });
      return [];
    },
  );
  const normalizedEventNames = econEvents.map((event) =>
    normalizeText(event.name),
  );

  // Collect results from all sources into a unified ExaSearchResult format
  let allResults: ExaSearchResult[] = [];

  // ── Step 1: Rettiwt keyword search REMOVED ──
  // All X content comes from curated account timelines only.
  // No open keyword searches.

  // ── Step 2: Agent-Reach scrape known calendar URLs ──
  const scraped = await scrapeMultiple(EVENT_CALENDAR_URLS);
  for (const article of scraped) {
    allResults.push(scrapedToExaResult(article));
  }

  // ── Step 3: Exa as tertiary fallback ──
  if (allResults.length === 0 && isExaAvailable()) {
    const exaResults = await Promise.all(
      SCHEDULED_EVENT_QUERIES.map((query) =>
        exaSearch(query, {
          type: "neural",
          numResults: 5,
          useAutoprompt: true,
        }).catch((err) => {
          log.warn("[ExaMonitor] Exa query failed", {
            query,
            error: String(err),
          });
          return [];
        }),
      ),
    );
    allResults = exaResults.flat();
  }

  if (allResults.length === 0) {
    log.info("[ExaMonitor] No results for scheduled-event queries");
    return;
  }

  const dedupByTitle = new Map<string, ExaSearchResult>();
  for (const result of allResults) {
    if (!result.title || !result.url) continue;
    const key = `${normalizeText(result.title)}|${result.url.toLowerCase()}`;
    if (!dedupByTitle.has(key)) dedupByTitle.set(key, result);
  }

  const candidateResults = Array.from(dedupByTitle.values()).filter(
    (result) => {
      if (!looksScheduled(result)) return false;
      if (!isRecentlyPublished(result)) return false;
      if (!referencesUpcomingWindow(result)) return false;
      if (overlapsEconCalendar(result, normalizedEventNames)) return false;
      return true;
    },
  );

  const freshRows: RawRiskFlowItem[] = [];
  for (const result of candidateResults) {
    const row = toRawRiskFlowItem(result);
    if (sessionSeenIds.has(row.tweet_id)) continue;
    sessionSeenIds.add(row.tweet_id);
    freshRows.push(row);
  }

  if (freshRows.length === 0) {
    log.info("[ExaMonitor] 0 new scheduled events after dedup/cross-reference");
    return;
  }

  const cleanRows = filterWithContentGuard(
    freshRows,
    (i) => `${i.headline} ${i.body || ""}`,
  );
  if (cleanRows.length === 0) {
    log.info("[ExaMonitor] All scheduled events blocked by content guard");
    return;
  }
  const written = await writeRawItems(cleanRows);
  log.info(
    `[ExaMonitor] Ingested ${written} scheduled events (${freshRows.length} candidates, ${freshRows.length - cleanRows.length} blocked)`,
  );
}

export function startExaScheduledMonitor(): void {
  if (monitorTimeout) return;
  log.info("[ExaMonitor] Starting scheduled event monitor");

  const scheduledCheck = async (): Promise<void> => {
    try {
      await checkForScheduledEvents();
    } catch (err) {
      log.error("[ExaMonitor] Check error", { error: String(err) });
    }

    const { isHotHours } = getPollingConfig();
    const interval = isHotHours ? HOT_INTERVAL_MS : OFF_PEAK_INTERVAL_MS;
    log.info(
      `[ExaMonitor] Next check in ${Math.round(interval / 60_000)}m (hotHours=${isHotHours})`,
    );
    monitorTimeout = setTimeout(scheduledCheck, interval);
  };

  void scheduledCheck();
}

export function stopExaScheduledMonitor(): void {
  if (!monitorTimeout) return;
  clearTimeout(monitorTimeout);
  monitorTimeout = null;
  log.info("[ExaMonitor] Stopped");
}
