// [claude-code 2026-03-19] Central scoring agent — polls unscored items from Supabase, runs AI analysis, writes scored results
// Gated by ENABLE_CENTRAL_SCORING=true (only TP's instance should set this)
import { enrichFeedWithAnalysis } from './feed-service.js';
import {
  readUnscoredItems,
  writeScoredItems,
  type RawRiskFlowItem,
  type ScoredRiskFlowItem,
} from '../supabase-service.js';
import { isSupabaseConfigured } from '../../config/supabase.js';
import type { FeedItem } from '../../types/riskflow.js';

const SCORING_INTERVAL = 30_000; // 30 seconds
const BATCH_SIZE = 20;
const ENABLE_CENTRAL_SCORING = process.env.ENABLE_CENTRAL_SCORING === 'true';

let scoringTimer: ReturnType<typeof setInterval> | null = null;
let isScoring = false;

/**
 * Convert a raw Supabase item into a FeedItem for the existing enrichment pipeline
 */
function rawToFeedItem(raw: RawRiskFlowItem & { id: string }): FeedItem {
  return {
    id: raw.tweet_id,
    source: (raw.source as FeedItem['source']) || 'TwitterCli',
    headline: raw.headline || '',
    body: raw.body,
    symbols: raw.symbols || [],
    tags: raw.tags || [],
    isBreaking: raw.is_breaking || false,
    urgency: (raw.urgency as FeedItem['urgency']) || 'normal',
    publishedAt: raw.published_at || new Date().toISOString(),
  };
}

/**
 * Convert an enriched FeedItem back to a ScoredRiskFlowItem for Supabase
 */
function feedItemToScored(item: FeedItem, rawId: string): ScoredRiskFlowItem {
  return {
    raw_item_id: rawId,
    tweet_id: item.id,
    source: item.source,
    headline: item.headline,
    body: item.body,
    symbols: item.symbols,
    tags: item.tags,
    is_breaking: item.isBreaking,
    urgency: item.urgency,
    sentiment: item.sentiment,
    iv_score: item.ivScore,
    macro_level: item.macroLevel,
    published_at: item.publishedAt,
    analyzed_at: item.analyzedAt || new Date().toISOString(),
    scored_by: 'central-agent',
    price_brain_score: item.priceBrainScore as Record<string, unknown> | undefined,
  };
}

/**
 * Run one scoring cycle: fetch unscored → enrich → write scored
 */
async function scoringCycle(): Promise<void> {
  if (isScoring) return;
  isScoring = true;

  try {
    const unscoredItems = await readUnscoredItems(BATCH_SIZE);
    if (unscoredItems.length === 0) {
      return;
    }

    console.log(`[Central Scorer] Processing ${unscoredItems.length} unscored items`);

    // Build a map of tweet_id → raw Supabase id for linking
    const rawIdMap = new Map<string, string>();
    const feedItems = unscoredItems.map((raw) => {
      rawIdMap.set(raw.tweet_id, raw.id);
      return rawToFeedItem(raw);
    });

    // Run through the existing AI enrichment pipeline (Grok analyzer)
    const enrichedItems = await enrichFeedWithAnalysis(feedItems);

    // Convert back to scored format and write to Supabase
    const scoredItems = enrichedItems.map((item) => {
      const rawId = rawIdMap.get(item.id) || '';
      return feedItemToScored(item, rawId);
    });

    const written = await writeScoredItems(scoredItems);
    console.log(`[Central Scorer] Wrote ${written} scored items to Supabase`);
  } catch (err) {
    console.error('[Central Scorer] Scoring cycle error:', err);
  } finally {
    isScoring = false;
  }
}

/**
 * Start the central scoring poller
 */
export function startCentralScorer(): void {
  if (!ENABLE_CENTRAL_SCORING) {
    console.log('[Central Scorer] Disabled (set ENABLE_CENTRAL_SCORING=true to enable)');
    return;
  }

  if (!isSupabaseConfigured()) {
    console.warn('[Central Scorer] Supabase not configured — cannot start');
    return;
  }

  console.log(`[Central Scorer] Starting (interval: ${SCORING_INTERVAL / 1000}s, batch: ${BATCH_SIZE})`);

  // Run immediately, then on interval
  scoringCycle();
  scoringTimer = setInterval(scoringCycle, SCORING_INTERVAL);
}

/**
 * Stop the central scoring poller
 */
export function stopCentralScorer(): void {
  if (scoringTimer) {
    clearInterval(scoringTimer);
    scoringTimer = null;
    console.log('[Central Scorer] Stopped');
  }
}

export function isCentralScorerRunning(): boolean {
  return scoringTimer !== null;
}
