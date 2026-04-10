/**
 * News Feed Cache Service
 * Stores analyzed headlines in PostgreSQL for shared access across users
 * Prevents duplicate X API calls and AI analysis
 */

import { sql, isDatabaseAvailable } from "../../config/database.js";
import type {
  FeedItem,
  MacroLevel,
  NewsSource,
  SentimentDirection,
  UrgencyLevel,
} from "../../types/riskflow.js";

// In-memory fallback for dev mode
let memoryCache: FeedItem[] = [];
const MEMORY_CACHE_MAX = 100;

export interface NewsFeedRow {
  id: string;
  tweet_id: string;
  source: string;
  headline: string;
  body: string | null;
  symbols: string[];
  tags: string[];
  is_breaking: boolean;
  urgency: string;
  sentiment: string | null;
  iv_score: number | null;
  macro_level: number | null;
  published_at: string;
  analyzed_at: string | null;
  raw_data: Record<string, unknown> | null;
  created_at: string;
  sub_scores?: Record<string, unknown> | null;
  risk_type?: string | null;
  agent_note?: string | null;
  agent_note_generated_at?: string | null;
  econ_data?: Record<string, unknown> | null;
}

/**
 * Store a feed item in the database
 */
export async function storeFeedItem(item: FeedItem): Promise<void> {
  if (!isDatabaseAvailable() || !sql) {
    // Memory fallback
    const exists = memoryCache.some((i) => i.id === item.id);
    if (!exists) {
      memoryCache.unshift(item);
      if (memoryCache.length > MEMORY_CACHE_MAX) {
        memoryCache = memoryCache.slice(0, MEMORY_CACHE_MAX);
      }
    }
    return;
  }

  try {
    await sql`
      INSERT INTO news_feed_items (
        tweet_id, source, headline, body, symbols, tags,
        is_breaking, urgency, sentiment, iv_score, macro_level,
        published_at, analyzed_at,
        sub_scores, risk_type, agent_note, agent_note_generated_at, econ_data
      )
      VALUES (
        ${item.id},
        ${item.source},
        ${item.headline},
        ${item.body ?? null},
        ${item.symbols},
        ${item.tags},
        ${item.isBreaking},
        ${item.urgency},
        ${item.sentiment ?? null},
        ${item.ivScore ?? null},
        ${item.macroLevel ?? null},
        ${item.publishedAt},
        ${item.analyzedAt ?? null},
        ${item.subScores ? JSON.stringify(item.subScores) : null},
        ${item.riskType ?? null},
        ${item.agentNote ?? null},
        ${item.agentNoteGeneratedAt ?? null},
        ${item.econData ? JSON.stringify(item.econData) : null}
      )
      ON CONFLICT (tweet_id) DO UPDATE SET
        sentiment = EXCLUDED.sentiment,
        iv_score = EXCLUDED.iv_score,
        macro_level = EXCLUDED.macro_level,
        analyzed_at = EXCLUDED.analyzed_at,
        sub_scores = EXCLUDED.sub_scores,
        risk_type = EXCLUDED.risk_type,
        agent_note = EXCLUDED.agent_note,
        agent_note_generated_at = EXCLUDED.agent_note_generated_at,
        econ_data = EXCLUDED.econ_data
    `;
  } catch (error) {
    console.error("[NewsCache] Failed to store item:", item.id, error);
  }
}

/**
 * Store multiple feed items
 */
export async function storeFeedItems(items: FeedItem[]): Promise<void> {
  for (const item of items) {
    await storeFeedItem(item);
  }
}

/**
 * Get cached feed items from database
 */
