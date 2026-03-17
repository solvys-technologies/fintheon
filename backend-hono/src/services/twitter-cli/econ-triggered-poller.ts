// [claude-code 2026-03-10] Econ-triggered twitter poller — links Notion Econ Calendar to twitter-cli searches
// [claude-code 2026-03-10] Warm cache: filter 'high'→'medium', slice(10)→slice(30) for broader seed
// [claude-code 2026-03-10] Burst polling: 5s interval for 30s after econ release, actual extraction from FJ tweets
// [claude-code 2026-03-16] Smart polling: event-window-only (T-5min to T+15min), autoRefresh gate

import { searchTweets, fetchUserTimeline, isTwitterCliInstalled } from './twitter-cli-service.js';
import { filterByTier } from './fj-emoji-filter.js';
import { fetchEconCalendar, updateEventActual, writeEconPrint } from '../econ-calendar-service.js';
import { notionCreatePage } from '../notion-service.js';
import { injectEconPrintToFeed } from '../riskflow/econ-bridge.js';
import type { EconEvent } from '../econ-calendar-service.js';
import type { FeedItem, NewsSource } from '../../types/riskflow.js';
import { getUserSettings } from '../settings-store.js';

// Notion: write high-priority tweets to Harper Messages DB for persistence + agent visibility
const HARPER_MESSAGES_DB = '30c141b0da7d81ba8bb6e319a0c4c309';

// In-memory dedup — don't re-post same tweet ID to Notion across polls
const notionPostedIds = new Set<string>();

/** Push Critical/High FeedItems to Notion Harper Messages DB (fire-and-forget, deduplicated) */
async function pushToNotion(items: FeedItem[]): Promise<void> {
  const newItems = items.filter(
    (item) => (item.macroLevel ?? 1) >= 3 && !notionPostedIds.has(item.id)
  );
  if (newItems.length === 0) return;

  for (const item of newItems) {
    notionPostedIds.add(item.id);
    const tier = item.macroLevel === 4 ? 'Critical' : 'High';
    const headline = item.headline.slice(0, 200);

    notionCreatePage(HARPER_MESSAGES_DB, {
      Name: { title: [{ text: { content: `[${tier}] ${headline}` } }] },
      Message: { rich_text: [{ text: { content: item.headline.slice(0, 2000) } }] },
      Category: { select: { name: `RiskFlow-${tier}` } },
      Source: { select: { name: item.source === 'FinancialJuice' ? 'FinancialJuice' : 'TwitterCli' } },
      Status: { status: { name: 'Active' } },
    }).catch((err) => console.warn('[EconTwitterPoller] Notion push failed:', err));
  }

  console.log(`[EconTwitterPoller] Pushed ${newItems.length} ${newItems.map(i => i.macroLevel === 4 ? 'Critical' : 'High').join('/')} items to Notion`);
}

// ── Polling Modes ────────────────────────────────────────────────────────────
// IDLE:   Check Notion econ calendar only (no Twitter calls). Every 60s.
// ACTIVE: Poll FJ/InsiderWire/Trusted timelines + event searches. Every 60s.
//         Triggered only when a Tier-3 major event is within ±15 min.
// BURST:  5s rapid-fire FJ-only polling for 30s after release time.
//
// Tier-3 events that trigger ACTIVE mode:
//   CPI, PPI, NFP, GDP, PCE, FED RATE/FOMC, PMI, Trump-related
//
// Set TWITTER_POLLING_ENABLED=false to disable all Twitter polling entirely.

const IDLE_INTERVAL_MS = 60_000;    // 60s — check calendar, no Twitter calls
const ACTIVE_INTERVAL_MS = 60_000;  // 60s — full Twitter polling during event window
const BURST_INTERVAL_MS = 5_000;    // 5s — rapid FJ-only during release
const BURST_DURATION_MS = 30_000;   // 30s burst window after release time
const EVENT_WINDOW_MINUTES = 15;    // ±15 min around event = ACTIVE mode

const TWITTER_POLLING_ENABLED = (process.env.TWITTER_POLLING_ENABLED ?? 'true').toLowerCase() !== 'false';

