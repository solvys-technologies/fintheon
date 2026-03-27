/**
 * Feed Service
 * RiskFlow news feed aggregation and filtering with AI analysis
 * Day 17 - Phase 5 Integration
 */

// [claude-code 2026-03-24] Pass VIX data into calculateIVScore for continuous curve multiplier + sub-scores
// [claude-code 2026-03-11] Integrated point estimator for commentary point ranges + VIX feed
// [claude-code 2026-03-12] Removed X API dependency — all tweet ingestion now via twitter-cli
// [claude-code 2026-03-12] Task 2A: Polymarket sentiment inference + failed enrichment fallback
// [claude-code 2026-03-10] Integrated twitter-cli (FJ emoji-filtered) as secondary social feed source
// [claude-code 2026-03-10] Default minMacroLevel lowered 3→2 (Medium+ threshold per Track 1 spec)
import type { FeedItem, FeedResponse, FeedFilters, NewsSource, UrgencyLevel, SentimentDirection, MacroLevel } from '../../types/riskflow.js';
import { getWatchlist, matchesWatchlist } from './watchlist-service.js';
import { analyzeHeadline, type AnalyzedHeadline } from '../analysis/grok-analyzer.js';
import { calculateIVScore } from '../analysis/iv-scorer.js';
import { classifyEventType } from '../iv-scoring-v2.js';
import { broadcastLevel4 } from './sse-broadcaster.js';
import * as newsCache from './news-cache.js';
import { fetchEconomicFeed } from './economic-feed.js';
import type { NewsSource as AnalysisNewsSource } from '../../types/news-analysis.js';
import { isTwitterCliInstalled, pollTwitterForEconNews, getWarmCacheItems } from '../twitter-cli/index.js';
import { estimatePoints } from '../market-data/point-estimator.js';
import { fetchVIX } from '../vix-service.js';
import { createLogger } from '../../lib/logger.js';

const log = createLogger('RiskFlow');
const MAX_FEED_ITEMS = 50;
const isDev = process.env.NODE_ENV !== 'production';
const ALLOW_MOCK_FALLBACK = process.env.RISKFLOW_ALLOW_MOCK_FALLBACK === 'true';

// Keyword lists for sentiment inference (used for Polymarket + failed enrichment fallback)
const BULLISH_KEYWORDS = ['growth', 'rally', 'beat', 'rate cut', 'stimulus', 'surge', 'rise', 'gain', 'jump', 'soar', 'bull', 'record high', 'above', 'upgrade', 'boom', 'positive', 'strong'];
const BEARISH_KEYWORDS = ['recession', 'crash', 'default', 'war', 'cut', 'drop', 'fall', 'plunge', 'decline', 'sink', 'bear', 'miss', 'below', 'downgrade', 'slump', 'negative', 'fear', 'risk', 'warn', 'sell', 'weak'];

/**
 * Infer bullish/bearish sentiment from headline text using keyword matching.
 * Returns 'bullish' or 'bearish' (never neutral — always picks a side).
 */
function inferSentimentFromKeywords(text: string): 'bullish' | 'bearish' {
  const lower = text.toLowerCase();
  let bullCount = 0;
  let bearCount = 0;
  for (const kw of BULLISH_KEYWORDS) if (lower.includes(kw)) bullCount++;
  for (const kw of BEARISH_KEYWORDS) if (lower.includes(kw)) bearCount++;
  return bullCount >= bearCount ? 'bullish' : 'bearish';
}

// Enable/disable AI analysis (can be toggled via env)
const ENABLE_AI_ANALYSIS = process.env.ENABLE_AI_ANALYSIS !== 'false';

// In-memory cache (short-term) - DB cache is primary
let feedCache: { items: FeedItem[]; fetchedAt: number } | null = null;
const CACHE_TTL_MS = 15_000; // 15 seconds (in-memory cache)
const FETCH_INTERVAL_MS = 5 * 60_000; // 5 minutes between fresh fetches
let lastFreshFetch: number = 0;


/**
 * Map RiskFlow NewsSource to Analysis NewsSource
 */
