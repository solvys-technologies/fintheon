// [claude-code 2026-04-24] S34-T6: Keyword-first gate in processActualsFromTweets;
// numeric extraction preserved as best-effort enrichment. PRE_/POST_EVENT_MINUTES
// promoted to named exports for reuse by econ-keyword-trigger.
// [claude-code 2026-04-11] Econ calendar integration for Rettiwt poller
// Event windows, burst scheduling, actual extraction from FJ tweets

import {
  fetchEconCalendar,
  updateEventActual,
  writeEconPrint,
} from "../econ-calendar-service.js";
import { injectEconPrintToFeed } from "./econ-bridge.js";
import type { EconEvent } from "../econ-calendar-service.js";

export const PRE_EVENT_MINUTES = 5;
export const POST_EVENT_MINUTES = 15;
export const BURST_INTERVAL_MS = 5_000;
export const BURST_DURATION_MS = 30_000;

// Track active burst intervals per event to prevent duplicates
export const activeBursts = new Map<string, ReturnType<typeof setInterval>>();

// Track which event IDs already had actuals written
const actualWrittenIds = new Set<string>();

// ── Actual Extraction ──────────────────────────────────────────────────────

const ACTUAL_PATTERNS = [
  /\bActual[:\s]+(-?\d+\.?\d*)\s*%?/i,
  /\bActual[:\s]+(-?\d+\.?\d*)\s*[KkMm]?\b/i,
  /\b(?:came\s+in\s+at|prints?|reported)\s+(-?\d+\.?\d*)\s*%?/i,
];

const FORECAST_PATTERNS = [
  /\bForecast[:\s]+(-?\d+\.?\d*)\s*%?/i,
  /\b(?:exp|expected|consensus|est)[:\s]+(-?\d+\.?\d*)\s*%?/i,
  /\bvs\.?\s+(?:forecast|exp|expected)\s+(-?\d+\.?\d*)\s*%?/i,
];

const PREVIOUS_PATTERNS = [
  /\bPrevious[:\s]+(-?\d+\.?\d*)\s*%?/i,
  /\bPrev[:\s]+(-?\d+\.?\d*)\s*%?/i,
  /\bPrior[:\s]+(-?\d+\.?\d*)\s*%?/i,
];

interface ExtractedActual {
  actual: number;
  forecast?: number;
  previous?: number;
}

export function extractActualFromText(text: string): ExtractedActual | null {
  let actualStr: string | undefined;
  for (const pattern of ACTUAL_PATTERNS) {
    const match = text.match(pattern);
    if (match?.[1]) {
      actualStr = match[1];
      break;
    }
  }
  if (!actualStr) return null;
  const actual = parseFloat(actualStr);
  if (isNaN(actual)) return null;

  let forecast: number | undefined;
  for (const pattern of FORECAST_PATTERNS) {
    const match = text.match(pattern);
    if (match?.[1]) {
      forecast = parseFloat(match[1]);
      break;
    }
  }

  let previous: number | undefined;
  for (const pattern of PREVIOUS_PATTERNS) {
    const match = text.match(pattern);
    if (match?.[1]) {
      previous = parseFloat(match[1]);
      break;
    }
  }

  return { actual, forecast, previous };
}

// ── Event Matching ─────────────────────────────────────────────────────────

export function matchTweetToEvent(
  tweetText: string,
  events: EconEvent[],
): EconEvent | null {
  const upper = tweetText.toUpperCase();
  let bestMatch: EconEvent | null = null;
  let bestScore = 0;

  for (const event of events) {
    const eventUpper = event.name.toUpperCase();
    const keywords = eventUpper.split(/\s+/).filter((w) => w.length > 2);
    let score = 0;
    for (const kw of keywords) {
      if (upper.includes(kw)) score++;
    }
    if (eventUpper.includes("CPI") && upper.includes("CPI")) score += 3;
    if (eventUpper.includes("PPI") && upper.includes("PPI")) score += 3;
    if (eventUpper.includes("NFP") && upper.includes("NFP")) score += 3;
    if (eventUpper.includes("GDP") && upper.includes("GDP")) score += 3;
    if (eventUpper.includes("PCE") && upper.includes("PCE")) score += 3;
    if (eventUpper.includes("FOMC") && upper.includes("FOMC")) score += 3;
    if (eventUpper.includes("RETAIL") && upper.includes("RETAIL")) score += 2;
    if (eventUpper.includes("CLAIMS") && upper.includes("CLAIMS")) score += 2;
    if (eventUpper.includes("PMI") && upper.includes("PMI")) score += 2;

    if (score > bestScore) {
      bestScore = score;
      bestMatch = event;
    }
  }

  return bestScore >= 2 ? bestMatch : null;
}

// ── Process Actuals ────────────────────────────────────────────────────────

// [claude-code 2026-04-24] S34-T6: Keyword-first gate. Items with "Actual"/"Forecast"
// that match an active event proceed even when numeric extraction fails — the econ
// feed card still renders from the event metadata. Numeric extraction remains the
// enrichment path when values are present.
const ECON_KEYWORD_RE = /\b(actual|forecast)\b/i;