/** Check if we're in the Twitter polling window: Mon-Fri, 7:00 AM - 6:00 PM ET */
function isInPollingWindow(): boolean {
  const now = new Date();
  const et = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const day = et.getDay(); // 0=Sun, 6=Sat
  if (day === 0 || day === 6) return false;
  const hour = et.getHours();
  return hour >= 7 && hour < 18; // 7:00 AM - 5:59 PM ET
}

// ── Tier-3 Major Event Keywords ──────────────────────────────────────────────
// Only these events trigger ACTIVE Twitter polling. Everything else stays IDLE.

const TIER3_EVENT_KEYWORDS = [
  'CPI', 'INFLATION',
  'PPI', 'PRODUCER PRICE',
  'NFP', 'NONFARM', 'NON-FARM', 'PAYROLL',
  'GDP',
  'PCE', 'PERSONAL CONSUMPTION',
  'FOMC', 'FED RATE', 'INTEREST RATE', 'FEDERAL RESERVE',
  'PMI',
  'TRUMP', 'TARIFF',
] as const;

/** Check if an event name matches a Tier-3 major event */
function isTier3Event(eventName: string): boolean {
  const upper = eventName.toUpperCase();
  return TIER3_EVENT_KEYWORDS.some((kw) => upper.includes(kw));
}

// Financial Juice and InsiderWire screen names to always fetch
const FJ_ACCOUNTS = ['financialjuice', 'InsiderWire'] as const;

// Trusted macro/econ accounts — always polled alongside FJ
const TRUSTED_ACCOUNTS = ['NickTimiraos'] as const;

// Max tweets per search / timeline call
const SEARCH_LIMIT = 20;
const TIMELINE_LIMIT = 30;

// ── Burst Polling State ──────────────────────────────────────────────────────

/** Track active burst intervals per event to prevent duplicates */
const activeBursts = new Map<string, ReturnType<typeof setInterval>>();

/** Track which event IDs already had actuals written (prevent duplicate writes) */
const actualWrittenIds = new Set<string>();

// ── Actual Extraction from FJ Tweets ─────────────────────────────────────────

/**
 * FJ tweets economic data in a consistent format:
 *   "US CPI (MoM) Actual: 0.4% (Forecast: 0.3%, Previous: 0.5%)"
 *   "US Core CPI YoY Actual 3.2% vs Forecast 3.1%"
 *   "Actual: 2.9% | Forecast: 3.1% | Previous: 2.8%"
 *   "CPI 0.4% (exp 0.3%)"
 */
