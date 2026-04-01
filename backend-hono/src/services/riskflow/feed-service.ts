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
import { classifyEventType, getMartingaleMultiplier, enforceSentiment, addToSessionBaseline } from '../iv-scoring-v2.js';
import { broadcastLevel4 } from './sse-broadcaster.js';
// [claude-code 2026-03-27] S3: Rewired data pipeline — raw → scored Supabase tables, deprecating news_feed_items
import * as newsCache from './news-cache.js';
import { fetchEconomicFeed } from './economic-feed.js';
import type { NewsSource as AnalysisNewsSource } from '../../types/news-analysis.js';
import { isTwitterCliInstalled, pollTwitterForEconNews, getWarmCacheItems } from '../twitter-cli/index.js';
import { estimatePoints } from '../market-data/point-estimator.js';
import { fetchVIX } from '../vix-service.js';
import { createLogger } from '../../lib/logger.js';
import { writeRawItems, readScoredItems, type RawRiskFlowItem, type ScoredRiskFlowItem } from '../supabase-service.js';
import { isSupabaseConfigured } from '../../config/supabase.js';
import { scoredToFeedItem } from './central-scorer.js';

const log = createLogger('RiskFlow');
// [claude-code 2026-04-01] Bumped from 100 → 500. All scored items should be accessible.
const MAX_FEED_ITEMS = 500;
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
    submitted_by: 'feed-service',
  };
}

