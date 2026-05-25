/**
 * Feed Service
 * RiskFlow news feed aggregation and filtering with AI analysis
 * Day 17 - Phase 5 Integration
 */

// [claude-code 2026-04-29] S52-T2: Earnings items floored at macroLevel 1 (LOW) after enrichment AND rescoreInMemoryFeed
// [claude-code 2026-04-11] Cache re-sync reduced 120s→30s to match central scorer frequency
// [claude-code 2026-04-04] Periodic DB re-sync so cache stays fresh when poller idles
// [claude-code 2026-04-03] Chronological sort (publishedAt DESC), cold start bumped to 200 items
// [claude-code 2026-03-24] Pass VIX data into calculateIVScore for continuous curve multiplier + sub-scores
// [claude-code 2026-03-11] Integrated point estimator for commentary point ranges + VIX feed
// [claude-code 2026-03-12] Task 2A: Polymarket sentiment inference + failed enrichment fallback
// [claude-code 2026-03-10] Default minMacroLevel lowered 3→2 (Medium+ threshold per Track 1 spec)
import type {
  FeedItem,
  FeedResponse,
  FeedFilters,
  NewsSource,
  UrgencyLevel,
  SentimentDirection,
  MacroLevel,
} from "../../types/riskflow.js";
import { getWatchlist, matchesWatchlist } from "./watchlist-service.js";
import {
  analyzeHeadline,
  type AnalyzedHeadline,
} from "../analysis/grok-analyzer.js";
import { calculateIVScore } from "../analysis/iv-scorer.js";
import {
  classifyEventType,
  getMartingaleMultiplier,
  enforceSentiment,
  addToSessionBaseline,
} from "../iv-scoring/index.js";
import { broadcastLevel4 } from "./sse-broadcaster.js";
import { getMatchedKeywords } from "../headline-parser.js";
// [claude-code 2026-03-27] S3: Rewired data pipeline — raw → scored Supabase tables, deprecating news_feed_items
import * as newsCache from "./news-cache.js";
import { fetchEconomicFeed } from "./economic-feed.js";
import type { NewsSource as AnalysisNewsSource } from "../../types/news-analysis.js";
import { pollForEconNews, getWarmCacheItems } from "./econ-rettiwt-poller.js";
import { isRettiwtAvailable } from "../rettiwt-service.js";
import {
  estimatePoints,
  shouldUncapNarrativePressure,
} from "../market-data/point-estimator.js";
import { fetchVIX } from "../vix-service.js";
import { createLogger } from "../../lib/logger.js";
import {
  writeRawItems,
  readScoredItems,
  type RawRiskFlowItem,
  type ScoredRiskFlowItem,
} from "../supabase-service.js";
import { isSupabaseConfigured } from "../../config/supabase.js";
import { filterWithContentGuard } from "./content-guard.js";
import { scoredToFeedItem } from "./central-scorer.js";
import { assignMacroLevel } from "../../utils/assign-macro-level.js";
import { extractFJEmojiFromText, fjTierFromEmoji } from "./fj-emoji-filter.js";
import { filterBlockedAtReadTime } from "./feed-integrity.js";
import { createLogger as createIntegrityLogger } from "../../lib/logger.js";

const log = createLogger("RiskFlow");
// [claude-code 2026-04-01] Bumped from 100 → 500. All scored items should be accessible.
const MAX_FEED_ITEMS = 500;
const isDev = process.env.NODE_ENV !== "production";

// Stopwords for headline dedup — hoisted to module scope to avoid re-creating per item
const DEDUP_STOPWORDS = new Set([
  "the",
  "a",
  "an",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "has",
  "have",
  "had",
  "do",
  "does",
  "did",
  "will",
  "would",
  "could",
  "should",
  "may",
  "might",
  "can",
  "shall",
  "must",
  "not",
  "no",
  "nor",
  "but",
  "and",
  "or",
  "if",
  "of",
  "in",
  "on",
  "at",
  "to",
  "for",
  "by",
  "with",
  "from",
  "that",
  "this",
  "its",
  "it",
  "i",
  "am",
  "so",
  "as",
  "up",
]);
const ALLOW_MOCK_FALLBACK = process.env.RISKFLOW_ALLOW_MOCK_FALLBACK === "true";

// Keyword lists for sentiment inference (used for Polymarket + failed enrichment fallback)
const BULLISH_KEYWORDS = [
  "growth",
  "rally",
  "beat",
  "rate cut",
  "stimulus",
  "surge",
  "rise",
  "gain",
  "jump",
  "soar",
  "bull",
  "record high",
  "above",
  "upgrade",
  "boom",
  "positive",
  "strong",
];
const BEARISH_KEYWORDS = [
  "recession",
  "crash",
  "default",
  "war",
  "cut",
  "drop",
  "fall",
  "plunge",
  "decline",
  "sink",
  "bear",
  "miss",
  "below",
  "downgrade",
  "slump",
  "negative",
  "fear",
  "risk",
  "warn",
  "sell",
  "weak",
];