const ACTUAL_PATTERNS = [
  // "Actual: 0.4%" or "Actual 0.4%"
  /\bActual[:\s]+(-?\d+\.?\d*)\s*%?/i,
  // "Actual: 256K" or "Actual: 1.234M"
  /\bActual[:\s]+(-?\d+\.?\d*)\s*[KkMm]?\b/i,
  // "came in at 0.4%" or "prints 0.4%"
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

function extractActualFromText(text: string): ExtractedActual | null {
  let actualStr: string | undefined;
  for (const pattern of ACTUAL_PATTERNS) {
    const match = text.match(pattern);
    if (match?.[1]) { actualStr = match[1]; break; }
  }
  if (!actualStr) return null;

  const actual = parseFloat(actualStr);
  if (isNaN(actual)) return null;

  let forecast: number | undefined;
  for (const pattern of FORECAST_PATTERNS) {
    const match = text.match(pattern);
    if (match?.[1]) { forecast = parseFloat(match[1]); break; }
  }

  let previous: number | undefined;
  for (const pattern of PREVIOUS_PATTERNS) {
    const match = text.match(pattern);
    if (match?.[1]) { previous = parseFloat(match[1]); break; }
  }

  return { actual, forecast, previous };
}

/**
 * Match a tweet to an active econ event by keyword overlap.
 * Returns the best-matching event or null.
 */
function matchTweetToEvent(
  tweetText: string,
  events: EconEvent[]
): EconEvent | null {
  const upper = tweetText.toUpperCase();
  let bestMatch: EconEvent | null = null;
  let bestScore = 0;

  for (const event of events) {
    const eventUpper = event.name.toUpperCase();
    // Score by keyword overlap
    const keywords = eventUpper.split(/\s+/).filter((w) => w.length > 2);
    let score = 0;
    for (const kw of keywords) {
      if (upper.includes(kw)) score++;
    }
    // Bonus for exact abbreviation matches
    if (eventUpper.includes('CPI') && upper.includes('CPI')) score += 3;
    if (eventUpper.includes('PPI') && upper.includes('PPI')) score += 3;
    if (eventUpper.includes('NFP') && upper.includes('NFP')) score += 3;
    if (eventUpper.includes('GDP') && upper.includes('GDP')) score += 3;
    if (eventUpper.includes('PCE') && upper.includes('PCE')) score += 3;
    if (eventUpper.includes('FOMC') && upper.includes('FOMC')) score += 3;
    if (eventUpper.includes('RETAIL') && upper.includes('RETAIL')) score += 2;
    if (eventUpper.includes('CLAIMS') && upper.includes('CLAIMS')) score += 2;
    if (eventUpper.includes('PMI') && upper.includes('PMI')) score += 2;

    if (score > bestScore) {
      bestScore = score;
      bestMatch = event;
    }
  }

  return bestScore >= 2 ? bestMatch : null;
}

/**
 * Process FJ tweets for actual values. When an "Actual" is detected:
 * 1. Match to the active econ event
 * 2. Update the Notion Econ Calendar event with the actual
 * 3. Write a new Econ Print to the prints DB
 */
async function processActualsFromTweets(
  tweets: Array<{ id: string; text: string; author: string; publishedAt: string }>,
  activeEvents: EconEvent[]
): Promise<void> {
  if (activeEvents.length === 0) return;

  // Only process FJ / InsiderWire tweets (they're the source of truth for actuals)
  const fjTweets = tweets.filter((t) => {
    const lower = t.author.toLowerCase();
    return lower === 'financialjuice' || lower === 'insiderwire';
  });

  for (const tweet of fjTweets) {
    const extracted = extractActualFromText(tweet.text);
    if (!extracted) continue;

    const event = matchTweetToEvent(tweet.text, activeEvents);
    if (!event) continue;

    // Prevent duplicate writes for the same event
    if (actualWrittenIds.has(event.id)) continue;
    actualWrittenIds.add(event.id);

    console.log(`[EconTwitterPoller] ACTUAL DETECTED: "${event.name}" = ${extracted.actual} (from @${tweet.author})`);

    // 1. Update the Econ Calendar event row with the actual string
    updateEventActual(event.id, String(extracted.actual)).catch((err) =>
      console.warn(`[EconTwitterPoller] Failed to update event actual for ${event.name}:`, err)
    );

    // 2. Write to the Econ Prints DB
    const today = new Date().toISOString().slice(0, 10);
    const printDate = event.date ?? today;
    const printForecast = extracted.forecast ?? (event.forecast ? parseFloat(event.forecast) : undefined);
    const printPrevious = extracted.previous ?? (event.previous ? parseFloat(event.previous) : undefined);
    writeEconPrint({
      eventName: event.name,
      date: printDate,
      actual: extracted.actual,
      forecast: printForecast,
      previous: printPrevious,
    }).catch((err) =>
      console.warn(`[EconTwitterPoller] Failed to write econ print for ${event.name}:`, err)
    );

    // 3. Inject into RiskFlow feed for IV scoring engine
    injectEconPrintToFeed({
      eventName: event.name,
      actual: extracted.actual,
      forecast: printForecast,
      previous: printPrevious,
      date: printDate,
    }).catch((err) =>
      console.warn(`[EconTwitterPoller] Failed to inject to RiskFlow for ${event.name}:`, err)
    );
  }
}

// ── Query Builders ───────────────────────────────────────────────────────────

/**
 * Build twitter search queries from today's active econ events.
 * e.g., "CPI Actual Forecast" or "NFP payrolls" etc.
 */
function buildEventQueries(eventNames: string[]): string[] {
  const queries: string[] = [];
  for (const name of eventNames) {
    const upper = name.toUpperCase();
    if (upper.includes('CPI') || upper.includes('INFLATION')) {
      queries.push('CPI actual forecast inflation');
    } else if (upper.includes('NFP') || upper.includes('PAYROLL') || upper.includes('JOBS')) {
      queries.push('NFP payrolls jobs report actual');
    } else if (upper.includes('FOMC') || upper.includes('FED') || upper.includes('INTEREST RATE')) {
      queries.push('FOMC Fed rate decision actual');
    } else if (upper.includes('GDP')) {
      queries.push('GDP actual forecast growth');
    } else if (upper.includes('PPI')) {
      queries.push('PPI producer prices actual');
    } else if (upper.includes('RETAIL')) {
      queries.push('retail sales actual');
    } else if (upper.includes('PMI')) {
      queries.push('PMI actual manufacturing');
    } else if (upper.includes('JOBLESS') || upper.includes('CLAIMS')) {
      queries.push('jobless claims weekly actual');
    } else {
      queries.push(name.slice(0, 30));
    }
  }
  return [...new Set(queries)];
}

// ── Event Time Checks ────────────────────────────────────────────────────────

/**
 * Check if an econ event is within the polling window: T-5min to T+15min.
 */
function isEventActive(eventDate?: string, eventTime?: string): boolean {
  if (!eventDate || !eventTime) return false;
  try {
    const eventMs = new Date(`${eventDate}T${eventTime}`).getTime();
    const nowMs = Date.now();
    const diffMin = (nowMs - eventMs) / 60_000;
    return diffMin >= -EVENT_WINDOW_MINUTES && diffMin <= EVENT_WINDOW_MINUTES;
  } catch {
    return false;
  }
}

/**
 * Check if an econ event is in the burst window: 0–30s AFTER release time.
 * Returns true if we should be in 5s burst polling mode.
 */
function isInBurstWindow(eventDate?: string, eventTime?: string): boolean {
  if (!eventDate || !eventTime) return false;
  try {
    const eventMs = new Date(`${eventDate}T${eventTime}`).getTime();
    const nowMs = Date.now();
    const diffMs = nowMs - eventMs;
    // Burst window: from release time to 30s after
    return diffMs >= 0 && diffMs <= BURST_DURATION_MS;
  } catch {
    return false;
  }
}

/**
 * Get milliseconds until an event's release time (for scheduling burst).
 * Returns negative if event is in the past.
 */
function msUntilRelease(eventDate?: string, eventTime?: string): number | null {
  if (!eventDate || !eventTime) return null;
  try {
    const eventMs = new Date(`${eventDate}T${eventTime}`).getTime();
    return eventMs - Date.now();
  } catch {
    return null;
  }
}

// ── FeedItem Conversion ──────────────────────────────────────────────────────

function tweetToFeedItem(
  tweet: { id: string; text: string; author: string; publishedAt: string },
  macroLevel: 1 | 2 | 3 | 4,
  urgency: 'immediate' | 'high' | 'normal'
): FeedItem {
  const authorLower = tweet.author.toLowerCase();
  const source: NewsSource =
    authorLower === 'financialjuice' ? 'FinancialJuice' :
    authorLower === 'insiderwire' ? 'InsiderWire' :
    'TwitterCli';

  return {
    id: `twcli-${tweet.id}`,
    source,
    headline: tweet.text,
    symbols: extractSymbolsFromText(tweet.text),
    tags: extractTagsFromText(tweet.text),
    isBreaking: urgency === 'immediate',
    urgency,
    macroLevel,
    publishedAt: tweet.publishedAt,
  };
}

function extractSymbolsFromText(text: string): string[] {
  const cashtags = text.match(/\$[A-Z]{1,5}\b/g)?.map((s) => s.replace('$', '')) ?? [];
  const known = ['SPY', 'QQQ', 'ES', 'NQ', 'TLT', 'DXY', 'VIX', 'CL', 'GC', 'BTC'];
  const inferred = known.filter((t) => new RegExp(`\\b${t}\\b`).test(text.toUpperCase()));
  return [...new Set([...cashtags, ...inferred])];
}

function extractTagsFromText(text: string): string[] {
  const tags: string[] = [];
  const upper = text.toUpperCase();
  if (upper.includes('CPI') || upper.includes('INFLATION')) tags.push('CPI', 'INFLATION');
  if (upper.includes('NFP') || upper.includes('PAYROLL')) tags.push('NFP', 'JOBS');
  if (upper.includes('FOMC') || upper.includes('FED') || upper.includes('POWELL')) tags.push('FED', 'FOMC');
  if (upper.includes('GDP')) tags.push('GDP');
  if (upper.includes('PPI')) tags.push('PPI');
  if (upper.includes('PMI')) tags.push('PMI');
  if (upper.includes('RETAIL SALES')) tags.push('RETAIL');
  if (upper.includes('JOBLESS') || upper.includes('CLAIMS')) tags.push('JOBLESS');
  return tags;
}

// ── Polling Mode State ───────────────────────────────────────────────────────

type PollingMode = 'idle' | 'active';
let currentMode: PollingMode = 'idle';

/** Exported for status/debug endpoints */
export function getPollingMode(): PollingMode {
  return currentMode;
}

// ── Main Poll Function ───────────────────────────────────────────────────────

/**
 * Event-driven poll function. Each 60s tick:
 *   1. Always checks Notion econ calendar (cheap, no Twitter calls)
 *   2. If a Tier-3 major event is within ±15 min → ACTIVE mode (poll Twitter)
 *   3. Otherwise → IDLE mode (no Twitter calls, serve warm cache)
 *
 * This reduces Twitter CLI invocations from ~2,000/day to ~50-100/day
 * (only around CPI, NFP, FOMC, etc. releases).
 */
export async function pollTwitterForEconNews(): Promise<FeedItem[]> {
  if (!TWITTER_POLLING_ENABLED) return [];

  // Respect autoRefresh setting
  try {
    const settings = await getUserSettings('default');
    if (settings.autoRefresh === false) {
      console.debug('[EconTwitterPoller] autoRefresh disabled, skipping');
      return [];
    }
  } catch { /* proceed if settings unavailable */ }

  if (!isInPollingWindow()) {
    if (currentMode !== 'idle') {
      console.log('[EconTwitterPoller] Outside polling window — switching to IDLE');
      currentMode = 'idle';
    }
    return [];
  }

  const today = new Date().toISOString().slice(0, 10);

  // 1. Always check Notion econ calendar (no Twitter calls)
  let tier3ActiveEvents: EconEvent[] = [];
  let tier3ActiveNames: string[] = [];
  try {
    const events = await fetchEconCalendar({ from: today, to: today });
    const highImportance = events.filter((e) => (e.importance ?? 1) >= 2);

    // Filter to Tier-3 major events that are within the event window
    const tier3Events = highImportance.filter((e) => isTier3Event(e.name));
    tier3ActiveEvents = tier3Events.filter((e) => isEventActive(e.date, e.time));
    tier3ActiveNames = tier3ActiveEvents.map((e) => e.name);

    // Schedule burst polling for upcoming Tier-3 events (within next 2 min)
    for (const event of tier3Events) {
      const msUntil = msUntilRelease(event.date, event.time);
      if (msUntil !== null && msUntil > 0 && msUntil <= 120_000) {
        scheduleBurst(event);
      }
    }

  } catch (err) {
    console.warn('[EconTwitterPoller] Failed to fetch econ calendar:', err);
  }

  // 2. Determine polling mode
  const shouldBeActive = tier3ActiveEvents.length > 0;

  if (shouldBeActive && currentMode !== 'active') {
    console.log(`[EconTwitterPoller] ACTIVE MODE: Tier-3 events in window — ${tier3ActiveNames.join(', ')}`);
    currentMode = 'active';
  } else if (!shouldBeActive && currentMode !== 'idle') {
    console.log('[EconTwitterPoller] IDLE MODE: No Tier-3 events in window — pausing Twitter calls');
    currentMode = 'idle';
  }

  // 3. IDLE mode — no Twitter calls, just return warm cache
  if (currentMode === 'idle') {
    return [];
  }

  // 4. ACTIVE mode — poll Twitter (only reached when Tier-3 event is near)
  const installed = await isTwitterCliInstalled();
  if (!installed) {
    console.debug('[EconTwitterPoller] twitter-cli not installed, skipping');
    return [];
  }

  // Build search queries from active Tier-3 events
  const searchQueries = buildEventQueries(tier3ActiveNames);

  // Collect tweets: FJ + InsiderWire + Trusted + event searches
  // Stagger calls with small delays to reduce scraping fingerprint
  const allTweets: Array<{ id: string; text: string; author: string; publishedAt: string }> = [];

  // Sequential with 3s delays between calls (Grok recommendation)
  for (const account of FJ_ACCOUNTS) {
    const tweets = await fetchUserTimeline(account, { limit: TIMELINE_LIMIT }).catch(() => []);
    allTweets.push(...tweets);
    await delay(3_000);
  }

  for (const account of TRUSTED_ACCOUNTS) {
    const tweets = await fetchUserTimeline(account, { limit: TIMELINE_LIMIT }).catch(() => []);
    allTweets.push(...tweets);
    await delay(3_000);
  }

  for (const query of searchQueries) {
    const tweets = await searchTweets(query, { limit: SEARCH_LIMIT, filter: 'latest' }).catch(() => []);
    allTweets.push(...tweets);
    await delay(3_000);
  }

  // Dedupe by tweet id
  const seenIds = new Set<string>();
  const uniqueTweets = allTweets.filter((t) => {
    if (seenIds.has(t.id)) return false;
    seenIds.add(t.id);
    return true;
  });

  // Extract actuals from FJ tweets and write to Notion (fire-and-forget)
  processActualsFromTweets(uniqueTweets, tier3ActiveEvents).catch((err) =>
    console.warn('[EconTwitterPoller] Actual extraction error:', err)
  );

  // Apply FJ emoji tier filter (medium+)
  const classified = filterByTier(uniqueTweets, 'medium');

  // Convert to FeedItem[]
  const feedItems: FeedItem[] = classified.map((t) =>
    tweetToFeedItem(t, t.fjClassification.macroLevel, t.fjClassification.urgency)
  );

  if (feedItems.length > 0) {
    console.log(`[EconTwitterPoller] ${feedItems.length} items passed filter (from ${uniqueTweets.length} raw, mode=ACTIVE)`);
    pushToNotion(feedItems).catch(() => {});
  }

  return feedItems;
}

/** Small delay helper for staggering Twitter calls */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Burst Polling ────────────────────────────────────────────────────────────

/**
 * Schedule a 5s burst poll for 30s starting at an event's release time.
 * If the event is already in the burst window, starts immediately.
 * Prevents duplicate bursts for the same event.
 */
function scheduleBurst(event: EconEvent): void {
  const burstKey = `${event.id}-${event.date}`;
  if (activeBursts.has(burstKey)) return; // already scheduled

  const msUntil = msUntilRelease(event.date, event.time);
  if (msUntil === null) return;

  const startBurst = () => {
    console.log(`[EconTwitterPoller] BURST MODE: 5s polling for "${event.name}" (30s window)`);

    let elapsed = 0;
    const burstInterval = setInterval(async () => {
      elapsed += BURST_INTERVAL_MS;
      if (elapsed > BURST_DURATION_MS) {
        clearInterval(burstInterval);
        activeBursts.delete(burstKey);
        console.log(`[EconTwitterPoller] BURST END: "${event.name}" — returning to 60s polling`);
        return;
      }

      try {
        // Rapid-fire: only fetch FJ + InsiderWire (fastest actual sources)
        const batches = await Promise.allSettled(
          FJ_ACCOUNTS.map((account) => fetchUserTimeline(account, { limit: 10 }))
        );
        const tweets = batches.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));

        // Dedupe
        const seenIds = new Set<string>();
        const unique = tweets.filter((t) => {
          if (seenIds.has(t.id)) return false;
          seenIds.add(t.id);
          return true;
        });

        // Extract actuals immediately
        await processActualsFromTweets(unique, [event]);

        // Also convert to feed items for the UI
        const classified = filterByTier(unique, 'medium');
        const feedItems = classified.map((t) =>
          tweetToFeedItem(t, t.fjClassification.macroLevel, t.fjClassification.urgency)
        );

        if (feedItems.length > 0) {
          // Update warm cache with burst items so feed-service picks them up
          const newItems = feedItems.filter((f) => !warmCache.some((w) => w.id === f.id));
          if (newItems.length > 0) {
            warmCache = [...newItems, ...warmCache].slice(0, 50);
            pushToNotion(newItems).catch(() => {});
          }
        }
      } catch (err) {
        console.warn(`[EconTwitterPoller] Burst poll error for ${event.name}:`, err);
      }
    }, BURST_INTERVAL_MS);

    activeBursts.set(burstKey, burstInterval);
  };

  if (msUntil <= 0) {
    // Already past release time — start burst immediately if within window
    if (isInBurstWindow(event.date, event.time)) {
      startBurst();
    }
  } else {
    // Schedule burst to start at release time
    console.log(`[EconTwitterPoller] Burst scheduled for "${event.name}" in ${Math.round(msUntil / 1000)}s`);
    setTimeout(startBurst, msUntil);
  }
}