export async function getCachedFeed(options: {
  limit?: number;
  minMacroLevel?: MacroLevel;
  hoursBack?: number;
}): Promise<FeedItem[]> {
  const limit = options.limit ?? 50;
  const minMacroLevel = options.minMacroLevel ?? 1;
  const hoursBack = options.hoursBack ?? 48;

  if (!isDatabaseAvailable() || !sql) {
    // Memory fallback
    const cutoff = new Date(Date.now() - hoursBack * 60 * 60 * 1000);
    return memoryCache
      .filter((item) => {
        const pubDate = new Date(item.publishedAt);
        const level = item.macroLevel ?? 1;
        return pubDate >= cutoff && level >= minMacroLevel;
      })
      .slice(0, limit);
  }

  try {
    const cutoffDate = new Date(
      Date.now() - hoursBack * 60 * 60 * 1000,
    ).toISOString();

    const result = await sql`
      SELECT * FROM news_feed_items
      WHERE published_at >= ${cutoffDate}
        AND (macro_level IS NULL OR macro_level >= ${minMacroLevel})
      ORDER BY 
        CASE WHEN is_breaking THEN 0 ELSE 1 END,
        macro_level DESC NULLS LAST,
        published_at DESC
      LIMIT ${limit}
    `;

    return result.map(mapRowToFeedItem);
  } catch (error) {
    console.error("[NewsCache] Failed to get cached feed:", error);
    return [];
  }
}

/**
 * Check if a tweet ID already exists in cache
 */
export async function isCached(tweetId: string): Promise<boolean> {
  if (!isDatabaseAvailable() || !sql) {
    return memoryCache.some((i) => i.id === tweetId);
  }

  try {
    const result = await sql`
      SELECT 1 FROM news_feed_items WHERE tweet_id = ${tweetId} LIMIT 1
    `;
    return result.length > 0;
  } catch {
    return false;
  }
}

/**
 * Get tweet IDs that are already cached (for batch checking)
 */
export async function getCachedTweetIds(
  tweetIds: string[],
): Promise<Set<string>> {
  if (!isDatabaseAvailable() || !sql) {
    const cached = new Set(memoryCache.map((i) => i.id));
    return new Set(tweetIds.filter((id) => cached.has(id)));
  }

  try {
    const result = await sql`
      SELECT tweet_id FROM news_feed_items WHERE tweet_id = ANY(${tweetIds})
    `;
    return new Set(result.map((r) => String(r.tweet_id)));
  } catch {
    return new Set();
  }
}

/**
 * Get last fetch timestamp (for incremental fetching)
 */
export async function getLastFetchTime(): Promise<Date | null> {
  if (!isDatabaseAvailable() || !sql) {
    if (memoryCache.length === 0) return null;
    return new Date(memoryCache[0].publishedAt);
  }

  try {
    const result = await sql`
      SELECT MAX(published_at) as last_published FROM news_feed_items
    `;
    if (result.length > 0 && result[0].last_published) {
      return new Date(result[0].last_published as string);
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * DISABLED — RiskFlow items are NEVER deleted. Retained permanently for calibration + narrative tracking.
 * @deprecated Do not call. Items are sacred. — TP directive 2026-03-28
 */
export async function cleanupOldItems(
  _hoursOld: number = 720,
): Promise<number> {
  console.warn(
    "[NewsCache] cleanupOldItems called but DISABLED — items are never deleted",
  );
  return 0;
}

/**
 * Map database row to FeedItem
 */
function mapRowToFeedItem(row: NewsFeedRow): FeedItem {
  return {
    id: row.tweet_id,
    source: row.source as NewsSource,
    headline: row.headline,
    body: row.body ?? undefined,
    symbols: row.symbols ?? [],
    tags: row.tags ?? [],
    isBreaking: row.is_breaking,
    urgency: (row.urgency as UrgencyLevel) ?? "normal",
    sentiment: row.sentiment as SentimentDirection | undefined,
    ivScore: row.iv_score ?? undefined,
    macroLevel: row.macro_level as MacroLevel | undefined,
    publishedAt: row.published_at,
    analyzedAt: row.analyzed_at ?? undefined,
    subScores:
      (row.sub_scores as unknown as FeedItem["subScores"]) ?? undefined,
    riskType: (row.risk_type as FeedItem["riskType"]) ?? null,
    agentNote: row.agent_note ?? null,
    agentNoteGeneratedAt: row.agent_note_generated_at ?? null,
    econData: (row.econ_data as FeedItem["econData"]) ?? null,
  };
}