/**
 * Infer bullish/bearish sentiment from headline text using keyword matching.
 * Returns 'bullish' or 'bearish' (never neutral — always picks a side).
 */
function inferSentimentFromKeywords(text: string): "bullish" | "bearish" {
  const lower = text.toLowerCase();
  let bullCount = 0;
  let bearCount = 0;
  for (const kw of BULLISH_KEYWORDS) if (lower.includes(kw)) bullCount++;
  for (const kw of BEARISH_KEYWORDS) if (lower.includes(kw)) bearCount++;
  return bullCount >= bearCount ? "bullish" : "bearish";
}

// Enable/disable AI analysis (can be toggled via env)
const ENABLE_AI_ANALYSIS = process.env.ENABLE_AI_ANALYSIS !== "false";

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
    submitted_by: "feed-service",
    ingest_pipeline: item.ingest_pipeline,
  };
}

// In-memory cache — seeded from scored DB on boot, then re-synced periodically from DB.
let feedCache: FeedItem[] | null = null;
let lastCacheRefreshMs = 0;
const CACHE_REFRESH_INTERVAL_MS = 15_000; // 15s — stable but responsive

function sortFeedItems(items: FeedItem[]): FeedItem[] {
  return [...items].sort(
    (a, b) =>
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
  );
}

function normalizeIvScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score * 10)));
}

function inferRiskTypeFromText(
  text: string,
): NonNullable<FeedItem["riskType"]> {
  const lower = text.toLowerCase();
  if (
    /(fed|fomc|cpi|ppi|gdp|nfp|pce|inflation|jobless|retail sales|housing starts|consumer confidence|treasury)/.test(
      lower,
    )
  ) {
    return "Macro";
  }
  if (
    /(war|tariff|sanction|military|conflict|opec|nato|invasion|missile|nuclear|strait of hormuz|proxy attack)/.test(
      lower,
    )
  ) {
    return "Geopolitical";
  }
  if (
    /(earnings|eps|revenue|guidance|beat|miss|quarterly|aapl|nvda|msft|amzn|goog|meta|tsla)/.test(
      lower,
    )
  ) {
    return "Earnings";
  }
  if (
    /(resistance|support|breakout|volume|rsi|macd|moving average|trend)/.test(
      lower,
    )
  ) {
    return "Technical";
  }
  if (
    /(credit spread|high yield|leverage|default|downgrade|junk bond)/.test(
      lower,
    )
  ) {
    return "Credit";
  }
  if (
    /(repo|funding|liquidity|bank run|cash crunch|reserve|circuit breaker|flash crash)/.test(
      lower,
    )
  ) {
    return "Liquidity";
  }
  return "Commentary";
}

function resolveRiskTypeForAssignment(
  item: FeedItem,
  parsedTags: string[],
): NonNullable<FeedItem["riskType"]> {
  if (item.riskType) return item.riskType;
  const text = `${item.headline} ${parsedTags.join(" ")}`;
  return inferRiskTypeFromText(text);
}

function countUrgencySignals(
  item: FeedItem,
  analyzed: AnalyzedHeadline,
): number {
  let signals = 0;
  if (item.isBreaking || analyzed.parsed.isBreaking) signals += 1;
  if (item.urgency === "immediate" || item.urgency === "high") signals += 1;
  if (
    analyzed.parsed.urgency === "immediate" ||
    analyzed.parsed.urgency === "high"
  )
    signals += 1;
  if (analyzed.hotPrint && analyzed.hotPrint.impact !== "low") signals += 1;
  if (
    analyzed.parsed.marketReaction?.intensity === "severe" ||
    analyzed.parsed.marketReaction?.intensity === "moderate"
  ) {
    signals += 1;
  }
  if ((item.macroLevel ?? 1) >= 3) signals += 1;
  return signals;
}

/**
 * Cold-start cache warm from scored_riskflow_items.
 * Called during boot so first feed request is never empty if DB already has data.
 * S48-T1 Fix 5: also fetches fresh econ/commentary items so the economic-calendar
 * pipeline feeds into the cache immediately rather than waiting for the next scoring cycle.
 */
