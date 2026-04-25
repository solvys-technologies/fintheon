/**
 * Feed Poller Service
 * Continuously polls for new news items and broadcasts Level 4 events instantly
 * Runs independently of HTTP requests for real-time updates
 */
// [claude-code 2026-04-19] S27-T4: Rettiwt cut from Herald dispatcher. Replaced with
// no-op stubs so the structure is preserved for fast re-enable. browser-harness is the
// primary replacement; headline volume telemetry quantifies the migration on riskflow_items.
// [claude-code 2026-04-02] Dynamic polling: hot hours 60s (8-11AM ET), rotation 180s (all other times, 24/7).
// [claude-code 2026-03-12] Removed X API dependency — all tweet ingestion now via Rettiwt

// [claude-code 2026-03-27] S3: Write raw items to raw_riskflow_items for central scorer pipeline
// [claude-code 2026-04-02] Removed user autoRefresh gating — backend polling is autonomous.
import * as newsCache from "./news-cache.js";
import { enrichFeedWithAnalysis, updateFeedCache } from "./feed-service.js";
import { broadcastLevel4 } from "./sse-broadcaster.js";
import { fetchEconomicFeed } from "./economic-feed.js";
import { writeRawItems, type RawRiskFlowItem } from "../supabase-service.js";
import { isSupabaseConfigured } from "../../config/supabase.js";
import { getPollingConfig } from "./polling-config.js";
import { pollCommentary } from "./commentary-scraper.js";
import { checkForScheduledEvents } from "./exa-scheduled-monitor.js";
import { getAccountHandles } from "../source-accounts/source-accounts-service.js";
import {
  areAllUsersKilled,
  advancePollingOwner,
  getCurrentPollingOwner,
  recordUserPollSuccess,
  recordUserPollAttempt,
} from "./user-polling-registry.js";
import type { FeedItem } from "../../types/riskflow.js";
import { createLogger } from "../../lib/logger.js";
import { filterWithContentGuard } from "./content-guard.js";
import {
  register as registerService,
  recordRun,
  recordError,
} from "../health-registry.js";

const FEED_POLLER_HEALTH_NAME = "feed-poller";
registerService(FEED_POLLER_HEALTH_NAME);

// [claude-code 2026-04-19] S27-T4: inert Rettiwt stubs. Dispatcher compiles + runs
// without Rettiwt; if the curated-timeline path is ever needed again, restore by
// re-importing from ../rettiwt-service.js + ./econ-rettiwt-poller.js.
const hasAuthenticatedKeys = (): boolean => false;
const isRettiwtRateLimited = (): boolean => false;
const markRettiwtPollSuccess = (): void => {};
const markRettiwtPollEmpty = (): void => {};
const pollForEconNews = async (): Promise<FeedItem[]> => [];
const manualRefresh = async (): Promise<FeedItem[]> => [];
const rettiwtUserTimeline = async (
  _handle: string,
  _opts: { count: number },
): Promise<Array<{ text: string; url?: string; publishedDate?: string }>> => [];

/** Convert a FeedItem to a RawRiskFlowItem for the raw_riskflow_items inbox */
function feedItemToRaw(item: FeedItem): RawRiskFlowItem {
  return {
    tweet_id: item.id,
    source: item.source,
    headline: item.headline,
    body: item.body,
    symbols: item.symbols,
    tags: item.tags,
    is_breaking: item.isBreaking,
    urgency: item.urgency,
    published_at: item.publishedAt,
    submitted_by: "feed-poller",
  };
}

const log = createLogger("FeedPoller");

let pollTimeout: ReturnType<typeof setTimeout> | null = null;
let isPolling = false;
let consecutivePollingFailures = 0;
let lastPollingAttemptMs = 0;
const POLLING_WARN_THRESHOLD = 5;
const POLLING_CRITICAL_THRESHOLD = 10;
const POLLING_BACKOFF_INTERVAL_MS = 60_000; // extended retry after WARN_THRESHOLD

function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(
        () =>
          reject(new Error(`[FeedPoller] ${label} timed out after ${ms}ms`)),
        ms,
      ),
    ),
  ]);
}

// Health tracking for observability
let _pollsSinceLastLog = 0;
let _itemsSinceLastLog = 0;
let _lastHealthLog = 0;
const HEALTH_LOG_INTERVAL = 10 * 60_000; // Log health every 10 minutes

// S10-T1c: Manual toggle state — when false, ALL polling stops
let manualToggleEnabled = true;

/**
 * Backend polling is autonomous. Only the manual admin toggle can disable it.
 * When all users kill their feed, polling switches to scrape-only mode.
 */