function mapToAnalysisSource(source: NewsSource): AnalysisNewsSource {
  const sourceMap: Record<NewsSource, AnalysisNewsSource> = {
    FinancialJuice: 'FinancialJuice',
    InsiderWire: 'InsiderWire',
    EconomicCalendar: 'Custom',
    TrendSpider: 'Custom',
    Barchart: 'Custom',
    Polymarket: 'Custom',
    Kalshi: 'Custom',
    TwitterCli: 'FinancialJuice', // FJ emoji-filtered tweets treated as FJ quality
    Custom: 'Custom',
    Hermes: 'Custom',
  };
  return sourceMap[source] ?? 'Custom';
}

/**
 * Enrich a feed item with AI analysis.
 * Accepts pre-fetched VIX data to avoid redundant fetches across batch items.
 */
async function enrichWithAnalysis(item: FeedItem, prefetchedVIX?: Awaited<ReturnType<typeof fetchVIX>> | null): Promise<FeedItem> {
  try {
    const analysisSource = mapToAnalysisSource(item.source);
    const analyzed = await analyzeHeadline(item.headline, analysisSource);

    // V3: Use V2's classifier to catch credit/yield/liquidity events that
    // the basic headline parser might miss. Override only if it found something specific.
    const v2EventType = classifyEventType(analyzed.parsed);
    if ((!analyzed.parsed.eventType || analyzed.parsed.eventType === 'default' || analyzed.parsed.eventType === 'economicData')
      && v2EventType !== 'economicData' && v2EventType !== 'default') {
      analyzed.parsed.eventType = v2EventType;
    }

    // Fetch VIX once (use prefetched if available)
    const vixData = prefetchedVIX ?? await fetchVIX().catch(() => null);

    // Calculate IV score using parsed data (now with VIX-weighted continuous curve)
    const ivResult = await calculateIVScore({
      parsed: analyzed.parsed,
      hotPrint: analyzed.hotPrint,
      timestamp: new Date(item.publishedAt),
      vixData: vixData ?? undefined,
    });

    // Compute point estimation from IV score × live VIX
    let priceBrainScore: FeedItem['priceBrainScore'] = undefined;
    if (ivResult.score >= 2 && vixData) {
      try {
        const feedInstrument = process.env.PRIMARY_INSTRUMENT || '/ES';
        const pts = estimatePoints(ivResult.score, vixData.level, feedInstrument);
        const sentimentMap: Record<string, 'Bullish' | 'Bearish' | 'Neutral'> = {
          bullish: 'Bullish', bearish: 'Bearish', neutral: 'Neutral',
        };
        priceBrainScore = {
          sentiment: sentimentMap[ivResult.sentiment] ?? 'Neutral',
          classification: 'Neutral',
          impliedPoints: pts.scaledPoints,
          instrument: feedInstrument,
        };
      } catch {
        // Point estimation failed — skip
      }
    }

    const enriched: FeedItem = {
      ...item,
      symbols: analyzed.parsed.symbols.length > item.symbols.length
        ? analyzed.parsed.symbols
        : item.symbols,
      tags: [...new Set([...item.tags, ...analyzed.parsed.tags])],
      isBreaking: item.isBreaking || analyzed.parsed.isBreaking,
      urgency: getHigherUrgency(item.urgency, analyzed.parsed.urgency),
      sentiment: ivResult.sentiment as SentimentDirection,
      ivScore: ivResult.score,
      subScores: ivResult.subScores,
      // Preserve item's original macroLevel if it was explicitly set higher (e.g. from FJ keyword classifier)
      macroLevel: Math.max(ivResult.macroLevel, item.macroLevel ?? 1) as MacroLevel,
      analyzedAt: new Date().toISOString(),
      priceBrainScore,
    };

    if (enriched.macroLevel === 4) {
      broadcastLevel4(enriched);
    }

    return enriched;
  } catch (error) {
    log.error('Analysis enrichment failed', { itemId: item.id, error: String(error) });
    // Fallback: ensure every item gets bullish/bearish (never null/neutral from failed enrichment)
    if (!item.sentiment || item.sentiment === 'neutral') {
      const fallbackSentiment = inferSentimentFromKeywords(item.headline);
      return { ...item, sentiment: fallbackSentiment as SentimentDirection };
    }
    return item;
  }
}

/**
 * Get higher priority urgency
 */
function getHigherUrgency(a: UrgencyLevel, b: UrgencyLevel): UrgencyLevel {
  const priority: Record<UrgencyLevel, number> = {
    'immediate': 3,
    'high': 2,
    'normal': 1,
  };
  return priority[a] >= priority[b] ? a : b;
}

