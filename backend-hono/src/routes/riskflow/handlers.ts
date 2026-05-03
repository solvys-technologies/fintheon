/**
 * RiskFlow Handlers
 * Request handlers for RiskFlow endpoints
 */

// [claude-code 2026-04-12] RiskFlow catchup sequence: when user resumes, score backlog + refresh cache + trigger poll
// [claude-code 2026-03-31] Owner-gated X polling: only POLL_OWNER_ID can trigger Rettiwt fetch; all users get DB reads + rescore
// [claude-code 2026-03-31] Refresh now triggers Central Scorer immediately (fetch→score→deliver in one call)
// [claude-code 2026-03-29] S9-T2b: Wire instrument-aware sentiment flipper into feed handler, fix spread ordering, fire-and-forget instrument_scores writes
// [claude-code 2026-03-10] Added handleGetSources for RiskFlow connection status indicators
// [claude-code 2026-03-10] handlePreload: lowered minMacroLevel 3→2 (Medium+ threshold)
import type { Context } from "hono";
import * as feedService from "../../services/riskflow/feed-service.js";
import * as watchlistService from "../../services/riskflow/watchlist-service.js";
import * as watchlistPhrasesService from "../../services/riskflow/watchlist-phrases-service.js";
import {
  addClient,
  removeClient,
} from "../../services/riskflow/sse-broadcaster.js";
import { corsConfig } from "../../config/cors.js";
import type {
  FeedFilters,
  WatchlistUpdateRequest,
  NewsSource,
  MacroLevel,
} from "../../types/riskflow.js";
import { isSupabaseConfigured } from "../../config/supabase.js";
import { writeInstrumentScores } from "../../services/supabase-service.js";
// isRettiwtAvailable replaced by pool-based check in handleGetSources
import {
  forcePoll,
  setPollingToggle,
  getPollingToggle,
  isPollingActive,
} from "../../services/riskflow/feed-poller.js";
import { getPollingConfig } from "../../services/riskflow/polling-config.js";
import {
  fetchVIX,
  getVIXSpikeAdjustment,
  getVIXScoringMultiplier,
  getVIXBaseline,
  VIX_FALLBACK,
} from "../../services/vix-service.js";
import {
  calculateIVScoreV2,
  classifyEventType,
  calculateImpliedPoints,
  getCurrentSession,
  getInstrumentConfig,
  getSupportedInstruments,
  getInstrumentSentiment,
  INSTRUMENT_BETAS,
  type StackedEvent,
} from "../../services/iv-scoring/index.js";
import { estimatePoints } from "../../services/market-data/point-estimator.js";
import {
  generateNoteForItem,
  generateNoteForItemDetailed,
} from "../../services/riskflow/agent-notes.js";
import { getSupabaseClient } from "../../config/supabase.js";
import { scoringCycle } from "../../services/riskflow/central-scorer.js";
import { seedCacheFromDb } from "../../services/riskflow/feed-service.js";

/**
 * Internal function to trigger feed pre-fetching
 * This is called by the cron job endpoint
 */