// ── Warm Cache ───────────────────────────────────────────────────────────────

let warmCache: FeedItem[] = [];

async function initFetchHighPriorityPosts(): Promise<void> {
  if (!TWITTER_POLLING_ENABLED || !isInPollingWindow()) return;

  const installed = await isTwitterCliInstalled();
  if (!installed) return;

  try {
    console.log('[EconTwitterPoller] Init fetch: pulling last 30 Medium+ posts from FJ + InsiderWire + Trusted...');

    const allAccounts = [...FJ_ACCOUNTS, ...TRUSTED_ACCOUNTS];
    const batches = await Promise.allSettled(
      allAccounts.map((account) => fetchUserTimeline(account, { limit: 50 }))
    );
    const allTweets = batches.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));

    const mediumPlus = filterByTier(allTweets, 'medium');

    const seenIds = new Set<string>();
    const top30 = mediumPlus
      .filter((t) => {
        if (seenIds.has(t.id)) return false;
        seenIds.add(t.id);
        return true;
      })
      .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
      .slice(0, 30);

    warmCache = top30.map((t) =>
      tweetToFeedItem(t, t.fjClassification.macroLevel, t.fjClassification.urgency)
    );

    console.log(`[EconTwitterPoller] Init warm cache: ${warmCache.length} Medium+ posts seeded`);
    await pushToNotion(warmCache);
  } catch (err) {
    console.warn('[EconTwitterPoller] Init fetch failed:', err);
  }
}

