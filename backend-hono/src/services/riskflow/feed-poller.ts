/**
 * Feed Poller Service
 * Continuously polls for new news items and broadcasts Level 4 events instantly
 * Runs independently of HTTP requests for real-time updates
 */
// [claude-code 2026-03-31] Dynamic polling intervals: 5min market hours, 30min off-hours. Observable pipeline.
// [claude-code 2026-03-12] Removed X API dependency — all tweet ingestion now via twitter-cli

// [claude-code 2026-03-27] S3: Write raw items to raw_riskflow_items for central scorer pipeline
// [claude-code 2026-03-30] S10-T1c: Added daily window gate + autoRefresh toggle
// [claude-code 2026-03-31] Widened polling window 6AM-8PM ET weekdays (was 8-11AM — starved pipeline for 3 days)
import * as newsCache from './news-cache.js';
import { enrichFeedWithAnalysis } from './feed-service.js';
import { broadcastLevel4 } from './sse-broadcaster.js';
import { fetchEconomicFeed } from './economic-feed.js';
import { isTwitterCliInstalled, pollTwitterForEconNews, manualRefreshTweets } from '../twitter-cli/index.js';
import { writeRawItems, type RawRiskFlowItem } from '../supabase-service.js';
import { isSupabaseConfigured } from '../../config/supabase.js';
import { getUserSettings } from '../settings-store.js';
import type { FeedItem } from '../../types/riskflow.js';
import { createLogger } from '../../lib/logger.js';

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
    submitted_by: 'feed-poller',
  };
}

const log = createLogger('FeedPoller');

// ── Polling Intervals ─────────────────────────────────────────────────────────
// Market hours (6AM-2PM ET weekdays): 5 minutes — active trading, commentary flowing
// Off-hours (2PM-8PM ET weekdays): 30 minutes — still monitor but less aggressively
// Outside window (nights/weekends): no automatic polling (manual refresh only)
const MARKET_HOURS_INTERVAL_MS = 5 * 60_000;   // 5 minutes
const OFF_HOURS_INTERVAL_MS = 30 * 60_000;      // 30 minutes
const SCHEDULE_CHECK_MS = 60_000;                // Check schedule every 60s

let pollTimeout: ReturnType<typeof setTimeout> | null = null;
let isPolling = false;
let _lastGateLog = 0; // Throttle gate-blocked log messages

// Health tracking for observability
let _pollsSinceLastLog = 0;
let _itemsSinceLastLog = 0;
let _lastHealthLog = 0;
const HEALTH_LOG_INTERVAL = 10 * 60_000; // Log health every 10 minutes

// S10-T1c: Manual toggle state — when false, ALL polling stops
let manualToggleEnabled = true;

/**
 * Check if we're inside the daily polling window.
 * Extended market hours: 6AM-8PM ET on weekdays.
 * Weekends: suppressed (no meaningful flow).
 */
export function isInsidePollingWindow(): boolean {
  const now = new Date();
  const etStr = now.toLocaleString('en-US', { timeZone: 'America/New_York' });
  const et = new Date(etStr);
  const hour = et.getHours();
  const day = et.getDay(); // 0=Sun, 6=Sat

  // Weekdays only, 6AM-8PM ET (covers pre-market through post-market)
  if (day === 0 || day === 6) return false;
  return hour >= 6 && hour < 20;
}

/**
 * Get the appropriate polling interval based on time of day.
 * Returns null if outside the polling window entirely.
 */
function getPollingInterval(): number | null {
  const now = new Date();
  const etStr = now.toLocaleString('en-US', { timeZone: 'America/New_York' });
  const et = new Date(etStr);
  const hour = et.getHours();
  const day = et.getDay();

  // Weekends: no polling
  if (day === 0 || day === 6) return null;

  // Active market hours: 6AM-2PM ET → 5 min
  if (hour >= 6 && hour < 14) return MARKET_HOURS_INTERVAL_MS;

  // Off-hours: 2PM-8PM ET → 30 min
  if (hour >= 14 && hour < 20) return OFF_HOURS_INTERVAL_MS;

  // Outside window
  return null;
}

/**
 * Check if autoRefresh is enabled in user settings AND manual toggle is on.
 * Returns false if polling should be suppressed.
 */