async function warmCacheFromDB(): Promise<void> {
  try {
    // [claude-code 2026-04-06] Was 200 — matched MAX_FEED_ITEMS (500) so cache isn't artificially starved
    const scored = await readScoredItems({ limit: MAX_FEED_ITEMS });

    // S48-T1 Fix 5: Also fetch fresh econ items so the pipeline feeds the cache on boot
    let freshItems: FeedItem[] = [];
    try {
      freshItems = await fetchFreshFeed();
    } catch (freshErr) {
      log.warn("[FeedService] fetchFreshFeed during warm failed (non-fatal)", {
        error: String(freshErr),
      });
    }

    const scoredItems = scored.map(scoredToFeedItem);
    const merged = [...scoredItems, ...freshItems].filter(
      (item, idx, arr) => idx === arr.findIndex((i) => i.id === item.id),
    );
    if (merged.length === 0) {
      // Keep existing cache — don't blink to empty just because DB returned 0
      return;
    }

    const items = sortFeedItems(merged).slice(0, MAX_FEED_ITEMS);
    // Merge with existing cache so we don't lose items that were added via SSE
    if (feedCache) {
      const existingIds = new Set(feedCache.map((i) => i.id));
      for (const item of items) {
        if (!existingIds.has(item.id)) {
          feedCache.push(item);
        }
      }
    } else {
      feedCache = items;
    }
    feedCache = sortFeedItems(feedCache).slice(0, MAX_FEED_ITEMS);
    lastCacheRefreshMs = Date.now();
    log.info(
      `[FeedService] Cache synced with ${items.length} items from DB (${scoredItems.length} scored + ${freshItems.length} fresh)`,
    );
  } catch (err) {
    log.warn("[FeedService] Cold-start seed failed (non-fatal)", {
      error: String(err),
    });
  }
}

// Backward-compatible export used by existing boot initialization.
export async function seedCacheFromDb(): Promise<void> {
  await warmCacheFromDB();
}

/**
 * Write-through cache update used by pollers after successful enrichment cycles.
 * Merges new items into the existing cache (deduped by ID) so the full feed
 * is never replaced by a small batch of newly polled items.
 * Empty updates are ignored so warm cache is never replaced with [].
 */
// [claude-code 2026-04-05] Fix: merge new items into cache instead of replacing — prevents feed wipe on poll
export function updateFeedCache(items: FeedItem[]): void {
  if (items.length === 0) return;

  const existing = feedCache ?? [];
  const existingIds = new Set(existing.map((i) => i.id));
  const newItems = items.filter((i) => !existingIds.has(i.id));
  const merged = [...newItems, ...existing];
  const nextItems = sortFeedItems(merged).slice(0, MAX_FEED_ITEMS);
  feedCache = nextItems;
  lastCacheRefreshMs = Date.now();
  log.info(
    `[FeedService] Cache updated: ${newItems.length} new, ${nextItems.length} total`,
  );
}

/**
 * Map RiskFlow NewsSource to Analysis NewsSource
 */
function mapToAnalysisSource(source: NewsSource): AnalysisNewsSource {
  const sourceMap: Record<NewsSource, AnalysisNewsSource> = {
    FinancialJuice: "FinancialJuice",
    OSINTSources: "OSINTSources",
    EconomicCalendar: "Custom",
    TrendSpider: "Custom",
    Barchart: "Custom",
    Polymarket: "Custom",
    Kalshi: "Custom",
    TwitterCli: "FinancialJuice", // FJ emoji-filtered tweets treated as FJ quality
    DeItaOne: "Custom",
    Custom: "Custom",
    Hermes: "Custom",
    Untrusted: "Custom",
    Commentary: "Commentary",
  };
  return sourceMap[source] ?? "Custom";
}

/**
 * Enrich a feed item with AI analysis.
 * Accepts pre-fetched VIX data to avoid redundant fetches across batch items.
 */