function isPollingAllowed(): boolean {
  if (!manualToggleEnabled) {
    log.info("Polling blocked: manual toggle is OFF");
    return false;
  }
  return true;
}

function shouldUseScrapeOnly(): boolean {
  return areAllUsersKilled();
}

/** Set the manual polling toggle. When false, ALL X API calls stop. */
export function setPollingToggle(enabled: boolean): void {
  manualToggleEnabled = enabled;
  log.info(` Polling toggle set to ${enabled ? "ON" : "OFF"}`);
}

/** Get current polling toggle state */
export function getPollingToggle(): boolean {
  return manualToggleEnabled;
}

/**
 * Log pipeline health periodically so operators can verify the feed is alive.
 */
function maybeLogHealth(): void {
  const now = Date.now();
  if (now - _lastHealthLog < HEALTH_LOG_INTERVAL) return;
  _lastHealthLog = now;

  const { interval, isHotHours } = getPollingConfig();
  const intervalDesc = `${interval / 1000}s (${isHotHours ? "hot" : "rotation"})`;

  log.info(
    `Pipeline health: ${_pollsSinceLastLog} polls, ${_itemsSinceLastLog} new items in last 10min | interval: ${intervalDesc} | toggle: ${manualToggleEnabled ? "ON" : "OFF"}`,
  );

  _pollsSinceLastLog = 0;
  _itemsSinceLastLog = 0;
}

// ── Curated Timeline Fallback (runs when main poller is rate-limited) ──────
// [claude-code 2026-04-12] Replaced open rettiwtSearch + Exa with curated timeline pulls

const fallbackSeenIds = new Set<string>();

function hashForDedup(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h).toString(36);
}

export async function runScrapeFallback(): Promise<number> {
  if (!isSupabaseConfigured()) return 0;

  log.info("[ScrapeFallback] Running curated timeline + Agent-Reach fallback");
  let totalWritten = 0;

  // ── Step 1: Pull curated account timelines ──
  // [claude-code 2026-04-16] Use hasAuthenticatedKeys() — isRettiwtAvailable() returns true even when
  // all keys are on cooldown, causing silent failures in timeline fetches.
  if (hasAuthenticatedKeys()) {
    const handles = await getAccountHandles();
    for (const handle of handles) {
      try {
        const results = await rettiwtUserTimeline(handle, { count: 10 });
        const items: RawRiskFlowItem[] = [];
        for (const r of results) {
          const title = r.text?.trim().slice(0, 280);
          if (!title || title.length < 15) continue;

          const id = `fb-${handle}-${hashForDedup(title.toLowerCase())}`;
          if (fallbackSeenIds.has(id)) continue;
          fallbackSeenIds.add(id);

          const isBreaking = /\b(breaking|urgent|alert|flash)\b/i.test(title);

          items.push({
            tweet_id: id,
            source: "CuratedTimeline",
            headline: title,
            body: r.text.length > 280 ? r.text.slice(280, 600) : undefined,
            url: r.url || undefined,
            symbols: [],
            tags: [],
            is_breaking: isBreaking,
            urgency: isBreaking ? "immediate" : "normal",
            published_at: r.publishedDate ?? new Date().toISOString(),
            submitted_by: `feed-poller:timeline-${handle}`,
          });
        }

        const cleanItems = filterWithContentGuard(
          items,
          (i) => `${i.headline} ${i.body || ""}`,
          { source: `feed-poller:timeline-${handle}` },
        );
        if (cleanItems.length > 0) {
          const written = await writeRawItems(cleanItems);
          totalWritten += written;
        }
      } catch (err) {
        log.warn(`[ScrapeFallback] @${handle} timeline failed`, {
          error: String(err),
        });
      }
    }
    log.info(
      `[ScrapeFallback] Timeline phase done — ${totalWritten} items written`,
    );
  }

  // [claude-code 2026-04-18] S25-T1: Agent-Reach scrape removed from this fallback.
  // The dedicated agent-reach-poller now runs on its own schedule with UA rotation, per-domain
  // token bucket, and circuit breaker. Letting both run double-dipped the domain rate budgets.

  // Also run commentary + scheduled event scrapers
  await Promise.all([
    pollCommentary().catch((err) =>
      log.warn("[ScrapeFallback] Commentary scrape failed:", {
        error: String(err),
      }),
    ),
    checkForScheduledEvents().catch((err) =>
      log.warn("[ScrapeFallback] Scheduled events failed:", {
        error: String(err),
      }),
    ),
  ]);

  log.info(
    `[ScrapeFallback] Done — ${totalWritten} new items written to raw_riskflow_items`,
  );
  return totalWritten;
}