/**
 * Batch enrich feed items with analysis.
 * Fetches VIX once and shares across all items to avoid redundant API calls.
 * Exported for use by feed poller.
 */
export async function enrichFeedWithAnalysis(items: FeedItem[]): Promise<FeedItem[]> {
  if (!ENABLE_AI_ANALYSIS || items.length === 0) {
    return items;
  }

  // Fetch VIX once for the entire batch
  const vixData = await fetchVIX().catch(() => null);

  // Process in parallel with concurrency limit
  const CONCURRENCY = 5;
  const enriched: FeedItem[] = [];

  for (let i = 0; i < items.length; i += CONCURRENCY) {
    const batch = items.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map(item => enrichWithAnalysis(item, vixData)));
    enriched.push(...results);
  }

  return enriched;
}

/**
 * Apply filters to feed items
 */
function applyFilters(items: FeedItem[], filters: FeedFilters): FeedItem[] {
  let filtered = [...items];

  if (filters.sources?.length) {
    filtered = filtered.filter(item => filters.sources!.includes(item.source));
  }

  if (filters.symbols?.length) {
    const symbolSet = new Set(filters.symbols.map(s => s.toUpperCase()));
    filtered = filtered.filter(item =>
      item.symbols.some(s => symbolSet.has(s.toUpperCase()))
    );
  }

  if (filters.tags?.length) {
    const tagSet = new Set(filters.tags.map(t => t.toUpperCase()));
    filtered = filtered.filter(item =>
      item.tags.some(t => tagSet.has(t.toUpperCase()))
    );
  }

  if (filters.breakingOnly) {
    filtered = filtered.filter(item => item.isBreaking);
  }

  if (filters.minIvScore !== undefined) {
    filtered = filtered.filter(item => (item.ivScore ?? 0) >= filters.minIvScore!);
  }

  // Filter by macro level (1-4 scale) - default to 3+ for high importance
  if (filters.minMacroLevel !== undefined) {
    filtered = filtered.filter(item => (item.macroLevel ?? 1) >= filters.minMacroLevel!);
  }

  return filtered;
}

/**
 * Fetch fresh feed from twitter-cli + economic prints + Polymarket odds
 */
async function fetchFreshFeed(): Promise<FeedItem[]> {
  try {
    const [econItems, twitterCliItems] = await Promise.all([
      fetchEconomicFeed(),
      isTwitterCliInstalled().then(ok => ok ? pollTwitterForEconNews() : []).catch(() => []),
    ]);

    // Include warm-cached Critical/High posts seeded at startup
    const warmItems = getWarmCacheItems();

    // Merge and dedupe by id
    const merged = [...econItems, ...twitterCliItems, ...warmItems].filter(
      (item, idx, arr) => idx === arr.findIndex(i => i.id === item.id)
    );

    log.info(` fetchFreshFeed: Merged ${merged.length} items (${econItems.length} econ, ${twitterCliItems.length} twcli)`);
    return merged;
  } catch (error) {
    log.error('Fetch error', { error: String(error) });
    return [];
  }
}

/**
 * Generate mock feed for development
 */
