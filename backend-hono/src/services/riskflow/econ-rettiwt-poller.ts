// [claude-code 2026-04-11] Rettiwt-based econ poller — replaces twitter-cli econ-triggered-poller
// Full port: account rotation, econ calendar integration, burst polling, warm cache, rate tracking

import { createRateLimiter } from "../rate-limiter.js";
import { rettiwtUserTimeline, isRettiwtAvailable } from "../rettiwt-service.js";
import { scrapeMultiple } from "../agent-reach-service.js";
import { getPollingConfig } from "./polling-config.js";
import { storeFeedItems } from "./news-cache.js";
import {
  getAccountsForCycle,
  ALL_CONTINUOUS_ACCOUNTS,
  TIMELINE_LIMIT,
} from "./rettiwt-poller-accounts.js";
import {
  getActiveAccounts,
  getAccountHandles,
} from "../source-accounts/source-accounts-service.js";

// [claude-code 2026-04-26] User-managed source accounts now drive every poll
// path. Hardcoded ALL_CONTINUOUS_ACCOUNTS / FJ_ACCOUNTS is a fallback for cold
// boots only. Wire/Macro categories are treated as "burst-priority" — they're
// what fire when a high-impact econ event triggers a burst.
async function dbAccountsOrFallback(): Promise<string[]> {
  try {
    const handles = await getAccountHandles();
    if (handles.length > 0) return handles;
  } catch {
    /* fall through */
  }
  return [...ALL_CONTINUOUS_ACCOUNTS];
}

async function dbBurstAccountsOrFallback(): Promise<string[]> {
  try {
    const active = await getActiveAccounts();
    const burst = active
      .filter((a) => a.category === "Wire" || a.category === "Macro")
      .map((a) => a.handle);
    if (burst.length > 0) return burst;
  } catch {
    /* fall through */
  }
  return ["financialjuice"];
}
import {
  fetchActiveEvents,
  processActualsFromTweets,
  isInBurstWindow,
  msUntilRelease,
  activeBursts,
  BURST_INTERVAL_MS,
  BURST_DURATION_MS,
} from "./rettiwt-poller-econ.js";
import {
  processTweetBatch,
  tweetToFeedItem,
  pushToSupabase,
  filterByTier,
} from "./rettiwt-poller-transform.js";
import type { RettiwtSearchResult } from "../rettiwt-service.js";
import type { FeedItem } from "../../types/riskflow.js";
import type { EconEvent } from "../econ-calendar-service.js";

/** Normalize RettiwtSearchResult (publishedDate) → tweet shape (publishedAt) */
function toTweet(r: RettiwtSearchResult) {
  return {
    id: r.id,
    text: r.text,
    author: r.author,
    publishedAt: r.publishedDate,
  };
}

// Rate limiter: prevent API spam (tuned for Rettiwt limits)
const rettiwtLimiter = createRateLimiter({
  defaultRule: { limit: 16, windowMs: 60_000 },
  buckets: {
    "rettiwt-timeline": { limit: 12, windowMs: 60_000 },
    "rettiwt-search": { limit: 4, windowMs: 60_000 },
  },
  baseBackoffMs: 500,
  maxBackoffMs: 20_000,
  logger: (msg, data) =>
    console.log(`[RettiwtRateLimiter] ${msg}`, JSON.stringify(data ?? {})),
});

// ── Rate Limit Tracking ────────────────────────────────────────────────────

let consecutiveEmpties = 0;
let rateLimitedUntil = 0;
const EMPTY_THRESHOLD = 5;
const COOLDOWN_MS = 5 * 60_000;

export function isRettiwtRateLimited(): boolean {
  if (Date.now() < rateLimitedUntil) return true;
  if (consecutiveEmpties >= EMPTY_THRESHOLD) {
    rateLimitedUntil = Date.now() + COOLDOWN_MS;
    return true;
  }
  return false;
}

export function getRettiwtCooldownMs(): number {
  const remaining = rateLimitedUntil - Date.now();
  return remaining > 0 ? remaining : 0;
}

export function markRettiwtPollSuccess(): void {
  consecutiveEmpties = 0;
  rateLimitedUntil = 0;
}