/** @deprecated Use runScrapeFallback instead */
export const runExaFallback = runScrapeFallback;

/**
 * Poll for new feed items and process them
 */
async function pollForNewItems(): Promise<void> {
  if (isPolling) {
    return; // Prevent concurrent polls
  }

  if (
    consecutivePollingFailures >= POLLING_WARN_THRESHOLD &&
    consecutivePollingFailures < POLLING_CRITICAL_THRESHOLD &&
    Date.now() - lastPollingAttemptMs < POLLING_BACKOFF_INTERVAL_MS
  ) {
    return;
  }
  lastPollingAttemptMs = Date.now();

  if (!isPollingAllowed()) {
    return;
  }

  isPolling = true;
  _pollsSinceLastLog++;

  // [claude-code 2026-04-18] S25-T2: rotate the round-robin polling owner each cycle so
  // the Team Card sees Rettiwt contributions distributed across active users over time.
  advancePollingOwner();
  recordUserPollAttempt(getCurrentPollingOwner());

  try {
    // ── Scrape-only mode when all users killed their feeds ──
    if (shouldUseScrapeOnly()) {
      log.info(
        "[FeedPoller] All users killed X feed — running scrape fallback only",
      );
      await runScrapeFallback();
      consecutivePollingFailures = 0;
      return;
    }

    // ── Scrape fallback when Rettiwt is rate-limited ──
    if (isRettiwtRateLimited()) {
      await runScrapeFallback();
      consecutivePollingFailures = 0;
      return;
    }

    // [claude-code 2026-04-24] S34-T5: Rettiwt secondary branch removed. DB-driven
    // Agent-Reach (riskflow-worker tier coordinators) now covers Wire+Macro handles via
    // Nitter mirrors. Rettiwt utilities remain inert stubs above for future re-enable
    // behind RETTIWT_REENABLE. Economic feed + scrape fallback paths are preserved.
    const econItems = await fetchEconomicFeed().catch((err) => {
      log.warn("Economic feed fetch failed:", { error: String(err) });
      return [] as FeedItem[];
    });

    const rawItems: FeedItem[] = [...econItems];

    if (rawItems.length === 0) {
      consecutivePollingFailures = 0;
      return;
    }

    // Check which items are already cached
    const itemIds = rawItems.map((i) => i.id);
    const cachedIds = await newsCache.getCachedTweetIds(itemIds);
    const newItems = rawItems.filter((i) => !cachedIds.has(i.id));

    if (newItems.length === 0) {
      consecutivePollingFailures = 0;
      return; // No new items
    }

    _itemsSinceLastLog += newItems.length;
    log.info(
      ` Found ${newItems.length} new items (${cachedIds.size} already cached)`,
    );

    // Content guard — block garbage before it touches the DB
    const cleanItems = filterWithContentGuard(
      newItems,
      (item) => `${item.headline} ${item.body || ""}`,
      { source: "feed-poller", getSource: (i) => i.source },
    );

    // S3: Write raw (unenriched) items to raw_riskflow_items for central scorer
    if (isSupabaseConfigured() && cleanItems.length > 0) {
      const rawRows = cleanItems.map(feedItemToRaw);
      const written = await writeRawItems(rawRows);
      log.info(` Wrote ${written} raw items to raw_riskflow_items`);
      // [claude-code 2026-04-18] S25-T2: attribute successful cycle to current polling owner
      // (or backend sentinel when no active user). Team Card shows "Polled Nm ago" off this.
      if (written > 0) recordUserPollSuccess(getCurrentPollingOwner());
    }
    recordRun(FEED_POLLER_HEALTH_NAME);

    // Enrich with AI analysis (this calculates IV scores and macro levels)
    const enrichedItems = await withTimeout(
      enrichFeedWithAnalysis(cleanItems),
      30_000,
      "enrichFeedWithAnalysis",
    );

    // Store all items in legacy news_feed_items (kept for backward compat during migration)
    await newsCache.storeFeedItems(enrichedItems);
    updateFeedCache(enrichedItems);

    // Broadcast Level 4 items immediately via SSE
    const level4Items = enrichedItems.filter((item) => item.macroLevel === 4);
    for (const item of level4Items) {
      log.info(` Broadcasting Level 4 item: ${item.headline}`);
      broadcastLevel4(item);
    }

    if (level4Items.length > 0) {
      log.info(` Broadcast ${level4Items.length} Level 4 items via SSE`);
    }
    consecutivePollingFailures = 0;
  } catch (error) {
    consecutivePollingFailures += 1;
    const msg = error instanceof Error ? error.message : String(error);
    const timedOut = msg.includes("timed out");

    if (consecutivePollingFailures >= POLLING_CRITICAL_THRESHOLD) {
      log.error(
        "[FeedPoller] CRITICAL: 10+ consecutive failures. Likely env/auth issue. Check SUPABASE_URL, SUPABASE_ANON_KEY, and JWT expiry.",
        { error: msg, consecutivePollingFailures, timedOut },
      );
    } else if (consecutivePollingFailures >= POLLING_WARN_THRESHOLD) {
      log.warn(
        "[FeedPoller] WARNING: 5+ consecutive failures. Backing off to 60s interval.",
        { error: msg, consecutivePollingFailures, timedOut },
      );
    } else if (timedOut) {
      log.warn(
        "[FeedPoller] Enrichment timed out — resetting isPolling guard",
        { msg, consecutivePollingFailures },
      );
    } else {
      log.error("[FeedPoller] Poll error:", { error: msg });
    }
    recordError(FEED_POLLER_HEALTH_NAME, error);
  } finally {
    isPolling = false;
    maybeLogHealth();
  }
}

