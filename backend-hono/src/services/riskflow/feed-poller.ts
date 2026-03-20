/**
 * Feed Poller Service
 * Continuously polls for new news items and broadcasts Level 4 events instantly
 * Runs independently of HTTP requests for real-time updates
 */
// [claude-code 2026-03-12] Removed X API dependency — all tweet ingestion now via twitter-cli

import * as newsCache from './news-cache.js';
import { enrichFeedWithAnalysis } from './feed-service.js';
import { broadcastLevel4 } from './sse-broadcaster.js';
import { fetchEconomicFeed } from './economic-feed.js';
import { isTwitterCliInstalled, pollTwitterForEconNews } from '../twitter-cli/index.js';
import type { FeedItem } from '../../types/riskflow.js';

const POLL_INTERVAL_MS = 15_000; // Poll every 15 seconds for instant Level 4 detection
let pollInterval: ReturnType<typeof setInterval> | null = null;
let isPolling = false;

/**
 * Poll for new feed items and process them
 */
async function pollForNewItems(): Promise<void> {
  if (isPolling) {
    return; // Prevent concurrent polls
  }

  isPolling = true;

  try {
    // Gather items from twitter-cli + economic feed
    const [twitterCliItems, econItems] = await Promise.all([
      isTwitterCliInstalled().then(ok => ok ? pollTwitterForEconNews() : []).catch(() => []),
      fetchEconomicFeed().catch(() => []),
    ]);

    const rawItems: FeedItem[] = [...econItems, ...twitterCliItems];

    if (rawItems.length === 0) {
      return;
    }

    // Check which items are already cached
    const itemIds = rawItems.map(i => i.id);
    const cachedIds = await newsCache.getCachedTweetIds(itemIds);
    const newItems = rawItems.filter(i => !cachedIds.has(i.id));

    if (newItems.length === 0) {
      return; // No new items
    }

    console.log(`[FeedPoller] Found ${newItems.length} new items (${cachedIds.size} already cached)`);

    // Enrich with AI analysis (this calculates IV scores and macro levels)
    const enrichedItems = await enrichFeedWithAnalysis(newItems);

    // Store all items in database
    await newsCache.storeFeedItems(enrichedItems);

    // Broadcast Level 4 items immediately via SSE
    const level4Items = enrichedItems.filter(item => item.macroLevel === 4);
    for (const item of level4Items) {
      console.log(`[FeedPoller] Broadcasting Level 4 item: ${item.headline}`);
      broadcastLevel4(item);
    }

    if (level4Items.length > 0) {
      console.log(`[FeedPoller] Broadcast ${level4Items.length} Level 4 items via SSE`);
    }
  } catch (error) {
    console.error('[FeedPoller] Poll error:', error);
  } finally {
    isPolling = false;
  }
}

/**
 * Start the continuous polling service
 */
export function startFeedPoller(): void {
  if (pollInterval) {
    console.log('[FeedPoller] Already running');
    return;
  }

  console.log(`[FeedPoller] Starting continuous polling (every ${POLL_INTERVAL_MS / 1000}s)`);

  // Poll immediately on startup
  pollForNewItems();

  // Then poll at regular intervals
  pollInterval = setInterval(() => {
    pollForNewItems();
  }, POLL_INTERVAL_MS);
}

/**
 * Stop the polling service
 */
export function stopFeedPoller(): void {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
    console.log('[FeedPoller] Stopped');
  }
}

/**
 * Force an immediate poll cycle (used by manual refresh endpoint)
 */
export async function forcePoll(): Promise<void> {
  await pollForNewItems();
}

/**
 * Get polling status
 */
export function isPollingActive(): boolean {
  return pollInterval !== null;
}