async function preFetchFeed(): Promise<{
  success: boolean;
  itemsFetched: number;
  error?: string;
}> {
  try {
    // Force a fresh fetch by calling getFeed with a dummy userId
    // This will trigger the X API fetch and database storage
    const result = await feedService.getFeed("cron-job", { limit: 50 });
    return {
      success: true,
      itemsFetched: result.items.length,
    };
  } catch (error) {
    console.error("[RiskFlow] Pre-fetch error:", error);
    return {
      success: false,
      itemsFetched: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * GET /api/riskflow/feed
 * Get news feed with optional filters
 */
export async function handleGetFeed(c: Context) {
  const userId = c.get("userId") as string | undefined;

  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    // Parse query parameters
    const filters: FeedFilters = {};

    const sources = c.req.query("sources");
    if (sources) {
      filters.sources = sources.split(",") as NewsSource[];
    }

    const symbols = c.req.query("symbols");
    if (symbols) {
      filters.symbols = symbols.split(",");
    }

    const tags = c.req.query("tags");
    if (tags) {
      filters.tags = tags.split(",");
    }

    const breakingOnly = c.req.query("breaking");
    if (breakingOnly === "true") {
      filters.breakingOnly = true;
    }

    const limit = c.req.query("limit");
    if (limit) {
      filters.limit = parseInt(limit, 10);
    }

    const offset = c.req.query("offset");
    if (offset) {
      filters.offset = parseInt(offset, 10);
    }

    // Allow override of minMacroLevel via query param (for debugging/fallback)
    const minMacroLevel = c.req.query("minMacroLevel");
    if (minMacroLevel) {
      const level = parseInt(minMacroLevel, 10);
      if (level >= 1 && level <= 4) {
        filters.minMacroLevel = level as MacroLevel;
      }
    }

    // Instrument for point estimation (from user's selected instrument)
    const instrument = c.req.query("instrument") || "/ES";

    console.log(
      `[RiskFlow] handleGetFeed called for user ${userId} (instrument=${instrument}) with filters:`,
      JSON.stringify(filters),
    );

    const feed = await feedService.getFeed(userId, filters);

    // Log feed response for debugging
    console.log(
      `[RiskFlow] Feed response for user ${userId}: ${feed.items.length} items (total: ${feed.total}, hasMore: ${feed.hasMore})`,
    );
    if (feed.items.length === 0) {
      console.warn(
        `[RiskFlow] Empty feed returned - check database cache and filters`,
      );
    }

    // Re-compute priceBrainScore for the user's selected instrument
    // Items are cached with /ES default — we re-estimate points per-request
    let vixLevel = VIX_FALLBACK; // [claude-code 2026-04-18] C1 unified fallback
    try {
      const vixData = await fetchVIX();
      vixLevel = vixData.level;
    } catch {
      /* use fallback */
    }

    // S9-T2b: Flip sentiment per instrument at serve-time
    const sentimentMap: Record<string, "bullish" | "bearish"> = {
      bullish: "bullish",
      bearish: "bearish",
    };
    const capMap: Record<string, string> = {
      bullish: "Bullish",
      bearish: "Bearish",
    };

    const items = (feed.items || []).map((item: any) => {
      // Resolve equity-centric sentiment (lowercase)
      const equitySentiment: "bullish" | "bearish" =
        sentimentMap[item.sentiment] ??
        sentimentMap[item.priceBrainScore?.sentiment?.toLowerCase()] ??
        "bearish";

      // Flip for target instrument
      const flipped = getInstrumentSentiment(
        equitySentiment,
        item.headline ?? "",
        instrument,
        item.riskType ?? null,
      );

      if (item.ivScore != null && item.ivScore >= 2) {
        const pts = estimatePoints(item.ivScore, vixLevel, instrument);
        return {
          ...item,
          priceBrainScore: {
            ...item.priceBrainScore,
            sentiment: capMap[flipped] ?? "Bearish",
            classification: item.priceBrainScore?.classification ?? "Neutral",
            impliedPoints: pts.scaledPoints,
            instrument,
          },
        };
      }
      // For items without ivScore, still flip sentiment and set instrument
      if (item.priceBrainScore) {
        return {
          ...item,
          priceBrainScore: {
            ...item.priceBrainScore,
            sentiment: capMap[flipped] ?? "Bearish",
            instrument,
          },
        };
      }
      return item;
    });

    // Enrich items with narrative thread assignments from narrative_card_links
    const sb = getSupabaseClient();
    if (sb && items.length > 0) {
      try {
        const itemIds = items.map((i: any) => i.id).filter(Boolean);
        const { data: links } = await sb
          .from("narrative_card_links")
          .select("card_id, thread_slug")
          .in("card_id", itemIds);

        if (links && links.length > 0) {
          const threadMap = new Map<string, string[]>();
          for (const link of links) {
            const arr = threadMap.get(link.card_id) ?? [];
            arr.push(link.thread_slug);
            threadMap.set(link.card_id, arr);
          }
          for (const item of items) {
            (item as any).narrativeThreads =
              threadMap.get((item as any).id) ?? [];
          }
        }
      } catch (err) {
        console.warn(
          "[RiskFlow] Failed to enrich narrative threads (non-blocking):",
          err,
        );
      }
    }

    // Ensure we always return a valid FeedResponse structure
    const response = {
      items,
      total: feed.total || 0,
      hasMore: feed.hasMore || false,
      fetchedAt: feed.fetchedAt || new Date().toISOString(),
      ...(feed.nextCursor && { nextCursor: feed.nextCursor }),
    };

    // S9-T2b: Fire-and-forget — persist instrument scores to Supabase for historical analysis
    // Does NOT block the response. Failures are logged but do not affect the user.
    if (instrument !== "/ES") {
      const scoresToWrite = items
        .filter((it: any) => it.priceBrainScore?.sentiment && it.tweet_id)
        .map((it: any) => ({
          tweet_id: it.tweet_id as string,
          instrument,
          sentiment: it.priceBrainScore.sentiment as string,
          impliedPoints: (it.priceBrainScore.impliedPoints as number) ?? 0,
        }));
      if (scoresToWrite.length > 0) {
        writeInstrumentScores(scoresToWrite).catch((err) =>
          console.error(
            "[RiskFlow] instrument_scores write failed (non-blocking):",
            err,
          ),
        );
      }
    }

    console.log(
      `[RiskFlow] Returning response with ${response.items.length} items`,
    );
    return c.json(response);
  } catch (error) {
    console.error("[RiskFlow] Feed error:", error);
    console.error(
      "[RiskFlow] Error stack:",
      error instanceof Error ? error.stack : "No stack",
    );
    // Return empty response structure instead of error to prevent frontend crashes
    return c.json(
      {
        items: [],
        total: 0,
        hasMore: false,
        fetchedAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Failed to fetch feed",
      },
      500,
    );
  }
}

/**
 * GET /api/riskflow/breaking
 * Get breaking news only
 */
export async function handleGetBreaking(c: Context) {
  const userId = c.get("userId") as string | undefined;

  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const feed = await feedService.getBreakingNews(userId);
    return c.json(feed);
  } catch (error) {
    console.error("[RiskFlow] Breaking news error:", error);
    return c.json({ error: "Failed to fetch breaking news" }, 500);
  }
}

/**
 * GET /api/riskflow/preload
 * Pre-load 15 tweets from last 48 hours, level 2+ only
 */
export async function handlePreload(c: Context) {
  const userId = c.get("userId") as string | undefined;

  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const feed = await feedService.getFeed(userId, {
      limit: 15,
      minMacroLevel: 2,
    });
    return c.json({
      ...feed,
      preloaded: true,
      timeWindow: "48h",
    });
  } catch (error) {
    console.error("[RiskFlow] Preload error:", error);
    return c.json({ error: "Failed to preload feed" }, 500);
  }
}

/**
 * GET /api/riskflow/watchlist
 * Get user watchlist
 */
export async function handleGetWatchlist(c: Context) {
  const userId = c.get("userId") as string | undefined;

  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const watchlist = watchlistService.getWatchlist(userId);
  return c.json({ watchlist, success: true });
}

/**
 * POST /api/riskflow/watchlist
 * Update user watchlist
 */
export async function handleUpdateWatchlist(c: Context) {
  const userId = c.get("userId") as string | undefined;

  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const body = await c.req.json<WatchlistUpdateRequest>().catch(() => ({}));
    const watchlist = watchlistService.updateWatchlist(userId, body);
    return c.json({ watchlist, success: true });
  } catch (error) {
    console.error("[RiskFlow] Watchlist update error:", error);
    return c.json({ error: "Failed to update watchlist" }, 500);
  }
}

/**
 * POST /api/riskflow/watchlist/symbols
 * Add symbols to watchlist
 */