function generateMockFeed(): FeedItem[] {
  const now = new Date();
  const mockItems: FeedItem[] = [
    {
      id: 'mock-1',
      source: 'FinancialJuice',
      headline: 'BREAKING: Fed signals potential rate cut in March meeting',
      body: 'Federal Reserve officials indicate openness to rate cuts amid cooling inflation data.',
      symbols: ['ES', 'NQ', 'SPY'],
      tags: ['FED', 'FOMC', 'RATES'],
      isBreaking: true,
      urgency: 'immediate',
      publishedAt: new Date(now.getTime() - 5 * 60_000).toISOString(),
    },
    {
      id: 'mock-2',
      source: 'InsiderWire',
      headline: 'CPI comes in at 2.9% YoY, below expectations of 3.1%',
      body: 'Consumer Price Index shows continued disinflation trend.',
      symbols: ['ES', 'NQ', 'TLT'],
      tags: ['CPI', 'INFLATION'],
      isBreaking: true,
      urgency: 'immediate',
      ivScore: 8.5,
      publishedAt: new Date(now.getTime() - 15 * 60_000).toISOString(),
    },
    {
      id: 'mock-3',
      source: 'FinancialJuice',
      headline: 'NVDA announces new AI chip with 2x performance improvement',
      symbols: ['NVDA', 'AMD', 'INTC'],
      tags: ['TECH', 'AI'],
      isBreaking: false,
      urgency: 'high',
      publishedAt: new Date(now.getTime() - 30 * 60_000).toISOString(),
    },
    {
      id: 'mock-4',
      source: 'InsiderWire',
      headline: 'Oil prices surge on Middle East tensions',
      body: 'Crude oil jumps 3% as geopolitical risks escalate.',
      symbols: ['CL', 'USO', 'XLE'],
      tags: ['OIL', 'COMMODITIES'],
      isBreaking: false,
      urgency: 'normal',
      publishedAt: new Date(now.getTime() - 45 * 60_000).toISOString(),
    },
    {
      id: 'mock-5',
      source: 'FinancialJuice',
      headline: 'Initial jobless claims at 220K vs 215K expected',
      symbols: ['ES', 'NQ'],
      tags: ['JOBS', 'NFP'],
      isBreaking: false,
      urgency: 'normal',
      ivScore: 4.2,
      publishedAt: new Date(now.getTime() - 60 * 60_000).toISOString(),
    },
  ];

  return mockItems;
}

/**
 * Get feed items with database caching (shared across all users)
 * Only fetches fresh data if enough time has passed
 */
async function getCachedFeed(): Promise<FeedItem[]> {
  // Check in-memory cache first (fast path)
  if (feedCache && Date.now() - feedCache.fetchedAt < CACHE_TTL_MS) {
    return feedCache.items;
  }

  // Optional mock fallback (disabled by default)
  if (ALLOW_MOCK_FALLBACK && isDev) {
    const mockItems = generateMockFeed();
    const enrichedItems = await enrichFeedWithAnalysis(mockItems);
    feedCache = { items: enrichedItems, fetchedAt: Date.now() };
    return enrichedItems;
  }

  // Try to get from database first (shared across users)
  const dbItems = await newsCache.getCachedFeed({ 
    limit: MAX_FEED_ITEMS, 
    hoursBack: 48 
  });
  
  log.info(` getCachedFeed: Found ${dbItems.length} items in database cache`);

  // Check if we need to fetch fresh data
  const shouldFetchFresh = Date.now() - lastFreshFetch >= FETCH_INTERVAL_MS;
  const isDatabaseEmpty = dbItems.length === 0;

  // If database is empty or we have < 15 items, always fetch fresh
  if (isDatabaseEmpty || dbItems.length < 15 || shouldFetchFresh) {
    log.info(` Fetching fresh data (empty: ${isDatabaseEmpty}, count: ${dbItems.length}, shouldFetch: ${shouldFetchFresh})...`);
    lastFreshFetch = Date.now();
    
    const rawItems = await fetchFreshFeed();
    log.info(` Fetched ${rawItems.length} raw items`);

    // If fetch failed and we have database items, use them
    if (rawItems.length === 0 && dbItems.length > 0) {
      log.info(` Fresh fetch returned 0 items, using ${dbItems.length} items from database cache`);
      feedCache = { items: dbItems, fetchedAt: Date.now() };
      return dbItems;
    }

    // If fetch failed and database is empty, return empty unless explicit mock fallback is enabled
    if (rawItems.length === 0 && dbItems.length === 0) {
      log.warn(` No items from fresh fetch and database is empty`);
      log.warn(` Environment: ${process.env.NODE_ENV}`);

      if (ALLOW_MOCK_FALLBACK) {
        log.warn(` RISKFLOW_ALLOW_MOCK_FALLBACK=true — generating fallback mock data`);
        const mockItems = generateMockFeed();
        const enrichedItems = await enrichFeedWithAnalysis(mockItems);
        await newsCache.storeFeedItems(enrichedItems);
        log.info(` Stored ${enrichedItems.length} fallback mock items in database`);
        feedCache = { items: enrichedItems, fetchedAt: Date.now() };
        return enrichedItems;
      }

      feedCache = { items: [], fetchedAt: Date.now() };
      return [];
    }

    // Check which items are already in cache
    const existingIds = await newsCache.getCachedTweetIds(rawItems.map(i => i.id));
    const newItems = rawItems.filter(item => !existingIds.has(item.id));

    log.info(` ${newItems.length} new items to analyze (${existingIds.size} already cached)`);

    // Only analyze new items
    let enrichedNewItems: FeedItem[] = [];
    if (newItems.length > 0) {
      enrichedNewItems = await enrichFeedWithAnalysis(newItems);
      // Store new items in database
      await newsCache.storeFeedItems(enrichedNewItems);
      log.info(` Stored ${enrichedNewItems.length} enriched items in database`);
    }

    // Merge: scored in-memory items take priority over unscored DB items
    // [claude-code 2026-03-27] Preserve IV scores from rescoreInMemoryFeed across cache refreshes
    const scoredMap = new Map<string, FeedItem>();
    // 1. Start with previous in-memory scored items (if any)
    for (const item of feedCache?.items ?? []) {
      if (item.ivScore != null) scoredMap.set(item.id, item);
    }
    // 2. Layer newly enriched items (overwrite with fresh scores)
    for (const item of enrichedNewItems) {
      scoredMap.set(item.id, item);
    }
    // 3. Fill gaps with DB items (only if we don't already have a scored version)
    for (const item of dbItems) {
      if (!scoredMap.has(item.id)) scoredMap.set(item.id, item);
    }
    const allItems = Array.from(scoredMap.values()).slice(0, MAX_FEED_ITEMS);

    feedCache = { items: allItems, fetchedAt: Date.now() };
    log.info(` Returning ${allItems.length} total items (${enrichedNewItems.length} new, ${scoredMap.size} merged)`);
    return allItems;
  }

  // Use database cache — but preserve any scored in-memory items
  // [claude-code 2026-03-27] Don't overwrite scored cache with unscored DB items
  if (feedCache && feedCache.items.some(i => i.ivScore != null)) {
    const scoredMap = new Map<string, FeedItem>();
    for (const item of feedCache.items) {
      if (item.ivScore != null) scoredMap.set(item.id, item);
    }
    for (const item of dbItems) {
      if (!scoredMap.has(item.id)) scoredMap.set(item.id, item);
    }
    const merged = Array.from(scoredMap.values()).slice(0, MAX_FEED_ITEMS);
    feedCache = { items: merged, fetchedAt: Date.now() };
    log.info(` Preserved ${scoredMap.size} scored items, merged with ${dbItems.length} DB items`);
    return merged;
  }
  log.info(` Using ${dbItems.length} items from database cache (no fresh fetch needed)`);
  feedCache = { items: dbItems, fetchedAt: Date.now() };
  return dbItems;
}