async function enrichWithAnalysis(
  item: FeedItem,
  prefetchedVIX?: Awaited<ReturnType<typeof fetchVIX>> | null,
): Promise<FeedItem> {
  try {
    const analysisSource = mapToAnalysisSource(item.source);
    const analyzed = await analyzeHeadline(item.headline, analysisSource);

    // V3: Use V2's classifier to catch credit/yield/liquidity events that
    // the basic headline parser might miss. Override only if it found something specific.
    const v2EventType = classifyEventType(analyzed.parsed);
    if (
      (!analyzed.parsed.eventType ||
        analyzed.parsed.eventType === "default" ||
        analyzed.parsed.eventType === "economicData") &&
      v2EventType !== "economicData" &&
      v2EventType !== "default"
    ) {
      analyzed.parsed.eventType = v2EventType;
    }

    // Fetch VIX once (use prefetched if available)
    const vixData = prefetchedVIX ?? (await fetchVIX().catch(() => null));

    // Calculate IV score using parsed data (now with VIX-weighted continuous curve)
    const ivResult = await calculateIVScore({
      parsed: analyzed.parsed,
      hotPrint: analyzed.hotPrint,
      timestamp: new Date(item.publishedAt),
      vixData: vixData ?? undefined,
    });

    // [claude-code 2026-03-28] S9-T2: Force bearish on destruction/violence headlines
    const correctedSentiment = enforceSentiment(
      item.headline,
      ivResult.sentiment,
    );

    const riskType = resolveRiskTypeForAssignment(item, analyzed.parsed.tags);
    const normalizedIvScore = normalizeIvScore(ivResult.score);
    const fjEmojiTier = fjTierFromEmoji(extractFJEmojiFromText(item.headline));
    const keywordMatches = getMatchedKeywords(item.headline);
    const urgencySignalCount = countUrgencySignals(item, analyzed);

    // SD surprise: use HotPrint deviation as a proxy for standard deviation surprise.
    // HotPrint.deviation is abs(actual - forecast). HotPrint.impact maps:
    //   'high' → >2 SD territory, 'medium' → ~1-2 SD, 'low' → <1 SD
    // When no hotPrint exists, sdSurprise stays undefined (non-econ catalyst).
    let sdSurprise: number | undefined;
    if (analyzed.hotPrint && analyzed.hotPrint.deviation !== undefined) {
      if (analyzed.hotPrint.impact === "high") {
        sdSurprise = Math.max(2, analyzed.hotPrint.deviation);
      } else if (analyzed.hotPrint.impact === "medium") {
        sdSurprise = Math.max(1, Math.min(2, analyzed.hotPrint.deviation));
      } else {
        sdSurprise = Math.min(1, analyzed.hotPrint.deviation);
      }
    }

    const rawMacroLevel = assignMacroLevel({
      ivScore: normalizedIvScore,
      fjEmojiTier,
      riskType,
      keywordMatches,
      urgencySignals: urgencySignalCount,
      sdSurprise,
    });

    // S51: Earnings items are low priority — floor at macroLevel 1 (LOW)
    const macroLevel =
      riskType === "Earnings"
        ? (Math.min(rawMacroLevel ?? 1, 1) as MacroLevel)
        : rawMacroLevel;
    if (macroLevel === undefined) {
      log.warn("MacroLevel unassigned after assignMacroLevel()", {
        itemId: item.id,
        headline: item.headline,
      });
    }

    // narrativePressureCap uncap: Level 4 Macro or Geopolitical events
    const uncapNarrativePressure = shouldUncapNarrativePressure({
      macroLevel,
      riskType,
    });

    // Compute point estimation from IV score × live VIX
    // S9-T2: Apply Martingale diminishing returns — repeated criticals get reduced points
    let priceBrainScore: FeedItem["priceBrainScore"] = undefined;
    if (ivResult.score >= 2 && vixData) {
      try {
        const feedInstrument = process.env.PRIMARY_INSTRUMENT || "/ES";
        const pts = estimatePoints(
          ivResult.score,
          vixData.level,
          feedInstrument,
          undefined,
          analyzed.parsed.narrativePressure ?? 0,
          { uncapNarrativePressure },
        );
        const martingale = getMartingaleMultiplier(item.headline, macroLevel);
        const deltaPoints = Number((pts.scaledPoints * martingale).toFixed(1));
        addToSessionBaseline(deltaPoints);
        const sentimentMap: Record<string, "Bullish" | "Bearish" | "Neutral"> =
          {
            bullish: "Bullish",
            bearish: "Bearish",
            neutral: "Neutral",
          };
        priceBrainScore = {
          sentiment: sentimentMap[correctedSentiment] ?? "Neutral",
          classification: "Neutral",
          impliedPoints: deltaPoints,
          instrument: feedInstrument,
        };
      } catch {
        // Point estimation failed — skip
      }
    }

    // [claude-code 2026-04-12] Cap IV score at 7 for non-X primary sources.
    // Wire feeds (FJ, DeItaOne, TwitterCli) can score higher because they're
    // real-time breaking. Secondary sources (Exa scrapes, OSINT, calendars) are
    // aggregated and unlikely to be true breaking-news events.
    const X_PRIMARY_SOURCES: Set<string> = new Set([
      "FinancialJuice",
      "DeItaOne",
      "TwitterCli",
    ]);
    const NON_X_IV_CAP = 7;
    const cappedIvScore =
      X_PRIMARY_SOURCES.has(item.source) || ivResult.score <= NON_X_IV_CAP
        ? ivResult.score
        : NON_X_IV_CAP;

    const enriched: FeedItem = {
      ...item,
      symbols:
        analyzed.parsed.symbols.length > item.symbols.length
          ? analyzed.parsed.symbols
          : item.symbols,
      tags: [...new Set([...item.tags, ...analyzed.parsed.tags])],
      isBreaking: item.isBreaking || analyzed.parsed.isBreaking,
      urgency: getHigherUrgency(item.urgency, analyzed.parsed.urgency),
      sentiment: correctedSentiment as SentimentDirection,
      ivScore: cappedIvScore,
      subScores: ivResult.subScores,
      macroLevel: macroLevel as MacroLevel,
      riskType,
      analyzedAt: new Date().toISOString(),
      priceBrainScore,
    };

    if (enriched.macroLevel === 4) {
      broadcastLevel4(enriched);
    }

    return enriched;
  } catch (error) {
    log.error("Analysis enrichment failed", {
      itemId: item.id,
      error: String(error),
    });
    // Fallback: ensure every item gets bullish/bearish (never null/neutral from failed enrichment)
    if (!item.sentiment || item.sentiment === "neutral") {
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
    immediate: 3,
    high: 2,
    normal: 1,
  };
  return priority[a] >= priority[b] ? a : b;
}

/**
 * Batch enrich feed items with analysis.
 * Fetches VIX once and shares across all items to avoid redundant API calls.
 * Exported for use by feed poller.
 */
export async function enrichFeedWithAnalysis(
  items: FeedItem[],
): Promise<FeedItem[]> {
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
    const results = await Promise.all(
      batch.map((item) => enrichWithAnalysis(item, vixData)),
    );
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
    filtered = filtered.filter((item) =>
      filters.sources!.includes(item.source),
    );
  }

  if (filters.symbols?.length) {
    const symbolSet = new Set(filters.symbols.map((s) => s.toUpperCase()));
    filtered = filtered.filter((item) =>
      item.symbols.some((s) => symbolSet.has(s.toUpperCase())),
    );
  }

  if (filters.tags?.length) {
    const tagSet = new Set(filters.tags.map((t) => t.toUpperCase()));
    filtered = filtered.filter((item) =>
      item.tags.some((t) => tagSet.has(t.toUpperCase())),
    );
  }

  if (filters.breakingOnly) {
    filtered = filtered.filter((item) => item.isBreaking);
  }

  if (filters.minIvScore !== undefined) {
    filtered = filtered.filter(
      (item) => (item.ivScore ?? 0) >= filters.minIvScore!,
    );
  }

  // Filter by macro level (1-4 scale)
  if (filters.minMacroLevel !== undefined) {
    filtered = filtered.filter(
      (item) => (item.macroLevel ?? 1) >= filters.minMacroLevel!,
    );
  }

  // [claude-code 2026-04-01] Strip foreign economic DATA prints (CPI, PPI, GDP, PMI, etc.)
  // Keep foreign commentary, geopolitical, rate decisions, and persons of interest.
  filtered = filtered.filter((item) => !isForeignEconPrint(item.headline));

  return filtered;
}