export async function handleAddSymbols(c: Context) {
  const userId = c.get("userId") as string | undefined;

  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const body = await c.req
      .json<{ symbols: string[] }>()
      .catch(() => ({ symbols: [] }));

    if (!body.symbols?.length) {
      return c.json({ error: "Symbols array is required" }, 400);
    }

    const watchlist = watchlistService.addSymbols(userId, body.symbols);
    return c.json({ watchlist, success: true });
  } catch (error) {
    console.error("[RiskFlow] Add symbols error:", error);
    return c.json({ error: "Failed to add symbols" }, 500);
  }
}

/**
 * DELETE /api/riskflow/watchlist/symbols
 * Remove symbols from watchlist
 */
export async function handleRemoveSymbols(c: Context) {
  const userId = c.get("userId") as string | undefined;

  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const body = await c.req
      .json<{ symbols: string[] }>()
      .catch(() => ({ symbols: [] }));

    if (!body.symbols?.length) {
      return c.json({ error: "Symbols array is required" }, 400);
    }

    const watchlist = watchlistService.removeSymbols(userId, body.symbols);
    return c.json({ watchlist, success: true });
  } catch (error) {
    console.error("[RiskFlow] Remove symbols error:", error);
    return c.json({ error: "Failed to remove symbols" }, 500);
  }
}

/**
 * GET /api/riskflow/stream
 * SSE stream for Level 4 alerts
 * Note: EventSource doesn't support custom headers, so auth token is passed via query param
 */
export async function handleBreakingStream(c: Context) {
  const userId = c.get("userId") || "anonymous";
  console.log(`[SSE] New connection from user: ${userId}`);

  let heartbeatId: ReturnType<typeof setInterval> | null = null;

  // Get origin from request for CORS
  const origin = c.req.header("origin") || c.req.header("Origin");
  // Determine allowed origin from corsConfig (supports string | string[] | function)
  const allowedOrigin = await (async () => {
    const cfg: any = corsConfig.origin;
    if (!origin) return "*";
    if (typeof cfg === "function") {
      return (await cfg(origin)) || "*";
    }
    if (Array.isArray(cfg)) {
      return cfg.includes(origin) ? origin : cfg[0] || "*";
    }
    if (typeof cfg === "string") {
      return cfg === "*" ? "*" : cfg === origin ? origin : "*";
    }
    return "*";
  })();

  const stream = new ReadableStream({
    start(controller) {
      console.log(`[SSE] Stream started for user: ${userId}`);
      addClient(controller, userId);

      // Send initial connection message to confirm stream is working
      try {
        controller.enqueue(new TextEncoder().encode(": connected\n\n"));
      } catch (error) {
        console.error("[SSE] Failed to send initial message", error);
      }

      heartbeatId = setInterval(() => {
        try {
          controller.enqueue(new TextEncoder().encode(": heartbeat\n\n"));
        } catch (error) {
          console.warn("[SSE] Heartbeat failed, closing stream", error);
          heartbeatId && clearInterval(heartbeatId);
          removeClient(controller);
        }
      }, 30000);
    },
    cancel(controller) {
      console.log(`[SSE] Stream cancelled for user: ${userId}`);
      if (heartbeatId) {
        clearInterval(heartbeatId);
      }
      removeClient(controller);
    },
  });

  // Set CORS headers on context first (Hono will merge with response headers)
  c.header("Content-Type", "text/event-stream");
  c.header("Cache-Control", "no-cache");
  c.header("Connection", "keep-alive");
  c.header("Access-Control-Allow-Origin", allowedOrigin);
  c.header("Access-Control-Allow-Credentials", "true");
  c.header("Access-Control-Allow-Headers", "Cache-Control");
  c.header("X-Accel-Buffering", "no"); // Disable buffering in nginx/proxy

  console.log(
    `[SSE] Returning SSE response for user: ${userId}, origin: ${origin}`,
  );

  // Return the stream response - Hono will handle it correctly
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": allowedOrigin,
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Headers": "Cache-Control",
      "X-Accel-Buffering": "no",
    },
  });
}

/**
 * GET /api/riskflow/debug
 * Debug endpoint to check database state
 * Query params:
 *   - limit: Number of items to return (default: 5, max: 100)
 *   - all: If true, return all items (respects limit)
 */