export function markRettiwtPollEmpty(): void {
  consecutiveEmpties++;
}

// ── Warm Cache ─────────────────────────────────────────────────────────────

let warmCache: FeedItem[] = [];

async function initFetchHighPriorityPosts(): Promise<void> {
  if (!isRettiwtAvailable()) return;

  try {
    console.log(
      "[EconRettiwtPoller] Init fetch: pulling last 30 Medium+ posts from user-managed source accounts...",
    );

    const allAccounts = await dbAccountsOrFallback();
    const batches = await Promise.allSettled(
      allAccounts.map((account) =>
        rettiwtLimiter.schedule(
          () => rettiwtUserTimeline(account, { count: 50 }),
          { bucket: "rettiwt-timeline" },
        ),
      ),
    );
    const allTweets = batches.flatMap((r) =>
      r.status === "fulfilled" ? r.value.map(toTweet) : [],
    );

    const { feedItems } = processTweetBatch(allTweets);

    warmCache = feedItems
      .sort(
        (a, b) =>
          new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
      )
      .slice(0, 30);

    console.log(
      `[EconRettiwtPoller] Init warm cache: ${warmCache.length} Medium+ posts seeded`,
    );
    await storeFeedItems(warmCache).catch((err) =>
      console.warn("[EconRettiwtPoller] Failed to store warm cache:", err),
    );
    await pushToSupabase(warmCache);
  } catch (err) {
    console.warn("[EconRettiwtPoller] Init fetch failed:", err);
  }
}

export function getWarmCacheItems(): FeedItem[] {
  return warmCache;
}

// ── Burst Polling ──────────────────────────────────────────────────────────

function scheduleBurst(event: EconEvent): void {
  const burstKey = `${event.id}-${event.date}`;
  if (activeBursts.has(burstKey)) return;

  const msUntil = msUntilRelease(event.date, event.time);
  if (msUntil === null) return;

  const startBurst = () => {
    console.log(
      `[EconRettiwtPoller] BURST MODE: 5s polling for "${event.name}" (30s window)`,
    );

    let elapsed = 0;
    const burstInterval = setInterval(async () => {
      elapsed += BURST_INTERVAL_MS;
      if (elapsed > BURST_DURATION_MS) {
        clearInterval(burstInterval);
        activeBursts.delete(burstKey);
        console.log(`[EconRettiwtPoller] BURST END: "${event.name}"`);
        return;
      }

      try {
        const burstAccounts = await dbBurstAccountsOrFallback();
        const batches = await Promise.allSettled(
          burstAccounts.map((account) =>
            rettiwtLimiter.schedule(
              () => rettiwtUserTimeline(account, { count: 10 }),
              { bucket: "rettiwt-timeline" },
            ),
          ),
        );
        const tweets = batches.flatMap((r) =>
          r.status === "fulfilled" ? r.value.map(toTweet) : [],
        );

        const { feedItems, uniqueTweets } = processTweetBatch(tweets);
        await processActualsFromTweets(uniqueTweets, [event]);

        if (feedItems.length > 0) {
          const newItems = feedItems.filter(
            (f) => !warmCache.some((w) => w.id === f.id),
          );
          if (newItems.length > 0) {
            warmCache = [...newItems, ...warmCache].slice(0, 50);
            pushToSupabase(newItems).catch(() => {});
          }
        }
      } catch (err) {
        console.warn(
          `[EconRettiwtPoller] Burst poll error for ${event.name}:`,
          err,
        );
      }
    }, BURST_INTERVAL_MS);

    activeBursts.set(burstKey, burstInterval);
  };

  if (msUntil <= 0) {
    if (isInBurstWindow(event.date, event.time)) startBurst();
  } else {
    console.log(
      `[EconRettiwtPoller] Burst scheduled for "${event.name}" in ${Math.round(msUntil / 1000)}s`,
    );
    setTimeout(startBurst, msUntil);
  }
}

// ── Main Poll Function ─────────────────────────────────────────────────────