export async function processActualsFromTweets(
  tweets: Array<{
    id: string;
    text: string;
    author: string;
    publishedAt: string;
  }>,
  activeEvents: EconEvent[],
): Promise<void> {
  if (activeEvents.length === 0) return;

  const fjTweets = tweets.filter(
    (t) => t.author.toLowerCase() === "financialjuice",
  );

  for (const tweet of fjTweets) {
    if (!ECON_KEYWORD_RE.test(tweet.text)) continue;

    const event = matchTweetToEvent(tweet.text, activeEvents);
    if (!event) continue;

    const extracted = extractActualFromText(tweet.text);
    if (!event) continue;

    if (actualWrittenIds.has(event.id)) continue;
    actualWrittenIds.add(event.id);

    console.log(
      `[EconRettiwtPoller] ACTUAL DETECTED: "${event.name}" = ${extracted.actual} (from @${tweet.author})`,
    );

    updateEventActual(event.id, String(extracted.actual)).catch((err) =>
      console.warn(
        `[EconRettiwtPoller] Failed to update event actual for ${event.name}:`,
        err,
      ),
    );

    const today = new Date().toISOString().slice(0, 10);
    const printDate = event.date ?? today;
    const printForecast =
      extracted.forecast ??
      (event.forecast ? parseFloat(event.forecast) : undefined);
    const printPrevious =
      extracted.previous ??
      (event.previous ? parseFloat(event.previous) : undefined);

    writeEconPrint({
      eventName: event.name,
      date: printDate,
      actual: extracted.actual,
      forecast: printForecast,
      previous: printPrevious,
    }).catch((err) =>
      console.warn(
        `[EconRettiwtPoller] Failed to write econ print for ${event.name}:`,
        err,
      ),
    );

    injectEconPrintToFeed({
      eventName: event.name,
      actual: extracted.actual,
      forecast: printForecast,
      previous: printPrevious,
      date: printDate,
    }).catch((err) =>
      console.warn(
        `[EconRettiwtPoller] Failed to inject to RiskFlow for ${event.name}:`,
        err,
      ),
    );
  }
}

// ── Event Window Helpers ───────────────────────────────────────────────────

export function isInEventWindow(
  eventDate?: string,
  eventTime?: string,
): boolean {
  if (!eventDate || !eventTime) return false;
  try {
    const eventMs = new Date(`${eventDate}T${eventTime}`).getTime();
    const diffMin = (Date.now() - eventMs) / 60_000;
    return diffMin >= -PRE_EVENT_MINUTES && diffMin <= POST_EVENT_MINUTES;
  } catch {
    return false;
  }
}

export function isInBurstWindow(
  eventDate?: string,
  eventTime?: string,
): boolean {
  if (!eventDate || !eventTime) return false;
  try {
    const eventMs = new Date(`${eventDate}T${eventTime}`).getTime();
    const diffMs = Date.now() - eventMs;
    return diffMs >= 0 && diffMs <= BURST_DURATION_MS;
  } catch {
    return false;
  }
}

export function msUntilRelease(
  eventDate?: string,
  eventTime?: string,
): number | null {
  if (!eventDate || !eventTime) return null;
  try {
    return new Date(`${eventDate}T${eventTime}`).getTime() - Date.now();
  } catch {
    return null;
  }
}

// ── Query Builders ─────────────────────────────────────────────────────────

export function buildEventQueries(eventNames: string[]): string[] {
  const queries: string[] = [];
  for (const name of eventNames) {
    const upper = name.toUpperCase();
    if (upper.includes("CPI") || upper.includes("INFLATION")) {
      queries.push("CPI actual forecast inflation");
    } else if (
      upper.includes("NFP") ||
      upper.includes("PAYROLL") ||
      upper.includes("JOBS")
    ) {
      queries.push("NFP payrolls jobs report actual");
    } else if (
      upper.includes("FOMC") ||
      upper.includes("FED") ||
      upper.includes("INTEREST RATE")
    ) {
      queries.push("FOMC Fed rate decision actual");
    } else if (upper.includes("GDP")) {
      queries.push("GDP actual forecast growth");
    } else if (upper.includes("PPI")) {
      queries.push("PPI producer prices actual");
    } else if (upper.includes("RETAIL")) {
      queries.push("retail sales actual");
    } else if (upper.includes("PMI")) {
      queries.push("PMI actual manufacturing");
    } else if (upper.includes("JOBLESS") || upper.includes("CLAIMS")) {
      queries.push("jobless claims weekly actual");
    } else {
      queries.push(name.slice(0, 30));
    }
  }
  return [...new Set(queries)];
}

// ── Fetch Today's Active Events ────────────────────────────────────────────

export async function fetchActiveEvents(): Promise<{
  activeEvents: EconEvent[];
  highImportance: EconEvent[];
}> {
  const today = new Date().toISOString().slice(0, 10);
  try {
    const events = await fetchEconCalendar({ from: today, to: today });
    const highImportance = events.filter((e) => (e.importance ?? 1) >= 2);
    const activeEvents = highImportance.filter((e) =>
      isInEventWindow(e.date, e.time),
    );
    return { activeEvents, highImportance };
  } catch (err) {
    console.warn("[EconRettiwtPoller] Failed to fetch econ calendar:", err);
    return { activeEvents: [], highImportance: [] };
  }
}