export async function handleDebug(c: Context) {
  const userId = c.get("userId") as string | undefined;
  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const { sql, isDatabaseAvailable } =
      await import("../../config/database.js");

    if (!isDatabaseAvailable() || !sql) {
      return c.json({ error: "Database not available" }, 503);
    }

    const limitParam = c.req.query("limit");
    const limit = limitParam ? Math.min(parseInt(limitParam, 10), 100) : 5;
    const showAll = c.req.query("all") === "true";

    // Get raw counts
    const totalCount = await sql`SELECT COUNT(*) as count FROM news_feed_items`;
    const recentCount = await sql`
      SELECT COUNT(*) as count FROM news_feed_items 
      WHERE published_at >= NOW() - INTERVAL '48 hours'
    `;
    const level3Count = await sql`
      SELECT COUNT(*) as count FROM news_feed_items 
      WHERE published_at >= NOW() - INTERVAL '48 hours' 
        AND (macro_level IS NULL OR macro_level >= 3)
    `;
    const level4Count = await sql`
      SELECT COUNT(*) as count FROM news_feed_items 
      WHERE published_at >= NOW() - INTERVAL '48 hours' 
        AND macro_level = 4
    `;

    // Get items with full details
    const itemsQuery = showAll
      ? sql`
          SELECT 
            id, headline, source, macro_level, published_at, is_breaking,
            sentiment, iv_score, urgency, symbols, tags, body
          FROM news_feed_items
          ORDER BY published_at DESC
          LIMIT ${limit}
        `
      : sql`
          SELECT 
            id, headline, source, macro_level, published_at, is_breaking,
            sentiment, iv_score, urgency, symbols, tags
          FROM news_feed_items
          ORDER BY published_at DESC
          LIMIT ${limit}
        `;

    const items = await itemsQuery;

    // Get breakdown by source
    const sourceBreakdown = await sql`
      SELECT source, COUNT(*) as count
      FROM news_feed_items
      WHERE published_at >= NOW() - INTERVAL '48 hours'
      GROUP BY source
      ORDER BY count DESC
    `;

    // Get breakdown by macro level
    const levelBreakdown = await sql`
      SELECT 
        COALESCE(macro_level::text, 'NULL') as level,
        COUNT(*) as count
      FROM news_feed_items
      WHERE published_at >= NOW() - INTERVAL '48 hours'
      GROUP BY macro_level
      ORDER BY macro_level DESC NULLS LAST
    `;

    return c.json({
      database: {
        total: Number(totalCount[0]?.count ?? 0),
        recent48h: Number(recentCount[0]?.count ?? 0),
        level3Plus: Number(level3Count[0]?.count ?? 0),
        level4: Number(level4Count[0]?.count ?? 0),
      },
      breakdown: {
        bySource: sourceBreakdown.map((row: any) => ({
          source: row.source,
          count: Number(row.count),
        })),
        byLevel: levelBreakdown.map((row: any) => ({
          level: row.level,
          count: Number(row.count),
        })),
      },
      items: items.map((item: any) => ({
        id: item.id,
        headline: item.headline,
        source: item.source,
        macroLevel: item.macro_level,
        isBreaking: item.is_breaking,
        sentiment: item.sentiment,
        ivScore: item.iv_score,
        urgency: item.urgency,
        symbols: item.symbols,
        tags: item.tags,
        publishedAt: item.published_at,
        ...(showAll && { body: item.body }),
      })),
      env: {
        nodeEnv: process.env.NODE_ENV,
      },
      query: {
        limit,
        showAll,
      },
    });
  } catch (error) {
    console.error("[RiskFlow] Debug error:", error);
    return c.json(
      { error: error instanceof Error ? error.message : "Debug failed" },
      500,
    );
  }
}

/**
 * POST /api/riskflow/cron/prefetch
 * Cron job endpoint to pre-fetch and store news items
 * Protected by CRON_SECRET_TOKEN environment variable
 */
export async function handleCronPrefetch(c: Context) {
  // Verify cron secret token
  const providedToken = c.req.header("X-Cron-Secret") || c.req.query("token");
  const expectedToken = process.env.CRON_SECRET_TOKEN;

  if (!expectedToken) {
    console.warn("[RiskFlow] CRON_SECRET_TOKEN not configured");
    return c.json({ error: "Cron job not configured" }, 500);
  }

  if (providedToken !== expectedToken) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const result = await preFetchFeed();

  // [claude-code 2026-03-27] Cleanup disabled — items retained for calibration DB

  const statusCode = result.success ? 200 : 500;
  return c.json(result, statusCode);
}

/**
 * GET /api/riskflow/iv-aggregate
 * Get aggregated IV score based on recent news and VIX
 * Query params:
 *   - instrument: User's selected instrument (default: /ES)
 *   - price: Current price of the instrument (optional, for points calc)
 */
export async function handleGetIVAggregate(c: Context) {
  const userId = c.get("userId") as string | undefined;

  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    // Get query params
    const instrument = c.req.query("instrument") || "/ES";
    const priceParam = c.req.query("price");

    // Get instrument config from the scoring engine (includes default prices)
    const instrumentConfig = getInstrumentConfig(instrument);

    // Use provided price or fallback to config price or 6000
    const currentPrice = priceParam
      ? parseFloat(priceParam)
      : (instrumentConfig?.currentPrice ?? 6000);

    // Fetch current VIX
    const vixData = await fetchVIX();
    console.log(
      `[IV Aggregate] VIX: ${vixData.level}, spike: ${vixData.isSpike}, stale: ${vixData.staleMinutes}min`,
    );

    // Get recent news items from database (last 2 hours)
    const { sql, isDatabaseAvailable } =
      await import("../../config/database.js");

    let events: StackedEvent[] = [];

    if (isDatabaseAvailable() && sql) {
      const recentItems = await sql`
        SELECT headline, source, macro_level, iv_score, published_at, is_breaking
        FROM news_feed_items
        WHERE published_at >= NOW() - INTERVAL '2 hours'
          AND macro_level >= 2
        ORDER BY published_at DESC
        LIMIT 20
      `;

      // Convert to StackedEvent format
      events = recentItems.map((item: any) => {
        // Create a pseudo-parsed headline for classification
        const parsed = {
          raw: item.headline,
          eventType: null,
          isBreaking: item.is_breaking,
        };

        const eventType = classifyEventType(parsed as any);
        const baseScore = item.iv_score || 3;

        return {
          eventType,
          baseScore,
          timestamp: new Date(item.published_at),
        };
      });

      console.log(`[IV Aggregate] Found ${events.length} recent events`);
    }

    // Check if it's earnings season or FOMC week (simplified detection)
    const now = new Date();
    const dayOfWeek = now.getDay();
    const dayOfMonth = now.getDate();

    // FOMC typically meets 8 times a year, often mid-month Tue-Wed
    const isFOMCWeek =
      dayOfWeek >= 1 && dayOfWeek <= 3 && dayOfMonth >= 10 && dayOfMonth <= 20;

    // Earnings season: ~2 weeks after quarter end (mid-Jan, mid-Apr, mid-Jul, mid-Oct)
    const month = now.getMonth();
    const isEarningsSeason =
      [0, 3, 6, 9].includes(month) && dayOfMonth >= 10 && dayOfMonth <= 28;

    // Calculate IV score using the v2 engine
    const result = calculateIVScoreV2({
      events,
      vixLevel: vixData.level,
      previousVixLevel: vixData.previousLevel,
      vixUpdateMinutes: vixData.staleMinutes,
      currentPrice,
      instrument,
      isMarketClosed: false, // TODO: Detect market hours
      isEarningsSeason,
      isFOMCWeek,
      previousSessionScore: 0, // TODO: Store and retrieve previous session
    });

    // Get additional VIX context
    const vixMultiplierInfo = getVIXScoringMultiplier(vixData.level);
    const spikeAdjustment = getVIXSpikeAdjustment(vixData);

    return c.json({
      score: result.score,
      impliedPoints: result.impliedPoints,
      session: {
        name: result.session.name,
        multiplier: result.session.multiplier,
      },
      vix: {
        level: vixData.level,
        percentChange: vixData.percentChange,
        isSpike: vixData.isSpike,
        spikeDirection: vixData.spikeDirection,
        multiplier: result.vixMultiplier,
        context: result.vixContext,
        staleMinutes: vixData.staleMinutes,
      },
      activity: {
        eventCount: result.stackedEvents,
        synergy: result.synergy,
        baseline: result.activityBaseline,
        isEarningsSeason,
        isFOMCWeek,
      },
      rationale: result.rationale,
      alert: result.alert,
      instrument,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[IV Aggregate] Error:", error);
    return c.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to calculate IV score",
      },
      500,
    );
  }
}