// Foreign country prefixes that appear before econ data keywords
const FOREIGN_PREFIXES = [
  "french",
  "france",
  "german",
  "euro area",
  "eurozone",
  "japanese",
  "japan",
  "chinese",
  "china",
  "british",
  "uk ",
  "canadian",
  "canada",
  "swiss",
  "australian",
  "australia",
  "brazilian",
  "brazil",
  "indian",
  "india",
  "mexican",
  "mexico",
  "spanish",
  "spain",
  "italian",
  "italy",
  "swedish",
  "sweden",
  "norwegian",
  "norway",
  "korean",
  "korea",
  "turkish",
  "new zealand",
  "south african",
  // [claude-code 2026-04-20] Regional prefixes — catch "Asia markets mixed" style wraps
  "asia",
  "asian",
  "european",
  "europe",
  "latin america",
  "emerging market",
  "em ",
];

// [claude-code 2026-04-20] Expanded: foreign stock-index / market-wrap headlines are noise
//   for a US-focused fund. "Indian Stocks Face Fresh Hurdle" etc. now caught.
// Econ data keywords — if headline has FOREIGN_PREFIX + one of these, it's foreign noise
const ECON_DATA_KEYWORDS = [
  "cpi",
  "ppi",
  "gdp",
  "pmi",
  "hicp",
  "employment",
  "unemployment",
  "retail sales",
  "trade balance",
  "current account",
  "industrial production",
  "consumer confidence",
  "business confidence",
  "housing",
  "home sales",
  "inflation",
  "deflation",
  "wage",
  "payroll",
  "manufacturing",
  "services pmi",
  "composite pmi",
  "factory orders",
  "construction",
  "actual",
  "forecast",
  "previous",
  "revised",
  "foreign bond investment",
  "foreign investment",
  "service ppi",
  "public deficit",
  // Foreign stock market / index wrap headlines
  // [claude-code 2026-04-20] Added bare "markets" — only fires with a foreign prefix
  "markets",
  "stocks",
  "stock index",
  "stock market",
  "equities",
  "shares",
  "bourse",
  "nifty",
  "sensex",
  "kospi",
  "topix",
  "nikkei",
  "hang seng",
  "shanghai composite",
  "dax",
  "ftse",
  "cac ",
  "stoxx",
  "asx",
  "tsx",
  "bovespa",
  "ibovespa",
];

