/**
 * Feed Service
 * RiskFlow news feed aggregation and filtering with AI analysis
 * Day 17 - Phase 5 Integration
 */

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
import { fetchPolymarket } from '../polymarket-service.js';
import type { PolymarketMarket } from '../../types/polymarket.js';
import { fetchKalshiWhales } from '../kalshi-service.js';
import type { WhaleAlert } from '../../types/kalshi.js';
import type { NewsSource as AnalysisNewsSource } from '../../types/news-analysis.js';
import { isTwitterCliInstalled, pollTwitterForEconNews, getWarmCacheItems } from '../twitter-cli/index.js';
import { estimatePoints } from '../market-data/point-estimator.js';
import { fetchVIX } from '../vix-service.js';

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
 * Convert Polymarket market to FeedItem
 */
function polymarketToFeedItem(market: PolymarketMarket): FeedItem {
  const macroLevel: MacroLevel =
    market.probability >= 0.6 ? 3 : 2

  // Infer sentiment from market title keywords first, then fall back to YES price direction
  const titleText = `${market.title} ${market.outcome}`;
  const lower = titleText.toLowerCase();
  let sentiment: SentimentDirection;

  const hasBearish = BEARISH_KEYWORDS.some(kw => lower.includes(kw));
  const hasBullish = BULLISH_KEYWORDS.some(kw => lower.includes(kw));

  if (hasBearish && !hasBullish) {
    sentiment = 'bearish';
  } else if (hasBullish && !hasBearish) {
    sentiment = 'bullish';
  } else if (hasBearish && hasBullish) {
    // Both present — use keyword scoring
    sentiment = inferSentimentFromKeywords(titleText);
  } else {
    // No keywords matched — use YES price direction: >50% = bullish for the underlying question
    sentiment = market.probability > 0.5 ? 'bullish' : 'bearish';
  }

  return {
    id: `poly-${market.id}`,
    source: 'Polymarket',
    headline: `${market.title} | ${market.outcome}: ${(market.probability * 100).toFixed(1)}%`,
    body: market.url,
    symbols: [],
    tags: ['POLYMARKET', 'ODDS'],
    isBreaking: false,
    urgency: 'high',
    sentiment,
    ivScore: undefined,
    macroLevel,
    publishedAt: market.closeTime ?? new Date().toISOString(),
    analyzedAt: new Date().toISOString(),
  };
}

/**
 * Convert Kalshi whale alert to FeedItem
 */
function kalshiWhaleToFeedItem(alert: WhaleAlert): FeedItem {
  const macroLevel: MacroLevel = (alert.notionalUsd >= 2000 || alert.alertTypes.includes('cluster')) ? 3 : 2
  const sideLabel = alert.takerSide.toUpperCase()
  const titleLower = alert.marketTitle.toLowerCase()

  const hasBearish = BEARISH_KEYWORDS.some(kw => titleLower.includes(kw))
  const hasBullish = BULLISH_KEYWORDS.some(kw => titleLower.includes(kw))
  let sentiment: SentimentDirection
  if (hasBearish && !hasBullish) {
    sentiment = alert.takerSide === 'yes' ? 'bearish' : 'bullish'
  } else if (hasBullish && !hasBearish) {
    sentiment = alert.takerSide === 'yes' ? 'bullish' : 'bearish'
  } else {
    sentiment = alert.lastPrice > 0.5 ? 'bullish' : 'bearish'
  }

  const clusterTag = alert.clusterSize ? ` (${alert.clusterSize} trades in 5min)` : ''
  return {
    id: alert.id,
    source: 'Kalshi',
    headline: `WHALE: ${alert.marketTitle} — ${alert.contracts} contracts (${sideLabel}) @ $${alert.lastPrice.toFixed(2)} | $${alert.notionalUsd.toFixed(0)} notional${clusterTag}`,
    body: `https://kalshi.com/markets/${alert.ticker}`,
    symbols: [],
    tags: ['KALSHI', 'WHALE', sideLabel, ...alert.alertTypes.map(t => t.toUpperCase())],
    isBreaking: false,
    urgency: 'high',
    sentiment,
    ivScore: undefined,
    macroLevel,
    publishedAt: alert.createdAt,
    analyzedAt: alert.detectedAt,
  }
}

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
  };
  return sourceMap[source] ?? 'Custom';
}

/**
 * Enrich a feed item with AI analysis
 */