/**
 * POST /api/riskflow/refresh
 * Manually trigger a feed poll cycle, rescore with current weights,
 * and auto-generate agent notes for critical items.
 * [claude-code 2026-03-27] S3: Full refresh = poll + score + auto-notes
 */
export async function handleRefresh(c: Context) {
  const userId = c.get("userId") as string | undefined;
  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  // Only the owner can trigger X polling. Match by email (Google sign-in) or userId.
  // All other users still get rescore + agent notes, just no fresh Rettiwt fetch.
  const ownerEmail =
    process.env.POLL_OWNER_EMAIL || "pricedinresearch@gmail.com";
  const ownerId = process.env.POLL_OWNER_ID || "local-user";
  const email = c.get("email") as string | undefined;
  const isOwner =
    email === ownerEmail || userId === ownerId || userId === "local-user";

  try {
    let polled = false;
    let exaFallbackRan = false;

    // 1. Primary: Twitter CLI poll — OWNER ONLY
    if (isOwner) {
      await forcePoll();
      polled = true;
    }

    // 1b. If Rettiwt is rate-limited (or not owner), run scrape fallback
    const { isRettiwtRateLimited: isRateLimited } =
      await import("../../services/riskflow/econ-rettiwt-poller.js");
    const { runScrapeFallback } =
      await import("../../services/riskflow/feed-poller.js");
    if (isRateLimited() || !polled) {
      await runScrapeFallback();
      exaFallbackRan = true;
    }

    // 1c. Run commentary scraper. Exa scheduled-event scraper stripped in
    // v5.33.2 per TP — Exa is off platform-wide.
    const { pollCommentary } =
      await import("../../services/riskflow/commentary-scraper.js");
    await pollCommentary().catch((err: unknown) => {
      console.warn("[RiskFlow] Commentary scrape failed during refresh:", err);
    });

    // 2. Run Central Scorer immediately so raw items get scored NOW, not in 30s
    const { scoringCycle } =
      await import("../../services/riskflow/central-scorer.js");
    await scoringCycle().catch((err: unknown) => {
      console.warn("[RiskFlow] Immediate scoring during refresh failed:", err);
    });

    // 3. Re-score in-memory feed with current regime/calibration weights
    const { rescoreInMemoryFeed } =
      await import("../../services/riskflow/feed-service.js");
    const rescored = await rescoreInMemoryFeed().catch((err: unknown) => {
      console.warn("[RiskFlow] Rescore during refresh failed:", err);
      return 0;
    });

    // 4. Auto-generate agent notes for critical items (fire-and-forget)
    import("../../services/riskflow/agent-notes.js").then(
      ({ generateNotesForCriticalItems }) => {
        generateNotesForCriticalItems().catch((err: unknown) => {
          console.warn("[RiskFlow] Auto-notes during refresh failed:", err);
        });
      },
    );

    return c.json({
      success: true,
      polled,
      exaFallbackRan,
      rescored,
      refreshedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[RiskFlow] Refresh error:", error);
    return c.json({ error: "Refresh failed" }, 500);
  }
}

/** POST /api/riskflow/:id/generate-note — manual agent note generation trigger
 *  [claude-code 2026-04-25] S38: When body carries `instrument`, returns the structured
 *  detailed note (source_url + summary + direction). Without an instrument, falls back to
 *  the legacy plain-text path so cron and older callers stay working.
 */
export async function handleGenerateNote(c: Context) {
  try {
    const itemId = c.req.param("id");
    if (!itemId) return c.json({ error: "Missing item ID" }, 400);

    let body: { instrument?: string } = {};
    try {
      body = await c.req.json<{ instrument?: string }>();
    } catch {
      /* no body — legacy path */
    }

    if (body && typeof body.instrument === "string" && body.instrument.trim()) {
      const detailed = await generateNoteForItemDetailed(
        itemId,
        body.instrument,
      );
      if (!detailed)
        return c.json({ error: "Item not found or generation failed" }, 404);
      return c.json(detailed);
    }

    const note = await generateNoteForItem(itemId);
    if (!note)
      return c.json({ error: "Item not found or generation failed" }, 404);

    return c.json({ note });
  } catch (err) {
    console.error("[RiskFlow] Generate note error:", err);
    return c.json({ error: "Failed to generate note" }, 500);
  }
}

/**
 * POST /api/riskflow/rescore
 * Re-processes current cached feed items with current regime/calibration weights.
 * Returns the number of items rescored and the updated items.
 */
export async function handleRescore(c: Context) {
  const userId = c.get("userId") as string | undefined;
  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    // Re-enrich in-memory feed cache with current regime/calibration/commentator weights
    const { rescoreInMemoryFeed } =
      await import("../../services/riskflow/feed-service.js");
    const rescored = await rescoreInMemoryFeed();
    return c.json({
      success: true,
      rescored,
      rescoredAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[RiskFlow] Rescore error:", error);
    return c.json(
      { error: error instanceof Error ? error.message : "Rescore failed" },
      500,
    );
  }
}

/**
 * POST /api/riskflow/rescore-all
 * Super-admin only. One-shot V4 rescore of every scored_riskflow_items row.
 * Idempotent: rejects if a run is already in progress.
 * Query params: dryRun=true for read-only sample, limit=N to bound the run.
 */
// [claude-code 2026-04-19] S24-T3: rescore-all migration job behind super-admin gate
export async function handleRescoreAll(c: Context) {
  const userId = c.get("userId") as string | undefined;
  if (!userId) return c.json({ error: "Unauthorized" }, 401);

  const { getUserById } = await import("../../services/peers/peer-registry.js");
  const user = await getUserById(userId);
  if (!user || user.role !== "admin") {
    return c.json({ error: "Super admin privileges required" }, 403);
  }

  const dryRun = c.req.query("dryRun") === "true";
  const limitParam = c.req.query("limit");
  const limit = limitParam ? Math.max(1, parseInt(limitParam, 10) || 0) : null;

  const { runRescoreAll, isRescoreInProgress } =
    await import("../../services/scoring/rescore-all.js");
  if (isRescoreInProgress()) {
    return c.json({ error: "rescore-all already in progress" }, 409);
  }

  try {
    const stats = await runRescoreAll({ dryRun, limit });
    return c.json({ success: true, stats });
  } catch (error) {
    console.error("[RiskFlow] rescore-all error:", error);
    return c.json(
      {
        error: error instanceof Error ? error.message : "rescore-all failed",
      },
      500,
    );
  }
}

/** POST /api/riskflow/:id/not-relevant — remove item + log for learning */
// [claude-code 2026-04-15] S16-T5: Accept optional reason field for dismissal feedback loop
export async function handleNotRelevant(c: Context) {
  // [claude-code 2026-04-13] Defensive: strip frontend "backend-" prefix if it leaks through
  const tweetId = c.req.param("id")?.replace(/^backend-/, "") ?? "";
  if (!tweetId) return c.json({ error: "id is required" }, 400);

  try {
    // Parse optional reason from request body
    let reason: string | undefined;
    try {
      const body = await c.req.json();
      reason = typeof body.reason === "string" ? body.reason : undefined;
    } catch {
      // No body or invalid JSON — reason stays undefined (backward compatible)
    }

    const { getSupabaseClient } = await import("../../config/supabase.js");
    const sb = getSupabaseClient();
    if (!sb) return c.json({ error: "Database unavailable" }, 503);

    // [claude-code 2026-04-13] Fixed: scored_riskflow_items has scored_by, not submitted_by.
    // Fetch from scored table first, fall back to raw for submitted_by.
    const { data: scored } = await sb
      .from("scored_riskflow_items")
      .select("headline, source, tags, scored_by")
      .eq("tweet_id", tweetId)
      .single();

    // Also check raw table for submitted_by (original ingestion source)
    const { data: raw } = await sb
      .from("raw_riskflow_items")
      .select("submitted_by, headline")
      .eq("tweet_id", tweetId)
      .single();

    const headline = scored?.headline ?? raw?.headline ?? null;
    const source = scored?.source ?? "unknown";
    const submittedBy = raw?.submitted_by ?? scored?.scored_by ?? "unknown";

    // Log dismissal for learning (append to content guard patterns over time)
    if (headline) {
      await sb.from("riskflow_dismissed_items").insert({
        tweet_id: tweetId,
        headline,
        source,
        submitted_by: submittedBy,
        dismissed_at: new Date().toISOString(),
        ...(reason ? { reason } : {}),
      });
    }

    // Delete from both tables
    await sb.from("scored_riskflow_items").delete().eq("tweet_id", tweetId);
    await sb.from("raw_riskflow_items").delete().eq("tweet_id", tweetId);

    // Enqueue Hermes feed-quality review task so dismissed patterns inform future scoring
    try {
      const { enqueueTask } =
        await import("../../services/harper-autonomous/loop-manager.js");
      enqueueTask({
        type: "feed-quality-feedback",
        payload: {
          dismissedId: tweetId,
          headline: headline ?? "(unknown)",
          source,
          submittedBy,
          reason: reason ?? null,
        },
        priority: "normal",
      });
    } catch {
      // Harper loop may not be running — that's fine
    }

    return c.json({ ok: true, removed: tweetId, reason: reason ?? null });
  } catch (err) {
    return c.json({ error: String(err) }, 500);
  }
}

/** GET /api/riskflow/sources — connection status for data source indicators
 * [claude-code 2026-05-01] Retired Rettiwt + Agent Reach. Now reads riskflow_worker_heartbeats
 * from Supabase to surface real-time tier status. X intake is home timeline via persistent browser.
 */
export async function handleGetSources(c: Context) {
  const supabaseUp = isSupabaseConfigured();

  // Read riskflow worker tier status from Supabase heartbeats
  let breakingActive = false;
  let standardActive = false;
  let commentaryActive = false;
  let breakingLastRun: string | null = null;
  let standardLastRun: string | null = null;
  let commentaryLastRun: string | null = null;
  let breakingIngested = 0;
  let standardIngested = 0;
  let commentaryIngested = 0;

  const now = Date.now();
  const STALE_MS = 5 * 60_000;

  try {
    const sb = getSupabaseClient();
    if (sb) {
      const { data } = await sb
        .from("riskflow_worker_heartbeats")
        .select("tier, last_run_at, items_ingested");
      if (data) {
        for (const row of data as Array<{
          tier: string;
          last_run_at: string | null;
          items_ingested: number;
        }>) {
          const lastRunAt = row.last_run_at;
          const active = lastRunAt
            ? now - new Date(lastRunAt).getTime() < STALE_MS
            : false;
          if (row.tier === "breaking") {
            breakingActive = active;
            breakingLastRun = lastRunAt;
            breakingIngested = row.items_ingested ?? 0;
          } else if (row.tier === "standard") {
            standardActive = active;
            standardLastRun = lastRunAt;
            standardIngested = row.items_ingested ?? 0;
          } else if (row.tier === "commentary") {
            commentaryActive = active;
            commentaryLastRun = lastRunAt;
            commentaryIngested = row.items_ingested ?? 0;
          }
        }
      }
    }
  } catch { /* heartbeat read is best-effort */ }

  const xHomeTimeline = breakingActive || standardActive || commentaryActive;
  const hasIngested = breakingIngested + standardIngested + commentaryIngested > 0;

  // Newsfeed health
  const newsfeedHealthy = xHomeTimeline;
  const newsfeedDegraded = !hasIngested && xHomeTimeline;

  const sources = {
    xHomeTimeline: {
      active: xHomeTimeline,
      tiers: {
        breaking: { active: breakingActive, lastRunAt: breakingLastRun, ingested: breakingIngested },
        standard: { active: standardActive, lastRunAt: standardLastRun, ingested: standardIngested },
        commentary: { active: commentaryActive, lastRunAt: commentaryLastRun, ingested: commentaryIngested },
      },
    },
  };

  // method_breakdown — count of items per ingest_pipeline from scored items (last 24h)
  const methodBreakdown = await (async () => {
    try {
      const sb = getSupabaseClient();
      if (!sb) return null;
      const sinceIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data } = await sb
        .from("scored_riskflow_items")
        .select("ingest_pipeline")
        .gte("published_at", sinceIso);
      if (!data) return null;
      const counts: Record<string, number> = {};
      for (const row of data as Array<{ ingest_pipeline: string | null }>) {
        const pipe = row.ingest_pipeline || "unknown";
        counts[pipe] = (counts[pipe] || 0) + 1;
      }
      return counts;
    } catch {
      return null;
    }
  })();

  return c.json({
    supabase: supabaseUp,
    xHomeTimeline,
    newsfeedHealthy,
    newsfeedDegraded,
    sources,
    method_breakdown: methodBreakdown,
    // Legacy compat — remove after frontend migration
    rettiwt: false,
    rettiwtRateLimited: false,
    rettiwtCooldownSec: 0,
    rettiwtPool: { totalKeys: 0, availableKeys: 0, cooldownKeys: 0, disabledKeys: 0 },
    pollingOwner: null,
    activePollers: [],
    xApi: false,
    userPollStats: {},
  });
}

/**
 * POST /api/riskflow/polling-toggle
 * S10-T1c: Enable/disable automatic polling.
 * Body: { enabled: boolean }
 * When disabled, ALL X API calls stop immediately.
 */
export async function handlePollingToggle(c: Context) {
  try {
    const body = await c.req.json<{ enabled?: boolean }>();
    if (typeof body.enabled !== "boolean") {
      return c.json({ error: 'Missing "enabled" boolean field' }, 400);
    }

    setPollingToggle(body.enabled);
    return c.json({ pollingEnabled: getPollingToggle() });
  } catch (err) {
    return c.json({ error: "Invalid request body" }, 400);
  }
}

/**
 * GET /api/riskflow/polling-status
 * Returns current polling state for frontend toggle sync.
 */
export async function handlePollingStatus(c: Context) {
  const { interval, isHotHours } = getPollingConfig();
  const toggleEnabled = getPollingToggle();
  const pollerRunning = isPollingActive();

  return c.json({
    windowActive: true, // polling is 24/7 with dynamic cadence
    isHotHours,
    intervalMs: interval,
    toggleEnabled,
    pollerRunning,
    effectivelyPolling: toggleEnabled && pollerRunning,
  });
}

// ── Per-user X CLI killswitch ─────────────────────────────────────────

import {
  setUserPollingState,
  getActivePollingUsers,
  areAllUsersKilled,
} from "../../services/riskflow/user-polling-registry.js";

/**
 * POST /api/riskflow/user-polling-toggle
 * Toggle per-user X CLI polling killswitch.
 * [claude-code 2026-04-12] When resuming (killed=false), runs catchup sequence:
 * score backlog → refresh feed cache → trigger poll → return recovery stats.
 */
export async function handleUserPollingToggle(c: Context) {
  try {
    const body = await c.req.json<{ userId?: string; killed?: boolean }>();
    if (!body.userId || typeof body.killed !== "boolean") {
      return c.json(
        { error: 'Missing "userId" string and "killed" boolean fields' },
        400,
      );
    }
    setUserPollingState(body.userId, body.killed);

    // If user is resuming (killed=false), run catchup sequence
    if (!body.killed) {
      let scoredCount = 0;
      try {
        // 1. Process any unscored backlog immediately
        scoredCount = await scoringCycle();

        // 2. Refresh the feed cache from DB so frontend gets fresh data
        await seedCacheFromDb();

        // 3. Trigger a poll to pull fresh items (fire-and-forget)
        forcePoll().catch(() => {});
      } catch (err) {
        // Catchup is best-effort — don't fail the toggle
        console.warn("[CatchupSequence] Error during resume catchup:", err);
      }

      return c.json({
        ok: true,
        killed: false,
        catchup: { scored: scoredCount },
      });
    }

    return c.json({ ok: true, killed: body.killed });
  } catch {
    return c.json({ error: "Invalid request body" }, 400);
  }
}

/**
 * GET /api/riskflow/user-polling-status
 * Per-user polling registry status
 */
export async function handleUserPollingStatus(c: Context) {
  return c.json({
    users: getActivePollingUsers(),
    allKilled: areAllUsersKilled(),
  });
}

// ── Doctor: self-service polling diagnostic + repair ──────────────────────
// [claude-code 2026-04-18] S25-T3: single user-facing poll trigger, lives on Team Card.

const doctorCooldowns = new Map<string, number>();
const DOCTOR_COOLDOWN_MS = 60_000; // 60s per user

/**
 * POST /api/riskflow/doctor
 * Per-user self-service: refresh Rettiwt pool, run catchup, trigger Agent Reach tick.
 * Rate-limited to 1 call per 60s per user. Returns stats for toast feedback.
 */
export async function handleDoctor(c: Context) {
  const userId = c.get("userId") as string | undefined;
  if (!userId) return c.json({ error: "Unauthorized" }, 401);

  const now = Date.now();
  const lastCall = doctorCooldowns.get(userId) ?? 0;
  if (now - lastCall < DOCTOR_COOLDOWN_MS) {
    const cooldownSec = Math.ceil(
      (DOCTOR_COOLDOWN_MS - (now - lastCall)) / 1000,
    );
    return c.json(
      {
        ok: false,
        error: "Cooldown active",
        cooldownSec,
      },
      429,
    );
  }
  doctorCooldowns.set(userId, now);

  const { forceRefreshPool } =
    await import("../../services/rettiwt-service.js");
  const {
    setUserPollingState,
    recordUserPollSuccess,
    getUserPollStats,
    recordCookieRefresh,
    getCookieOwner,
  } = await import("../../services/riskflow/user-polling-registry.js");
  const { agentReachTick } =
    await import("../../services/riskflow/agent-reach-poller.js");

  // 1. Reset Rettiwt pool cooldowns + reload keys
  let poolRefreshed = { totalKeys: 0, resetCount: 0 };
  try {
    poolRefreshed = await forceRefreshPool();
  } catch (err) {
    console.warn("[Doctor] forceRefreshPool failed (continuing):", err);
  }

  // 2. Ensure user is not killed
  setUserPollingState(userId, false);

  // 3. S48-T1: Record X cookie refresh for round-robin rotation
  recordCookieRefresh(userId);
  const cookieOwner = getCookieOwner();

  // 4. Catchup: score backlog, seed cache, one Agent Reach tick
  // [claude-code 2026-04-18] S25-T3: intentionally does NOT call forcePoll() — the scheduled
  // feed-poller handles Rettiwt on its own cadence. Letting every user's Doctor click trigger
  // an extra Rettiwt poll would compound rate-limit exposure. Agent Reach is safe to tick here
  // because it's gated by per-domain token buckets, so repeated clicks are no-ops per domain.
  let scored = 0;
  let wroteItems = 0;
  try {
    scored = await scoringCycle();
    await seedCacheFromDb();
    await agentReachTick();
    wroteItems = scored;
  } catch (err) {
    console.warn("[Doctor] catchup sequence error (continuing):", err);
  }

  // 4. Attribute success to this user
  recordUserPollSuccess(userId);

  const stats = getUserPollStats(userId);
  return c.json({
    ok: true,
    scored,
    wroteItems,
    sourcesHealthy: true,
    newLastSuccessAt: stats?.lastSuccessAt ?? null,
    poolRefreshed,
    cookieOwner,
  });
}

/**
 * GET /api/riskflow/phrases
 * Get user's active catalyst watch phrases
 */
export async function handleGetPhrases(c: Context) {
  const userId = c.get("userId") as string | undefined;
  if (!userId) return c.json({ error: "Unauthorized" }, 401);

  const phrases = await watchlistPhrasesService.getUserPhrases(userId);
  return c.json({ phrases });
}

/**
 * POST /api/riskflow/phrases
 * Add a new catalyst watch phrase (bias words auto-stripped)
 */
export async function handleAddPhrase(c: Context) {
  const userId = c.get("userId") as string | undefined;
  if (!userId) return c.json({ error: "Unauthorized" }, 401);

  try {
    const body = await c.req.json<{
      phrase: string;
      matchType?: "contains" | "exact";
      repeating?: boolean;
    }>();

    if (!body.phrase?.trim()) {
      return c.json({ error: "Phrase is required" }, 400);
    }

    const result = await watchlistPhrasesService.addPhrase(userId, body);
    return c.json({
      phrase: result.phrase,
      removedBias: result.removedBias,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to add phrase";
    return c.json({ error: msg }, 400);
  }
}

/**
 * DELETE /api/riskflow/phrases/:id
 * Deactivate a catalyst watch phrase
 */
export async function handleDeletePhrase(c: Context) {
  const userId = c.get("userId") as string | undefined;
  if (!userId) return c.json({ error: "Unauthorized" }, 401);

  const id = parseInt(c.req.param("id"), 10);
  if (isNaN(id)) return c.json({ error: "Invalid phrase ID" }, 400);

  const deleted = await watchlistPhrasesService.deletePhrase(userId, id);
  if (!deleted) return c.json({ error: "Not found" }, 404);
  return c.json({ ok: true });
}

// ── Risk Signals (S16-T3) ─────────────────────────────────────────────────────

export async function handleGetRiskSignals(c: Context) {
  const { getRiskSignals } =
    await import("../../services/riskflow/risk-signal-generator.js");
  const signals = await getRiskSignals();
  return c.json({
    signals,
    generatedAt:
      signals.length > 0 ? signals[0].generatedAt : new Date().toISOString(),
  });
}

// ── Single-item lookup for mobile DetailSheet (S25) ─────────────────────────
/**
 * GET /api/riskflow/items/:id — fetch one FeedItem by id. Used by the mobile
 * catalyst DetailSheet when a push notification is tapped or a card is pressed.
 * Falls back to scored-items DB if the in-memory feed cache has rotated past it.
 */
export async function handleGetItemById(c: Context) {
  const id = c.req.param("id");
  if (!id) return c.json({ error: "itemId required" }, 400);

  const userId = c.get("userId" as never) as string | undefined;
  if (!userId) return c.json({ error: "Unauthorized" }, 401);

  const item = await feedService.getItemById(id);
  if (!item) return c.json({ error: "Item not found" }, 404);

  return c.json({ item });
}