function isForeignEconPrint(headline: string): boolean {
  const lower = headline.toLowerCase();
  // Must match a foreign prefix AND an econ data keyword
  const hasForeignPrefix = FOREIGN_PREFIXES.some((p) => lower.includes(p));
  if (!hasForeignPrefix) return false;
  const hasEconKeyword = ECON_DATA_KEYWORDS.some((k) => lower.includes(k));
  return hasEconKeyword;
}

/**
 * Fetch fresh feed from Rettiwt + economic prints + Polymarket odds
 */
async function fetchFreshFeed(): Promise<FeedItem[]> {
  try {
    const [econItems, rettiwtItems] = await Promise.all([
      fetchEconomicFeed(),
      isRettiwtAvailable()
        ? pollForEconNews().catch(() => [] as FeedItem[])
        : Promise.resolve([] as FeedItem[]),
    ]);

    // Include warm-cached Critical/High posts seeded at startup
    const warmItems = getWarmCacheItems();

    // Merge and dedupe by id
    const merged = [...econItems, ...rettiwtItems, ...warmItems].filter(
      (item, idx, arr) => idx === arr.findIndex((i) => i.id === item.id),
    );

    log.info(
      ` fetchFreshFeed: Merged ${merged.length} items (${econItems.length} econ, ${rettiwtItems.length} rettiwt)`,
    );

    // S3: Write raw items to raw_riskflow_items for central scorer pipeline
    const cleanMerged = filterWithContentGuard(
      merged,
      (i) => `${i.headline} ${i.body || ""}`,
      { source: "feed-service:fetchFreshFeed", getSource: (i) => i.source },
    );
    if (isSupabaseConfigured() && cleanMerged.length > 0) {
      const rawRows = cleanMerged.map(feedItemToRaw);
      writeRawItems(rawRows)
        .then((n) => {
          if (n > 0)
            log.info(
              ` fetchFreshFeed: wrote ${n} raw items to raw_riskflow_items`,
            );
        })
        .catch((err) =>
          log.warn("fetchFreshFeed: raw write failed", { error: String(err) }),
        );
    }

    return merged;
  } catch (error) {
    log.error("Fetch error", { error: String(error) });
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
      id: "mock-1",
      source: "FinancialJuice",
      headline: "BREAKING: Fed signals potential rate cut in March meeting",
      body: "Federal Reserve officials indicate openness to rate cuts amid cooling inflation data.",
      symbols: ["ES", "NQ", "SPY"],
      tags: ["FED", "FOMC", "RATES"],
      isBreaking: true,
      urgency: "immediate",
      publishedAt: new Date(now.getTime() - 5 * 60_000).toISOString(),
    },
    {
      id: "mock-2",
      source: "OSINTSources",
      headline: "CPI comes in at 2.9% YoY, below expectations of 3.1%",
      body: "Consumer Price Index shows continued disinflation trend.",
      symbols: ["ES", "NQ", "TLT"],
      tags: ["CPI", "INFLATION"],
      isBreaking: true,
      urgency: "immediate",
      ivScore: 8.5,
      publishedAt: new Date(now.getTime() - 15 * 60_000).toISOString(),
    },
    {
      id: "mock-3",
      source: "FinancialJuice",
      headline: "NVDA announces new AI chip with 2x performance improvement",
      symbols: ["NVDA", "AMD", "INTC"],
      tags: ["TECH", "AI"],
      isBreaking: false,
      urgency: "high",
      publishedAt: new Date(now.getTime() - 30 * 60_000).toISOString(),
    },
    {
      id: "mock-4",
      source: "OSINTSources",
      headline: "Oil prices surge on Middle East tensions",
      body: "Crude oil jumps 3% as geopolitical risks escalate.",
      symbols: ["CL", "USO", "XLE"],
      tags: ["OIL", "COMMODITIES"],
      isBreaking: false,
      urgency: "normal",
      publishedAt: new Date(now.getTime() - 45 * 60_000).toISOString(),
    },
    {
      id: "mock-5",
      source: "FinancialJuice",
      headline: "Initial jobless claims at 220K vs 215K expected",
      symbols: ["ES", "NQ"],
      tags: ["JOBS", "NFP"],
      isBreaking: false,
      urgency: "normal",
      ivScore: 4.2,
      publishedAt: new Date(now.getTime() - 60 * 60_000).toISOString(),
    },
  ];

  return mockItems;
}

/**
 * Get feed items — reads from scored_riskflow_items (Supabase) as source of truth.
 * In-memory feedCache is seeded from scored DB and then updated write-through by pollers.
 * Falls back to legacy news_feed_items if Supabase is unavailable.
 *
 * [claude-code 2026-03-27] S3: Rewired to read from scored table instead of news_feed_items.
 * Scores now persist across restarts because they live in Supabase.
 */