// In-memory cache (short-term) - DB cache is primary
let feedCache: { items: FeedItem[]; fetchedAt: number } | null = null;
const CACHE_TTL_MS = 15_000; // 15 seconds (in-memory cache)
const FETCH_INTERVAL_MS = 30_000; // 30 seconds between fresh DB reads
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
    ZeroHedge: 'Custom',
    DeItaOne: 'Custom',
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

    // [claude-code 2026-03-28] S9-T2: Force bearish on destruction/violence headlines
    const correctedSentiment = enforceSentiment(item.headline, ivResult.sentiment);

    // Compute point estimation from IV score × live VIX
    // S9-T2: Apply Martingale diminishing returns — repeated criticals get reduced points
    let priceBrainScore: FeedItem['priceBrainScore'] = undefined;
    if (ivResult.score >= 2 && vixData) {
      try {
        const feedInstrument = process.env.PRIMARY_INSTRUMENT || '/ES';
        const pts = estimatePoints(ivResult.score, vixData.level, feedInstrument);
        const martingale = getMartingaleMultiplier(item.headline, ivResult.macroLevel);
        const deltaPoints = Number((pts.scaledPoints * martingale).toFixed(1));
        addToSessionBaseline(deltaPoints);
        const sentimentMap: Record<string, 'Bullish' | 'Bearish' | 'Neutral'> = {
          bullish: 'Bullish', bearish: 'Bearish', neutral: 'Neutral',
        };
        priceBrainScore = {
          sentiment: sentimentMap[correctedSentiment] ?? 'Neutral',
          classification: 'Neutral',
          impliedPoints: deltaPoints,
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
      sentiment: correctedSentiment as SentimentDirection,
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

  // Filter by macro level (1-4 scale)
  if (filters.minMacroLevel !== undefined) {
    filtered = filtered.filter(item => (item.macroLevel ?? 1) >= filters.minMacroLevel!);
  }

  // [claude-code 2026-04-01] Strip foreign economic DATA prints (CPI, PPI, GDP, PMI, etc.)
  // Keep foreign commentary, geopolitical, rate decisions, and persons of interest.
  filtered = filtered.filter(item => !isForeignEconPrint(item.headline));

  return filtered;
}

// Foreign country prefixes that appear before econ data keywords
const FOREIGN_PREFIXES = [
  'french', 'france', 'german', 'euro area', 'eurozone', 'japanese',
  'japan', 'chinese', 'china', 'british', 'uk ', 'canadian', 'canada',
  'swiss', 'australian', 'australia', 'brazilian', 'brazil', 'indian',
  'india', 'mexican', 'mexico', 'spanish', 'spain', 'italian', 'italy',
  'swedish', 'sweden', 'norwegian', 'norway', 'korean', 'korea',
  'turkish', 'new zealand', 'south african',
];

// Econ data keywords — if headline has FOREIGN_PREFIX + one of these, it's foreign econ data
const ECON_DATA_KEYWORDS = [
  'cpi', 'ppi', 'gdp', 'pmi', 'hicp', 'employment', 'unemployment',
  'retail sales', 'trade balance', 'current account', 'industrial production',
  'consumer confidence', 'business confidence', 'housing', 'home sales',
  'inflation', 'deflation', 'wage', 'payroll', 'manufacturing',
  'services pmi', 'composite pmi', 'factory orders', 'construction',
  'actual', 'forecast', 'previous', 'revised',
  'foreign bond investment', 'foreign investment',
  'service ppi', 'public deficit',
];

function isForeignEconPrint(headline: string): boolean {
  const lower = headline.toLowerCase();
  // Must match a foreign prefix AND an econ data keyword
  const hasForeignPrefix = FOREIGN_PREFIXES.some(p => lower.includes(p));
  if (!hasForeignPrefix) return false;
  const hasEconKeyword = ECON_DATA_KEYWORDS.some(k => lower.includes(k));
  return hasEconKeyword;
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

    // S3: Write raw items to raw_riskflow_items for central scorer pipeline
    if (isSupabaseConfigured() && merged.length > 0) {
      const rawRows = merged.map(feedItemToRaw);
      writeRawItems(rawRows).then(n => {
        if (n > 0) log.info(` fetchFreshFeed: wrote ${n} raw items to raw_riskflow_items`);
      }).catch(err => log.warn('fetchFreshFeed: raw write failed', { error: String(err) }));
    }

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
 * Get feed items — reads from scored_riskflow_items (Supabase) as source of truth.
 * In-memory feedCache is a read-through cache on top of the scored table.
 * Falls back to legacy news_feed_items if Supabase is unavailable.
 *
 * [claude-code 2026-03-27] S3: Rewired to read from scored table instead of news_feed_items.
 * Scores now persist across restarts because they live in Supabase.
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

  // ── Primary read: scored_riskflow_items (Supabase) ──────────────────────
  let scoredDbItems: FeedItem[] = [];
  if (isSupabaseConfigured()) {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const scored = await readScoredItems({ since, limit: MAX_FEED_ITEMS });
    scoredDbItems = scored.map(scoredToFeedItem);
    log.info(` getCachedFeed: Found ${scoredDbItems.length} items in scored_riskflow_items`);
  }

  // ── Fallback: legacy news_feed_items (for migration period) ─────────────
  let legacyItems: FeedItem[] = [];
  if (scoredDbItems.length === 0) {
    legacyItems = await newsCache.getCachedFeed({ limit: MAX_FEED_ITEMS, hoursBack: 48 });
    log.info(` getCachedFeed: Fallback — ${legacyItems.length} items from legacy news_feed_items`);
  }

  const dbItems = scoredDbItems.length > 0 ? scoredDbItems : legacyItems;

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
      log.info(` Fresh fetch returned 0 items, using ${dbItems.length} items from database`);
      feedCache = { items: dbItems, fetchedAt: Date.now() };
      return dbItems;
    }

    // If fetch failed and database is empty, return empty unless mock fallback
    if (rawItems.length === 0 && dbItems.length === 0) {
      log.warn(` No items from fresh fetch and database is empty`);

      if (ALLOW_MOCK_FALLBACK) {
        log.warn(` RISKFLOW_ALLOW_MOCK_FALLBACK=true — generating fallback mock data`);
        const mockItems = generateMockFeed();
        const enrichedItems = await enrichFeedWithAnalysis(mockItems);
        await newsCache.storeFeedItems(enrichedItems);
        feedCache = { items: enrichedItems, fetchedAt: Date.now() };
        return enrichedItems;
      }

      feedCache = { items: [], fetchedAt: Date.now() };
      return [];
    }

    // Dedupe against what we already have in the scored table
    const dbIdSet = new Set(dbItems.map(i => i.id));
    const newItems = rawItems.filter(item => !dbIdSet.has(item.id));

    log.info(` ${newItems.length} new items to analyze (${dbIdSet.size} already in scored DB)`);

    // Only analyze new items (for immediate in-memory display while central scorer catches up)
    let enrichedNewItems: FeedItem[] = [];
    if (newItems.length > 0) {
      enrichedNewItems = await enrichFeedWithAnalysis(newItems);
      // Also store in legacy cache for backward compat
      await newsCache.storeFeedItems(enrichedNewItems).catch(() => {});
      log.info(` Enriched ${enrichedNewItems.length} new items (in-memory fast path)`);
    }

    // Merge: scored DB items (source of truth) + newly enriched in-memory items
    const scoredMap = new Map<string, FeedItem>();
    // 1. Scored DB items are canonical
    for (const item of dbItems) {
      scoredMap.set(item.id, item);
    }
    // 2. Newly enriched items fill gaps (not yet in scored table)
    for (const item of enrichedNewItems) {
      if (!scoredMap.has(item.id)) scoredMap.set(item.id, item);
    }
    // 3. Preserve any in-memory scored items not yet written to DB
    for (const item of feedCache?.items ?? []) {
      if (item.ivScore != null && !scoredMap.has(item.id)) {
        scoredMap.set(item.id, item);
      }
    }
    const allItems = Array.from(scoredMap.values()).slice(0, MAX_FEED_ITEMS);

    feedCache = { items: allItems, fetchedAt: Date.now() };
    log.info(` Returning ${allItems.length} total items (${scoredDbItems.length} scored DB, ${enrichedNewItems.length} new)`);
    return allItems;
  }

  // Use database items — merge with any in-memory scored items not yet persisted
  if (feedCache && feedCache.items.some(i => i.ivScore != null)) {
    const scoredMap = new Map<string, FeedItem>();
    for (const item of dbItems) {
      scoredMap.set(item.id, item);
    }
    for (const item of feedCache.items) {
      if (item.ivScore != null && !scoredMap.has(item.id)) {
        scoredMap.set(item.id, item);
      }
    }
    const merged = Array.from(scoredMap.values()).slice(0, MAX_FEED_ITEMS);
    feedCache = { items: merged, fetchedAt: Date.now() };
    log.info(` Merged ${merged.length} items (scored DB primary, in-memory supplements)`);
    return merged;
  }

  log.info(` Using ${dbItems.length} items from scored database`);
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
 * Get feed with user watchlist applied.
 * [claude-code 2026-04-01] UNIFIED FEED: No macroLevel filtering by default.
 * ALL scored items show in RiskFlow. Frontend controls display priority via severity badges.
 * macroLevel filter only applies if explicitly requested by the caller.
 */
export async function getFeed(userId: string, filters?: FeedFilters): Promise<FeedResponse> {
  try {
    const allItems = await getCachedFeed();

    if (allItems.length === 0) {
      log.warn('getCachedFeed returned 0 items — check DB connection');
    }

    const watchlist = getWatchlist(userId);

    // Apply watchlist filtering
    let items = allItems.filter(item => matchesWatchlist(watchlist, item));

  // No default macroLevel gate — show everything unless caller explicitly filters
  const effectiveFilters: FeedFilters = { ...filters };

  // Apply filters (macroLevel only if caller set it)
  items = applyFilters(items, effectiveFilters);

  // No fallback needed — unified feed shows everything

  // Sort by macro level (highest first), then by published date
  items.sort((a, b) => {
    // Macro level priority (4 > 3 > 2 > 1)
    const macroA = a.macroLevel ?? 1;
    const macroB = b.macroLevel ?? 1;
    if (macroB !== macroA) return macroB - macroA;
    // Then by date (newest first)
    return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
  });

    // Apply pagination (offset + limit)
    const limit = Math.min(filters?.limit ?? MAX_FEED_ITEMS, MAX_FEED_ITEMS);
    const offset = filters?.offset ?? 0;
    const paginatedItems = items.slice(offset, offset + limit);

    const response = {
      items: paginatedItems,
      total: items.length,
      hasMore: offset + limit < items.length,
      nextCursor: offset + limit < items.length ? String(offset + limit) : undefined,
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