/**
 * Start the continuous polling service
 */
export function startFeedPoller(): void {
  if (pollTimeout) {
    log.info("FeedPoller already running");
    return;
  }

  log.info("FeedPoller starting (dynamic interval, 24/7)");
  _pollerStarted = true;

  const scheduledPoll = async (): Promise<void> => {
    await pollForNewItems();

    const { interval, isHotHours } = getPollingConfig();
    log.info(
      `[FeedPoller] Next poll in ${interval / 1000}s (hotHours=${isHotHours})`,
    );
    pollTimeout = setTimeout(scheduledPoll, interval);
  };

  void scheduledPoll();
}

/**
 * Stop the polling service
 */
export function stopFeedPoller(): void {
  if (pollTimeout) {
    clearTimeout(pollTimeout);
    pollTimeout = null;
    _pollerStarted = false;
    console.log("[FeedPoller] Stopped");
  }
}

/**
 * Force an immediate poll cycle (used by manual refresh endpoint).
 * Uses manualRefreshTweets to force timeline fetch regardless of schedule cadence.
 * Waits for any active poll to finish before running, so the refresh
 * is never silently dropped.
 */
export async function forcePoll(): Promise<void> {
  // Wait for any in-flight poll to complete (max ~5s)
  let waited = 0;
  while (isPolling && waited < 5000) {
    await new Promise((r) => setTimeout(r, 250));
    waited += 250;
  }

  isPolling = true;
  try {
    // Manual refresh path — Rettiwt + Agent-Reach + economic feed
    const [rettiwtItems, econItems] = await Promise.all([
      manualRefresh().catch(() => []),
      fetchEconomicFeed().catch(() => []),
    ]);

    const rawItems: FeedItem[] = [...econItems, ...rettiwtItems];
    if (rawItems.length === 0) return;

    const itemIds = rawItems.map((i) => i.id);
    const cachedIds = await newsCache.getCachedTweetIds(itemIds);
    const newItems = rawItems.filter((i) => !cachedIds.has(i.id));

    if (newItems.length === 0) return;

    log.info(
      ` Manual refresh: ${newItems.length} new items (${cachedIds.size} already cached)`,
    );

    // Content guard on manual refresh path
    const cleanRefreshItems = filterWithContentGuard(
      newItems,
      (item) => `${item.headline} ${item.body || ""}`,
      { source: "feed-poller:manual-refresh", getSource: (i) => i.source },
    );

    // S3: Write raw items to raw_riskflow_items for central scorer
    if (isSupabaseConfigured() && cleanRefreshItems.length > 0) {
      const rawRows = cleanRefreshItems.map(feedItemToRaw);
      const written = await writeRawItems(rawRows);
      log.info(
        ` Manual refresh: wrote ${written} raw items to raw_riskflow_items`,
      );
      if (written > 0) recordUserPollSuccess(getCurrentPollingOwner());
    }

    const enrichedItems = await enrichFeedWithAnalysis(cleanRefreshItems);
    await newsCache.storeFeedItems(enrichedItems);
    updateFeedCache(enrichedItems);

    const level4Items = enrichedItems.filter((item) => item.macroLevel === 4);
    for (const item of level4Items) {
      log.info(` Broadcasting Level 4 item: ${item.headline}`);
      broadcastLevel4(item);
    }
  } catch (error) {
    log.error(" Manual refresh error:", error);
  } finally {
    isPolling = false;
  }
}

/**
 * Get polling status — true if poller has been started (even if currently in a poll cycle)
 */
let _pollerStarted = false;
export function isPollingActive(): boolean {
  return _pollerStarted;
}