async function isPollingAllowed(): Promise<boolean> {
  if (!manualToggleEnabled) {
    log.info('Polling blocked: manual toggle is OFF');
    return false;
  }

  try {
    const settings = await getUserSettings('default');
    if (settings.autoRefresh === false) {
      log.info('Polling blocked: autoRefresh setting is OFF in user settings');
      return false;
    }
  } catch {
    // Default: allow polling if settings unavailable
  }

  return true;
}

/** Set the manual polling toggle. When false, ALL X API calls stop. */
export function setPollingToggle(enabled: boolean): void {
  manualToggleEnabled = enabled;
  log.info(` Polling toggle set to ${enabled ? 'ON' : 'OFF'}`);
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

  const interval = getPollingInterval();
  const intervalDesc = interval === MARKET_HOURS_INTERVAL_MS ? '5min (market hours)'
    : interval === OFF_HOURS_INTERVAL_MS ? '30min (off-hours)' : 'inactive';

  log.info(`Pipeline health: ${_pollsSinceLastLog} polls, ${_itemsSinceLastLog} new items in last 10min | interval: ${intervalDesc} | toggle: ${manualToggleEnabled ? 'ON' : 'OFF'}`);

  _pollsSinceLastLog = 0;
  _itemsSinceLastLog = 0;
}

/**
 * Poll for new feed items and process them
 */
async function pollForNewItems(): Promise<void> {
  if (isPolling) {
    return; // Prevent concurrent polls
  }

  // S10-T1c: Check time window + toggle + autoRefresh before polling
  if (!isInsidePollingWindow()) {
    // Log once per hour so stale feeds are never a mystery
    const now = Date.now();
    if (now - _lastGateLog > 3_600_000) {
      log.info('Outside polling window (6AM-8PM ET weekdays) — automatic polling paused');
      _lastGateLog = now;
    }
    return;
  }

  if (!(await isPollingAllowed())) {
    return; // Toggle off or autoRefresh disabled — reason already logged
  }

  isPolling = true;
  _pollsSinceLastLog++;

  try {
    // Check twitter-cli availability with explicit logging
    const twitterAvailable = await isTwitterCliInstalled();
    if (!twitterAvailable) {
      log.warn('twitter-cli NOT available — feed will only contain economic calendar items. Check ~/.local/bin/twitter');
    }

    // Gather items from twitter-cli + economic feed
    const [twitterCliItems, econItems] = await Promise.all([
      twitterAvailable ? pollTwitterForEconNews().catch((err) => {
        log.error('twitter-cli poll failed:', { error: String(err) });
        return [] as FeedItem[];
      }) : Promise.resolve([] as FeedItem[]),
      fetchEconomicFeed().catch((err) => {
        log.warn('Economic feed fetch failed:', { error: String(err) });
        return [] as FeedItem[];
      }),
    ]);

    const rawItems: FeedItem[] = [...econItems, ...twitterCliItems];

    if (rawItems.length === 0) {
      // Log when both sources return empty so operators know the pipeline is idle
      log.info(`Poll cycle: 0 items from all sources (twitter-cli: ${twitterAvailable ? 'available' : 'unavailable'}, econ: checked)`);
      return;
    }

    // Check which items are already cached
    const itemIds = rawItems.map(i => i.id);
    const cachedIds = await newsCache.getCachedTweetIds(itemIds);
    const newItems = rawItems.filter(i => !cachedIds.has(i.id));

    if (newItems.length === 0) {
      return; // No new items
    }

    _itemsSinceLastLog += newItems.length;
    log.info(` Found ${newItems.length} new items (${cachedIds.size} already cached)`);

    // S3: Write raw (unenriched) items to raw_riskflow_items for central scorer
    if (isSupabaseConfigured()) {
      const rawRows = newItems.map(feedItemToRaw);
      const written = await writeRawItems(rawRows);
      log.info(` Wrote ${written} raw items to raw_riskflow_items`);
    }

    // Enrich with AI analysis (this calculates IV scores and macro levels)
    const enrichedItems = await enrichFeedWithAnalysis(newItems);

    // Store all items in legacy news_feed_items (kept for backward compat during migration)
    await newsCache.storeFeedItems(enrichedItems);

    // Broadcast Level 4 items immediately via SSE
    const level4Items = enrichedItems.filter(item => item.macroLevel === 4);
    for (const item of level4Items) {
      log.info(` Broadcasting Level 4 item: ${item.headline}`);
      broadcastLevel4(item);
    }

    if (level4Items.length > 0) {
      log.info(` Broadcast ${level4Items.length} Level 4 items via SSE`);
    }
  } catch (error) {
    log.error(' Poll error:', error);
  } finally {
    isPolling = false;
    maybeLogHealth();
  }
}