export async function pollForEconNews(): Promise<FeedItem[]> {
  // isRettiwtAvailable() is always true now (guest mode handles timelines)
  if (isRettiwtRateLimited()) {
    console.warn(
      `[EconRettiwtPoller] Rate limited — cooldown ${Math.round(getRettiwtCooldownMs() / 1000)}s remaining`,
    );
    return [];
  }

  // 1. Econ calendar: fetch events for burst scheduling + actual extraction
  const { activeEvents, highImportance } = await fetchActiveEvents();
  const activeEventNames = activeEvents.map((e) => e.name);

  if (activeEvents.length > 0) {
    console.log(
      `[EconRettiwtPoller] ${activeEvents.length} events in window: ${activeEventNames.join(", ")}`,
    );
  }

  // Schedule burst polling for upcoming events (within next 2 min)
  for (const event of highImportance) {
    const ms = msUntilRelease(event.date, event.time);
    if (ms !== null && ms > 0 && ms <= 120_000) scheduleBurst(event);
  }

  // 2. Poll accounts using rotation (timelines work with guest auth)
  const cycleAccounts = await getAccountsForCycle();
  const allTweetPromises: Promise<
    Array<{ id: string; text: string; author: string; publishedDate: string }>
  >[] = [];

  for (const account of cycleAccounts) {
    allTweetPromises.push(
      rettiwtLimiter.schedule(
        () => rettiwtUserTimeline(account, { count: TIMELINE_LIMIT }),
        { bucket: "rettiwt-timeline" },
      ),
    );
  }

  // 3. Event-triggered search REMOVED — rettiwtSearch pulls random garbage
  // All content now comes from curated account timelines only.

  const tweetBatches = await Promise.allSettled(allTweetPromises);
  const allTweets = tweetBatches.flatMap((r) =>
    r.status === "fulfilled" ? r.value.map(toTweet) : [],
  );

  // 4. Extract actuals from FJ tweets when events are active
  if (activeEvents.length > 0) {
    processActualsFromTweets(allTweets, activeEvents).catch((err) =>
      console.warn("[EconRettiwtPoller] Actual extraction error:", err),
    );
  }

  // 5. Dedupe, filter, convert
  const { feedItems, uniqueTweets } = processTweetBatch(allTweets);

  if (feedItems.length > 0) {
    console.log(
      `[EconRettiwtPoller] ${feedItems.length} items passed filter (from ${uniqueTweets.length} raw across ${cycleAccounts.length} accounts)`,
    );
    pushToSupabase(feedItems).catch(() => {});
  }

  return feedItems;
}

// ── Manual Refresh (Rettiwt + Agent-Reach) ─────────────────────────────────

const AGENT_REACH_URLS = [
  "https://www.financialjuice.com",
  "https://www.zerohedge.com",
  "https://www.reuters.com/business",
  "https://www.cnbc.com/economy",
];

export async function manualRefresh(): Promise<FeedItem[]> {
  const feedItems: FeedItem[] = [];

  // 1. Rettiwt timeline fetch
  if (isRettiwtAvailable() && !isRettiwtRateLimited()) {
    const cycleAccounts = await getAccountsForCycle();
    console.log(
      `[ManualRefresh] Fetching ${cycleAccounts.length} accounts via Rettiwt`,
    );

    const batches = await Promise.allSettled(
      cycleAccounts.map((account) =>
        rettiwtLimiter.schedule(
          () => rettiwtUserTimeline(account, { count: TIMELINE_LIMIT }),
          { bucket: "rettiwt-timeline" },
        ),
      ),
    );
    const allTweets = batches.flatMap((r) =>
      r.status === "fulfilled" ? r.value.map(toTweet) : [],
    );

    const { feedItems: rettiwtItems } = processTweetBatch(allTweets);
    feedItems.push(...rettiwtItems);
  }

  // 2. Agent-Reach scrape (always fires on manual refresh)
  try {
    const articles = await scrapeMultiple(AGENT_REACH_URLS);
    for (const article of articles) {
      if (!article.title || article.title.length < 15) continue;
      const classified = filterByTier(
        [{ text: article.title, id: `ar-${article.url}` }],
        "medium",
      );
      if (classified.length > 0) {
        feedItems.push(
          tweetToFeedItem(
            {
              id: `ar-${article.url}`,
              text: article.title,
              author: "AgentReach",
              publishedAt: article.publishedDate ?? new Date().toISOString(),
            },
            classified[0].fjClassification,
          ),
        );
      }
    }
  } catch (err) {
    console.warn("[ManualRefresh] Agent-Reach scrape failed:", err);
  }

  if (feedItems.length > 0) {
    console.log(`[ManualRefresh] ${feedItems.length} items total`);
    await storeFeedItems(feedItems).catch((err) =>
      console.warn("[ManualRefresh] Failed to store items:", err),
    );
    await pushToSupabase(feedItems).catch(() => {});
    const newItems = feedItems.filter(
      (f) => !warmCache.some((w) => w.id === f.id),
    );
    if (newItems.length > 0)
      warmCache = [...newItems, ...warmCache].slice(0, 50);
  }

  return feedItems;
}