async function getCachedFeed(): Promise<FeedItem[]> {
  // Return warm cache if present AND recently refreshed from DB.
  // Periodic re-sync ensures items added via Central Scorer or manual ingestion
  // appear in RiskFlow even when the poller returns 0 new items.
  const cacheAge = Date.now() - lastCacheRefreshMs;
  if (feedCache && cacheAge < CACHE_REFRESH_INTERVAL_MS) {
    return feedCache;
  }

  // Cache is stale or missing — re-read from DB
  if (feedCache && isSupabaseConfigured()) {
    try {
      await warmCacheFromDB();
      lastCacheRefreshMs = Date.now();
      if (feedCache) return feedCache;
    } catch {
      // DB re-sync failed — serve stale cache rather than empty
      return feedCache;
    }
  }

  try {
    if (isSupabaseConfigured()) {
      await warmCacheFromDB();
      if (feedCache) return feedCache;
    }

    // Fallback: legacy news_feed_items (migration compatibility)
    const legacyItems = await newsCache.getCachedFeed({
      limit: MAX_FEED_ITEMS,
      hoursBack: 48,
    });
    if (legacyItems.length > 0) {
      updateFeedCache(legacyItems);
      return feedCache ?? legacyItems;
    }

    // Optional mock fallback (disabled by default)
    if (ALLOW_MOCK_FALLBACK && isDev) {
      const mockItems = generateMockFeed();
      const enrichedItems = await enrichFeedWithAnalysis(mockItems);
      updateFeedCache(enrichedItems);
      return feedCache ?? enrichedItems;
    }

    // Last resort: fetch directly from sources if all caches are empty
    const rawItems = await fetchFreshFeed();
    if (rawItems.length === 0) return feedCache ?? [];

    const enrichedItems = await enrichFeedWithAnalysis(rawItems);
    await newsCache.storeFeedItems(enrichedItems).catch(() => {});
    updateFeedCache(enrichedItems);
    return feedCache ?? enrichedItems;
  } catch (error) {
    log.error("[FeedService] Fetch failed, serving stale cache", {
      error: String(error),
    });
    return feedCache ?? [];
  }
}

/**
 * Re-score all in-memory feed items with current regime/calibration/commentator weights.
 * Called by the /api/riskflow/rescore endpoint.
 * Forces re-enrichment of ALL cached items (not just new ones).
 */
// [claude-code 2026-03-27] Rescore in-memory feed for regime-aware V3 scoring
export async function rescoreInMemoryFeed(): Promise<number> {
  const items = feedCache ?? [];
  if (items.length === 0) {
    log.info("rescoreInMemoryFeed: no cached items to rescore");
    return 0;
  }

  log.info(
    `rescoreInMemoryFeed: recalculating macro levels for ${items.length} cached items (no AI re-analysis)`,
  );

  // Recalculate macro levels using current calibration weights + existing ivScore
  // This is fast — no AI calls, no VIX fetch, just weight math
  const rescored = items.map((item) => {
    try {
      const ivScore = item.ivScore ?? 0;
      const fjEmojiTier = fjTierFromEmoji(
        extractFJEmojiFromText(item.headline),
      );
      const riskType = item.riskType ?? "default";
      const keywordMatches = getMatchedKeywords(item.headline);

      const rawMacroLevel = assignMacroLevel({
        ivScore,
        fjEmojiTier,
        riskType,
        keywordMatches,
        urgencySignals: item.isBreaking ? 2 : 0,
      });

      // S52-T2: Earnings items are low priority — floor at macroLevel 1 (LOW)
      const macroLevel =
        riskType === "Earnings"
          ? (Math.min(rawMacroLevel ?? 1, 1) as MacroLevel)
          : rawMacroLevel;

      return {
        ...item,
        macroLevel: macroLevel ?? item.macroLevel,
      };
    } catch {
      return item;
    }
  });

  updateFeedCache(rescored);
  log.info(`rescoreInMemoryFeed: done — ${rescored.length} items rescored`);
  return rescored.length;
}

/**
 * Get feed with user watchlist applied.
 * [claude-code 2026-04-01] UNIFIED FEED: No macroLevel filtering by default.
 * ALL scored items show in RiskFlow. Frontend controls display priority via severity badges.
 * macroLevel filter only applies if explicitly requested by the caller.
 */