/**
 * Schedule the next poll using dynamic intervals.
 * Self-scheduling pattern: after each poll, schedule the next one based on time of day.
 */
function scheduleNextPoll(): void {
  const interval = getPollingInterval();

  if (interval === null) {
    // Outside polling window — check again in 60s to see if we've entered the window
    pollTimeout = setTimeout(scheduleNextPoll, SCHEDULE_CHECK_MS);
    return;
  }

  pollForNewItems().finally(() => {
    pollTimeout = setTimeout(scheduleNextPoll, interval);
  });
}

/**
 * Start the continuous polling service
 */
export function startFeedPoller(): void {
  if (pollTimeout) {
    console.log('[FeedPoller] Already running');
    return;
  }

  const interval = getPollingInterval();
  const intervalDesc = interval === MARKET_HOURS_INTERVAL_MS ? '5min'
    : interval === OFF_HOURS_INTERVAL_MS ? '30min' : 'waiting for window';

  log.info(` Starting dynamic polling (current: ${intervalDesc})`);
  _pollerStarted = true;

  // Poll immediately on startup
  pollForNewItems().then(() => {
    // Then schedule based on time of day
    pollTimeout = setTimeout(scheduleNextPoll, interval ?? SCHEDULE_CHECK_MS);
  });
}

/**
 * Stop the polling service
 */
export function stopFeedPoller(): void {
  if (pollTimeout) {
    clearTimeout(pollTimeout);
    pollTimeout = null;
    _pollerStarted = false;
    console.log('[FeedPoller] Stopped');
  }
}

/**
 * Force an immediate poll cycle (used by manual refresh endpoint).
 * Uses manualRefreshTweets which bypasses autoRefresh + event window gates.
 * Waits for any active poll to finish before running, so the refresh
 * is never silently dropped.
 */
export async function forcePoll(): Promise<void> {
  // Wait for any in-flight poll to complete (max ~5s)
  let waited = 0;
  while (isPolling && waited < 5000) {
    await new Promise(r => setTimeout(r, 250));
    waited += 250;
  }

  isPolling = true;
  try {
    // Manual refresh: bypass autoRefresh + event window via manualRefreshTweets
    const [twitterCliItems, econItems] = await Promise.all([
      manualRefreshTweets().catch(() => []),
      fetchEconomicFeed().catch(() => []),
    ]);

    const rawItems: FeedItem[] = [...econItems, ...twitterCliItems];
    if (rawItems.length === 0) return;

    const itemIds = rawItems.map(i => i.id);
    const cachedIds = await newsCache.getCachedTweetIds(itemIds);
    const newItems = rawItems.filter(i => !cachedIds.has(i.id));

    if (newItems.length === 0) return;

    log.info(` Manual refresh: ${newItems.length} new items (${cachedIds.size} already cached)`);

    // S3: Write raw items to raw_riskflow_items for central scorer
    if (isSupabaseConfigured()) {
      const rawRows = newItems.map(feedItemToRaw);
      const written = await writeRawItems(rawRows);
      log.info(` Manual refresh: wrote ${written} raw items to raw_riskflow_items`);
    }

    const enrichedItems = await enrichFeedWithAnalysis(newItems);
    await newsCache.storeFeedItems(enrichedItems);

    const level4Items = enrichedItems.filter(item => item.macroLevel === 4);
    for (const item of level4Items) {
      log.info(` Broadcasting Level 4 item: ${item.headline}`);
      broadcastLevel4(item);
    }
  } catch (error) {
    log.error(' Manual refresh error:', error);
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