async function enrichWithAnalysis(item: FeedItem): Promise<FeedItem> {
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

    // Calculate IV score using parsed data (now with V3-aware event types)
    const ivResult = calculateIVScore({
      parsed: analyzed.parsed,
      hotPrint: analyzed.hotPrint,
      timestamp: new Date(item.publishedAt),
    });

    // Compute point estimation from IV score × live VIX
    let priceBrainScore: FeedItem['priceBrainScore'] = undefined;
    if (ivResult.score >= 2) {
      try {
        const vixData = await fetchVIX();
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
        // VIX unavailable — skip point estimation
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
    console.error('[RiskFlow] Analysis enrichment failed for item:', item.id, error);
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
 * Batch enrich feed items with analysis
 * Exported for use by feed poller
 */
export async function enrichFeedWithAnalysis(items: FeedItem[]): Promise<FeedItem[]> {
  if (!ENABLE_AI_ANALYSIS || items.length === 0) {
    return items;
  }

  // Process in parallel with concurrency limit
  const CONCURRENCY = 5;
  const enriched: FeedItem[] = [];
  
  for (let i = 0; i < items.length; i += CONCURRENCY) {
    const batch = items.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map(enrichWithAnalysis));
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
    const [econItems, polyResp, kalshiResp, twitterCliItems] = await Promise.all([
      fetchEconomicFeed(),
      fetchPolymarket().catch(() => ({ markets: [], fetchedAt: new Date().toISOString() })),
      fetchKalshiWhales().catch(() => ({ alerts: [], markets: [], lastTradeFetchedAt: new Date().toISOString() })),
      isTwitterCliInstalled().then(ok => ok ? pollTwitterForEconNews() : []).catch(() => []),
    ]);

    const polyItems = polyResp.markets.map(polymarketToFeedItem);
    const kalshiItems = kalshiResp.alerts.map(kalshiWhaleToFeedItem);
    // Include warm-cached Critical/High posts seeded at startup
    const warmItems = getWarmCacheItems();

    // Merge and dedupe by id
    const merged = [...econItems, ...polyItems, ...kalshiItems, ...twitterCliItems, ...warmItems].filter(
      (item, idx, arr) => idx === arr.findIndex(i => i.id === item.id)
    );

    console.log(`[RiskFlow] fetchFreshFeed: Merged ${merged.length} items (${econItems.length} econ, ${polyItems.length} poly, ${kalshiItems.length} kalshi, ${twitterCliItems.length} twcli)`);
    return merged;
  } catch (error) {
    console.error('[RiskFlow] Fetch error:', error);
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
  
  console.log(`[RiskFlow] getCachedFeed: Found ${dbItems.length} items in database cache`);

  // Check if we need to fetch fresh data
  const shouldFetchFresh = Date.now() - lastFreshFetch >= FETCH_INTERVAL_MS;
  const isDatabaseEmpty = dbItems.length === 0;

  // If database is empty or we have < 15 items, always fetch fresh
  if (isDatabaseEmpty || dbItems.length < 15 || shouldFetchFresh) {
    console.log(`[RiskFlow] Fetching fresh data (empty: ${isDatabaseEmpty}, count: ${dbItems.length}, shouldFetch: ${shouldFetchFresh})...`);
    lastFreshFetch = Date.now();
    
    const rawItems = await fetchFreshFeed();
    console.log(`[RiskFlow] Fetched ${rawItems.length} raw items`);

    // If fetch failed and we have database items, use them
    if (rawItems.length === 0 && dbItems.length > 0) {
      console.log(`[RiskFlow] Fresh fetch returned 0 items, using ${dbItems.length} items from database cache`);
      feedCache = { items: dbItems, fetchedAt: Date.now() };
      return dbItems;
    }

    // If fetch failed and database is empty, return empty unless explicit mock fallback is enabled
    if (rawItems.length === 0 && dbItems.length === 0) {
      console.warn(`[RiskFlow] No items from fresh fetch and database is empty`);
      console.warn(`[RiskFlow] Environment: ${process.env.NODE_ENV}`);

      if (ALLOW_MOCK_FALLBACK) {
        console.warn(`[RiskFlow] RISKFLOW_ALLOW_MOCK_FALLBACK=true — generating fallback mock data`);
        const mockItems = generateMockFeed();
        const enrichedItems = await enrichFeedWithAnalysis(mockItems);
        await newsCache.storeFeedItems(enrichedItems);
        console.log(`[RiskFlow] Stored ${enrichedItems.length} fallback mock items in database`);
        feedCache = { items: enrichedItems, fetchedAt: Date.now() };
        return enrichedItems;
      }

      feedCache = { items: [], fetchedAt: Date.now() };
      return [];
    }

    // Check which items are already in cache
    const existingIds = await newsCache.getCachedTweetIds(rawItems.map(i => i.id));
    const newItems = rawItems.filter(item => !existingIds.has(item.id));

    console.log(`[RiskFlow] ${newItems.length} new items to analyze (${existingIds.size} already cached)`);

    // Only analyze new items
    let enrichedNewItems: FeedItem[] = [];
    if (newItems.length > 0) {
      enrichedNewItems = await enrichFeedWithAnalysis(newItems);
      // Store new items in database
      await newsCache.storeFeedItems(enrichedNewItems);
      console.log(`[RiskFlow] Stored ${enrichedNewItems.length} enriched items in database`);
    }

    // Merge new items with existing database items
    const allItems = [...enrichedNewItems, ...dbItems]
      .filter((item, index, self) => 
        index === self.findIndex(i => i.id === item.id)
      )
      .slice(0, MAX_FEED_ITEMS);

    feedCache = { items: allItems, fetchedAt: Date.now() };
    console.log(`[RiskFlow] Returning ${allItems.length} total items (${enrichedNewItems.length} new, ${dbItems.length} cached)`);
    return allItems;
  }

  // Use database cache (we have enough items and don't need to fetch)
  console.log(`[RiskFlow] Using ${dbItems.length} items from database cache (no fresh fetch needed)`);
  feedCache = { items: dbItems, fetchedAt: Date.now() };
  return dbItems;
}

/**
 * Get feed with user watchlist applied
 * Default: Only returns macroLevel 3+ (high importance headlines)
 * If no items found with minMacroLevel 3+, falls back to all items (for initial load)
 */
export async function getFeed(userId: string, filters?: FeedFilters): Promise<FeedResponse> {
  try {
    console.log(`[RiskFlow] getFeed called for user ${userId} with filters:`, JSON.stringify(filters));
    
    const allItems = await getCachedFeed();
    console.log(`[RiskFlow] getFeed: ${allItems.length} total items from cache`);
    
    if (allItems.length === 0) {
      console.error(`[RiskFlow] getCachedFeed returned 0 items - this is the root cause!`);
      console.error(`[RiskFlow] Check: database connection, fetchFreshFeed function`);
    }
    
    const watchlist = getWatchlist(userId);
    console.log(`[RiskFlow] Watchlist for user ${userId}:`, JSON.stringify(watchlist));

    // Apply watchlist filtering
    let items = allItems.filter(item => matchesWatchlist(watchlist, item));
    console.log(`[RiskFlow] After watchlist filter: ${items.length} items`);
    
    if (items.length === 0 && allItems.length > 0) {
      console.warn(`[RiskFlow] Watchlist filtered out all ${allItems.length} items!`);
      console.warn(`[RiskFlow] Watchlist config:`, watchlist);
      console.warn(`[RiskFlow] Sample item:`, JSON.stringify(allItems[0], null, 2));
    }

  // Default to macroLevel 2+ (medium importance and above)
  const effectiveFilters: FeedFilters = {
    minMacroLevel: 2 as MacroLevel,
    ...filters,
  };

  // Apply filters (including macroLevel)
  items = applyFilters(items, effectiveFilters);
  console.log(`[RiskFlow] After filters (minMacroLevel: ${effectiveFilters.minMacroLevel}): ${items.length} items`);

  // If no items with minMacroLevel 2+, fall back to all items (for initial load)
  // This ensures users see something even if database only has low-level items
  if (items.length === 0 && effectiveFilters.minMacroLevel === 2 && !filters?.minMacroLevel) {
    console.log(`[RiskFlow] No level 3+ items found, falling back to all items (level 1+)`);
    const fallbackItems = allItems.filter(item => matchesWatchlist(watchlist, item));
    const fallbackFilters = { ...effectiveFilters, minMacroLevel: 1 as MacroLevel };
    items = applyFilters(fallbackItems, fallbackFilters);
    console.log(`[RiskFlow] Fallback items after level 1+ filter: ${items.length}`);
    
    // If still no items, try without any macro level filter at all
    if (items.length === 0) {
      console.log(`[RiskFlow] Still no items, trying without macro level filter`);
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
      console.log(`[RiskFlow] Items without macro level filter: ${items.length}`);
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
    
    console.log(`[RiskFlow] getFeed returning: ${response.items.length} items (total: ${response.total}, hasMore: ${response.hasMore})`);
    return response;
  } catch (error) {
    console.error(`[RiskFlow] getFeed error for user ${userId}:`, error);
    console.error(`[RiskFlow] Error stack:`, error instanceof Error ? error.stack : 'No stack');
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