/**
 * Re-score all in-memory feed items with current regime/calibration/commentator weights.
 * Called by the /api/riskflow/rescore endpoint.
 * Forces re-enrichment of ALL cached items (not just new ones).
 */
// [claude-code 2026-03-27] Rescore in-memory feed for regime-aware V3 scoring
export async function rescoreInMemoryFeed(): Promise<number> {
  const items = feedCache?.items ?? [];
  if (items.length === 0) {
    log.info('rescoreInMemoryFeed: no cached items to rescore');
    return 0;
  }

  log.info(`rescoreInMemoryFeed: re-enriching ${items.length} cached items`);
  const reEnriched = await enrichFeedWithAnalysis(items);
  feedCache = { items: reEnriched, fetchedAt: Date.now() };

  // Also update the database cache
  await newsCache.storeFeedItems(reEnriched).catch((err: unknown) =>
    log.warn('rescoreInMemoryFeed: failed to persist to DB cache', { error: String(err) })
  );

  log.info(`rescoreInMemoryFeed: done — ${reEnriched.length} items updated`);
  return reEnriched.length;
}

/**
 * Get feed with user watchlist applied
 * Default: Only returns macroLevel 3+ (high importance headlines)
 * If no items found with minMacroLevel 3+, falls back to all items (for initial load)
 */