/** Return the current warm-cached posts (populated on startup + burst updates) */
export function getWarmCacheItems(): FeedItem[] {
  return warmCache;
}

// ── Lifecycle ────────────────────────────────────────────────────────────────

let pollerInterval: ReturnType<typeof setInterval> | null = null;

export function startEconTwitterPoller(): void {
  if (pollerInterval) return;

  if (!TWITTER_POLLING_ENABLED) {
    console.log('[EconTwitterPoller] Disabled via TWITTER_POLLING_ENABLED=false');
    return;
  }

  console.log('[EconTwitterPoller] Starting (IDLE by default, ACTIVE only for Tier-3 events: CPI/PPI/NFP/GDP/PCE/FOMC/PMI/Trump)');

  initFetchHighPriorityPosts().then(() => {
    pollTwitterForEconNews().catch((err) =>
      console.warn('[EconTwitterPoller] Initial poll error:', err)
    );
  }).catch((err) => console.warn('[EconTwitterPoller] Init fetch error:', err));

  pollerInterval = setInterval(() => {
    pollTwitterForEconNews().catch((err) =>
      console.warn('[EconTwitterPoller] Poll error:', err)
    );
  }, IDLE_INTERVAL_MS);
}

export function stopEconTwitterPoller(): void {
  if (pollerInterval) {
    clearInterval(pollerInterval);
    pollerInterval = null;
  }
  // Clear all active burst intervals
  for (const [key, interval] of activeBursts) {
    clearInterval(interval);
    activeBursts.delete(key);
  }
  console.log('[EconTwitterPoller] Stopped (all burst intervals cleared)');
}