export async function getFeed(
  userId: string,
  filters?: FeedFilters,
): Promise<FeedResponse> {
  try {
    const allItems = await getCachedFeed();

    if (allItems.length === 0) {
      log.warn("getCachedFeed returned 0 items — check DB connection");
    }

    const watchlist = getWatchlist(userId);

    // Apply watchlist filtering
    let items = allItems.filter((item) => matchesWatchlist(watchlist, item));

    // No default macroLevel gate — show everything unless caller explicitly filters
    const effectiveFilters: FeedFilters = { ...filters };

    // Apply filters (macroLevel only if caller set it)
    items = applyFilters(items, effectiveFilters);

    // No fallback needed — unified feed shows everything

    // Sort chronologically (newest first)
    items.sort(
      (a, b) =>
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
    );

    // [claude-code 2026-04-16] Token-overlap fuzzy dedup for semantic duplicates
    // Removes near-identical headlines from different sources (e.g. FJ vs OSINT)
    const preDedup = items.length;
    const seenHeadlines: Array<{ key: string; tokens: Set<string> }> = [];
    items = items.filter((item) => {
      const normalized = item.headline
        .replace(/[\s\n]+/g, " ")
        .trim()
        .toLowerCase();
      const key = normalized.slice(0, 120);

      const tokenArr = normalized
        .replace(/[^a-z0-9\s]/g, "")
        .split(/\s+/)
        .filter((w) => w.length > 2 && !DEDUP_STOPWORDS.has(w));
      const tokenSet = new Set(tokenArr);

      if (tokenSet.size === 0) {
        if (seenHeadlines.some((s) => s.key === key)) return false;
        seenHeadlines.push({ key, tokens: tokenSet });
        return true;
      }

      for (const seen of seenHeadlines) {
        if (seen.tokens.size === 0) continue;
        let overlap = 0;
        for (const t of tokenSet) {
          if (seen.tokens.has(t)) overlap++;
        }
        const shorter = Math.min(tokenSet.size, seen.tokens.size);
        if (shorter > 0 && overlap / shorter >= 0.7) return false;
      }

      seenHeadlines.push({ key, tokens: tokenSet });
      return true;
    });

    if (preDedup !== items.length) {
      log.info(
        `Headline dedup: ${preDedup} → ${items.length} (removed ${preDedup - items.length})`,
      );
    }

    // [claude-code 2026-04-30] S55: Read-time blocked-host filter. Strips
    // items whose URL points to a blocked publisher even if earlier pipeline
    // stages (normalizeSource, persist, scorer) missed them.
    const integrityResult = filterBlockedAtReadTime(items);
    if (integrityResult.dropped > 0) {
      log.warn(
        `[FeedIntegrity] Dropped ${integrityResult.dropped} items with blocked publisher hosts: ${integrityResult.blockedHosts.join(", ")}`,
      );
      items = integrityResult.clean;
    }

    // Apply pagination (offset + limit)
    const limit = Math.min(filters?.limit ?? MAX_FEED_ITEMS, MAX_FEED_ITEMS);
    const offset = filters?.offset ?? 0;
    const paginatedItems = items.slice(offset, offset + limit);

    const response = {
      items: paginatedItems,
      total: items.length,
      hasMore: offset + limit < items.length,
      nextCursor:
        offset + limit < items.length ? String(offset + limit) : undefined,
      fetchedAt: new Date().toISOString(),
    };

    log.info(
      ` getFeed returning: ${response.items.length} items (total: ${response.total}, hasMore: ${response.hasMore})`,
    );
    return response;
  } catch (error) {
    log.error("getFeed error", {
      userId,
      error: String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
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

// [claude-code 2026-04-19] S25: single-item lookup by id for the mobile DetailSheet.
//   In-memory cache first, then scored DB fallback. Returns null when unknown (expired
//   out of cache + not persisted) so the client renders an empty state.
export async function getItemById(id: string): Promise<FeedItem | null> {
  if (!id) return null;
  const cached = feedCache?.find((i) => i.id === id);
  if (cached) return cached;

  // DB fallback — read scored items (central-scorer writes here) and find matching tweet_id.
  if (isSupabaseConfigured()) {
    try {
      const rows = await readScoredItems({ limit: 500 });
      const match = rows.find(
        (r: ScoredRiskFlowItem) =>
          r.tweet_id === id || (r as unknown as { id?: string }).id === id,
      );
      if (match) return scoredToFeedItem(match);
    } catch {
      /* fall through to null */
    }
  }
  return null;
}

// [claude-code 2026-04-05] Feed health snapshot for Harper monitoring hook
export function getFeedHealth(): {
  cacheSize: number;
  cacheAgeMs: number;
  oldestItemAge: string | null;
  newestItemAge: string | null;
} {
  const now = Date.now();
  const items = feedCache ?? [];
  const sorted =
    items.length > 0
      ? items
          .map((i) => new Date(i.publishedAt).getTime())
          .sort((a, b) => b - a)
      : [];
  return {
    cacheSize: items.length,
    cacheAgeMs: lastCacheRefreshMs ? now - lastCacheRefreshMs : -1,
    oldestItemAge:
      sorted.length > 0
        ? new Date(sorted[sorted.length - 1]).toISOString()
        : null,
    newestItemAge: sorted.length > 0 ? new Date(sorted[0]).toISOString() : null,
  };
}

// Non-blocking module warm-up so cache can populate ahead of first poll cycle.
void warmCacheFromDB();