export async function getFeed(userId: string, filters?: FeedFilters): Promise<FeedResponse> {
  try {
    log.info('getFeed called', { userId, filters });
    
    const allItems = await getCachedFeed();
    log.info(` getFeed: ${allItems.length} total items from cache`);
    
    if (allItems.length === 0) {
      log.error(` getCachedFeed returned 0 items - this is the root cause!`);
      log.error(` Check: database connection, fetchFreshFeed function`);
    }
    
    const watchlist = getWatchlist(userId);
    log.info('Watchlist loaded', { userId, watchlist: JSON.stringify(watchlist) });

    // Apply watchlist filtering
    let items = allItems.filter(item => matchesWatchlist(watchlist, item));
    log.info(` After watchlist filter: ${items.length} items`);
    
    if (items.length === 0 && allItems.length > 0) {
      log.warn(` Watchlist filtered out all ${allItems.length} items!`);
      log.warn('Watchlist config', { watchlist: JSON.stringify(watchlist) });
      log.warn('Sample item', { item: JSON.stringify(allItems[0]) });
    }

  // Default to macroLevel 2+ (medium importance and above)
  const effectiveFilters: FeedFilters = {
    minMacroLevel: 2 as MacroLevel,
    ...filters,
  };

  // Apply filters (including macroLevel)
  items = applyFilters(items, effectiveFilters);
  log.info(` After filters (minMacroLevel: ${effectiveFilters.minMacroLevel}): ${items.length} items`);

  // If no items with minMacroLevel 2+, fall back to all items (for initial load)
  // This ensures users see something even if database only has low-level items
  if (items.length === 0 && effectiveFilters.minMacroLevel === 2 && !filters?.minMacroLevel) {
    log.info(` No level 3+ items found, falling back to all items (level 1+)`);
    const fallbackItems = allItems.filter(item => matchesWatchlist(watchlist, item));
    const fallbackFilters = { ...effectiveFilters, minMacroLevel: 1 as MacroLevel };
    items = applyFilters(fallbackItems, fallbackFilters);
    log.info(` Fallback items after level 1+ filter: ${items.length}`);
    
    // If still no items, try without any macro level filter at all
    if (items.length === 0) {
      log.info(` Still no items, trying without macro level filter`);
      items = fallbackItems.filter(item => {
        // Only apply non-macro filters
        if (effectiveFilters.sources?.length && !effectiveFilters.sources.includes(item.source)) return false;
        if (effectiveFilters.symbols?.length) {
          const symbolSet = new Set(effectiveFilters.symbols.map(s => s.toUpperCase()));
          if (!item.symbols.some(s => symbolSet.has(s.toUpperCase()))) return false;
        }
        if (effectiveFilters.tags?.length) {
          const tagSet = new Set(effectiveFilters.tags.map(t => t.toUpperCase()));
          if (!item.tags.some(t => tagSet.has(t.toUpperCase()))) return false;
        }
        if (effectiveFilters.breakingOnly && !item.isBreaking) return false;
        if (effectiveFilters.minIvScore !== undefined && (item.ivScore ?? 0) < effectiveFilters.minIvScore) return false;
        return true;
      });
      log.info(` Items without macro level filter: ${items.length}`);
    }
  }

  // Sort by macro level (highest first), then by published date
  items.sort((a, b) => {
    // Macro level priority (4 > 3 > 2 > 1)
    const macroA = a.macroLevel ?? 1;
    const macroB = b.macroLevel ?? 1;
    if (macroB !== macroA) return macroB - macroA;
    // Then by date (newest first)
    return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
  });

    // Apply pagination
    const limit = Math.min(filters?.limit ?? MAX_FEED_ITEMS, MAX_FEED_ITEMS);
    const paginatedItems = items.slice(0, limit);

    const response = {
      items: paginatedItems,
      total: items.length,
      hasMore: items.length > limit,
      nextCursor: items.length > limit ? paginatedItems[limit - 1]?.id : undefined,
      fetchedAt: new Date().toISOString(),
    };
    
    log.info(` getFeed returning: ${response.items.length} items (total: ${response.total}, hasMore: ${response.hasMore})`);
    return response;
  } catch (error) {
    log.error('getFeed error', { userId, error: String(error), stack: error instanceof Error ? error.stack : undefined });
    // Return empty response instead of throwing
    return {
      items: [],
      total: 0,
      hasMore: false,
      fetchedAt: new Date().toISOString(),
    };
  }
}

/**
 * Get breaking news only
 */
export async function getBreakingNews(userId: string): Promise<FeedResponse> {
  return getFeed(userId, { breakingOnly: true, limit: 10 });
}