// ── Night Poller ───────────────────────────────────────────────────────────

const NIGHT_POLL_INTERVAL_MS = 60 * 60 * 1000;
let nightPollerInterval: ReturnType<typeof setInterval> | null = null;

function isNightWindowEST(): boolean {
  const nowEST = new Date(
    new Date().toLocaleString("en-US", { timeZone: "America/New_York" }),
  );
  const hour = nowEST.getHours();
  return hour >= 19 || hour < 7;
}

async function nightPoll(): Promise<void> {
  if (!isNightWindowEST() || !isRettiwtAvailable()) return;

  console.log("[NightPoller] Hourly night poll running (7PM-7AM EST)");
  const allAccounts = await dbAccountsOrFallback();
  const batches = await Promise.allSettled(
    allAccounts.map((account) =>
      rettiwtLimiter.schedule(
        () => rettiwtUserTimeline(account, { count: TIMELINE_LIMIT }),
        { bucket: "rettiwt-timeline" },
      ),
    ),
  );
  const allTweets = batches.flatMap((r) =>
    r.status === "fulfilled" ? r.value.map(toTweet) : [],
  );

  const { feedItems } = processTweetBatch(allTweets);
  if (feedItems.length > 0) {
    console.log(`[NightPoller] ${feedItems.length} items passed filter`);
    await storeFeedItems(feedItems).catch(() => {});
    await pushToSupabase(feedItems).catch(() => {});
    const newItems = feedItems.filter(
      (f) => !warmCache.some((w) => w.id === f.id),
    );
    if (newItems.length > 0)
      warmCache = [...newItems, ...warmCache].slice(0, 50);
  }
}

// ── Lifecycle ──────────────────────────────────────────────────────────────

let pollerTimeout: ReturnType<typeof setTimeout> | null = null;
let pollerRunning = false;

export function startEconPoller(): void {
  if (pollerRunning) return;
  pollerRunning = true;
  console.log(
    "[EconRettiwtPoller] Starting with dynamic interval (hot=60s, rotation=180s)",
  );

  initFetchHighPriorityPosts().catch((err) =>
    console.warn("[EconRettiwtPoller] Init fetch error:", err),
  );

  const scheduledPoll = async (): Promise<void> => {
    if (!pollerRunning) return;
    try {
      await pollForEconNews();
    } catch (err) {
      console.warn("[EconRettiwtPoller] Poll error:", err);
    }
    const { interval, isHotHours } = getPollingConfig();
    console.debug(
      `[EconRettiwtPoller] Next poll in ${interval / 1000}s (hotHours=${isHotHours})`,
    );
    pollerTimeout = setTimeout(scheduledPoll, interval);
  };

  void scheduledPoll();

  // Night poller
  if (!nightPollerInterval) {
    nightPoll().catch(() => {});
    nightPollerInterval = setInterval(() => {
      nightPoll().catch(() => {});
    }, NIGHT_POLL_INTERVAL_MS);
  }
}

export function stopEconPoller(): void {
  pollerRunning = false;
  if (pollerTimeout) {
    clearTimeout(pollerTimeout);
    pollerTimeout = null;
  }
  for (const [key, interval] of activeBursts) {
    clearInterval(interval);
    activeBursts.delete(key);
  }
  if (nightPollerInterval) {
    clearInterval(nightPollerInterval);
    nightPollerInterval = null;
  }
  console.log("[EconRettiwtPoller] Stopped (all intervals cleared)");
}
