// [claude-code 2026-04-05] Extracted from feed-service.ts for <300 line policy
// Feed cache lifecycle: in-memory cache, warm from DB, merge updates, periodic re-sync.

import type { FeedItem } from '../../types/riskflow.js';
import { readScoredItems } from '../supabase-service.js';
import { scoredToFeedItem } from './central-scorer.js';
import { createLogger } from '../../lib/logger.js';

const log = createLogger('FeedCache');

const MAX_FEED_ITEMS = 500;
const CACHE_REFRESH_INTERVAL_MS = 120_000; // Re-sync from DB every 2 minutes

// In-memory cache — seeded from scored DB on boot, then re-synced periodically from DB.
let feedCache: FeedItem[] | null = null;
let lastCacheRefreshMs = 0;

export function getFeedCache(): FeedItem[] | null {
  return feedCache;
}

export function getCacheAgeMs(): number {
  return Date.now() - lastCacheRefreshMs;
}

export function isCacheStale(): boolean {
  return getCacheAgeMs() >= CACHE_REFRESH_INTERVAL_MS;
}

export function getMaxFeedItems(): number {
  return MAX_FEED_ITEMS;
}

export function sortFeedItems(items: FeedItem[]): FeedItem[] {
  return [...items].sort((a, b) =>
    new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );
}

/**
 * Cold-start cache warm from scored_riskflow_items.
 * Called during boot so first feed request is never empty if DB already has data.
 */
export async function warmCacheFromDB(): Promise<void> {
  try {
    const scored = await readScoredItems({ limit: 200 });
    if (scored.length === 0) return;

    const items = sortFeedItems(scored.map(scoredToFeedItem)).slice(0, MAX_FEED_ITEMS);
    feedCache = items;
    lastCacheRefreshMs = Date.now();
    log.info(`Cache synced with ${items.length} items from DB`);
  } catch (err) {
    log.warn('Cold-start seed failed (non-fatal)', { error: String(err) });
  }
}

/** Backward-compatible export used by existing boot initialization. */
export async function seedCacheFromDb(): Promise<void> {
  await warmCacheFromDB();
}

/**
 * Write-through cache update used by pollers after successful enrichment cycles.
 * Merges new items into the existing cache (deduped by id) so poll deltas
 * don't collapse history to just the latest cycle's items.
 * Empty updates are ignored so warm cache is never replaced with [].
 */
export function updateFeedCache(items: FeedItem[]): void {
  if (items.length === 0) return;

  const existing = feedCache ?? [];
  const existingById = new Map(existing.map(i => [i.id, i]));

  // New items overwrite existing entries with the same id (fresher enrichment)
  for (const item of items) {
    existingById.set(item.id, item);
  }

  const merged = Array.from(existingById.values());
  const nextItems = sortFeedItems(merged).slice(0, MAX_FEED_ITEMS);
  feedCache = nextItems;
  lastCacheRefreshMs = Date.now();
  log.info(`Cache merged: ${items.length} new + ${existing.length} existing → ${nextItems.length} items`);
}

// Non-blocking module warm-up so cache can populate ahead of first poll cycle.
void warmCacheFromDB();
