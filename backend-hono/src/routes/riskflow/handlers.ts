/**
 * RiskFlow Handlers
 * Request handlers for RiskFlow endpoints
 */

// [claude-code 2026-03-10] Added handleGetSources for RiskFlow connection status indicators
// [claude-code 2026-03-10] handlePreload: lowered minMacroLevel 3→2 (Medium+ threshold)
import type { Context } from 'hono';
import * as feedService from '../../services/riskflow/feed-service.js';
import * as watchlistService from '../../services/riskflow/watchlist-service.js';
import { addClient, removeClient } from '../../services/riskflow/sse-broadcaster.js';
import { corsConfig } from '../../config/cors.js';
import type { FeedFilters, WatchlistUpdateRequest, NewsSource, MacroLevel } from '../../types/riskflow.js';
import { isSupabaseConfigured } from '../../config/supabase.js';
import { isTwitterCliInstalled } from '../../services/twitter-cli/index.js';
import { forcePoll } from '../../services/riskflow/feed-poller.js';
import { fetchVIX, getVIXSpikeAdjustment, getVIXScoringMultiplier, getVIXBaseline } from '../../services/vix-service.js';
import {
  calculateIVScoreV2,
  classifyEventType,
  calculateImpliedPoints,
  getCurrentSession,
  getInstrumentConfig,
  getSupportedInstruments,
  INSTRUMENT_BETAS,
  type StackedEvent
} from '../../services/iv-scoring-v2.js';
import { estimatePoints } from '../../services/market-data/point-estimator.js';
import { generateNoteForItem } from '../../services/riskflow/agent-notes.js';

/**
 * Internal function to trigger feed pre-fetching
 * This is called by the cron job endpoint
 */
async function preFetchFeed(): Promise<{ success: boolean; itemsFetched: number; error?: string }> {
  try {
    // Force a fresh fetch by calling getFeed with a dummy userId
    // This will trigger the X API fetch and database storage
    const result = await feedService.getFeed('cron-job', { limit: 50 });
    return {
      success: true,
      itemsFetched: result.items.length,
    };
  } catch (error) {
    console.error('[RiskFlow] Pre-fetch error:', error);
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
  const userId = c.get('userId') as string | undefined;

  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    // Parse query parameters
    const filters: FeedFilters = {};

    const sources = c.req.query('sources');
    if (sources) {
      filters.sources = sources.split(',') as NewsSource[];
    }

    const symbols = c.req.query('symbols');
    if (symbols) {
      filters.symbols = symbols.split(',');
    }

    const tags = c.req.query('tags');
    if (tags) {
      filters.tags = tags.split(',');
    }

    const breakingOnly = c.req.query('breaking');
    if (breakingOnly === 'true') {
      filters.breakingOnly = true;
    }

    const limit = c.req.query('limit');
    if (limit) {
      filters.limit = parseInt(limit, 10);
    }

    const offset = c.req.query('offset');
    if (offset) {
      filters.offset = parseInt(offset, 10);
    }

    // Allow override of minMacroLevel via query param (for debugging/fallback)
    const minMacroLevel = c.req.query('minMacroLevel');
    if (minMacroLevel) {
      const level = parseInt(minMacroLevel, 10);
      if (level >= 1 && level <= 4) {
        filters.minMacroLevel = level as MacroLevel;
      }
    }

    // Instrument for point estimation (from user's selected instrument)
    const instrument = c.req.query('instrument') || '/ES';

    console.log(`[RiskFlow] handleGetFeed called for user ${userId} (instrument=${instrument}) with filters:`, JSON.stringify(filters));

    const feed = await feedService.getFeed(userId, filters);

    // Log feed response for debugging
    console.log(`[RiskFlow] Feed response for user ${userId}: ${feed.items.length} items (total: ${feed.total}, hasMore: ${feed.hasMore})`);
    if (feed.items.length === 0) {
      console.warn(`[RiskFlow] Empty feed returned - check database cache and filters`);
    }

    // Re-compute priceBrainScore for the user's selected instrument
    // Items are cached with /ES default — we re-estimate points per-request
    let vixLevel = 16; // fallback
    try {
      const vixData = await fetchVIX();
      vixLevel = vixData.level;
    } catch { /* use fallback */ }

    const items = (feed.items || []).map((item: any) => {
      if (item.ivScore != null && item.ivScore >= 2) {
        const pts = estimatePoints(item.ivScore, vixLevel, instrument);
        // Derive sentiment from item.sentiment if priceBrainScore is missing (DB-cached items)
        const sentimentMap: Record<string, string> = { bullish: 'Bullish', bearish: 'Bearish', neutral: 'Neutral' };
        return {
          ...item,
          priceBrainScore: {
            sentiment: sentimentMap[item.sentiment] ?? 'Neutral',
            classification: 'Neutral',
            ...item.priceBrainScore,
            impliedPoints: pts.scaledPoints,
            instrument,
          },
        };
      }
      // For items without ivScore, still set the instrument
      if (item.priceBrainScore) {
        return { ...item, priceBrainScore: { ...item.priceBrainScore, instrument } };
      }
      return item;
    });

    // Ensure we always return a valid FeedResponse structure
    const response = {
      items,
      total: feed.total || 0,
      hasMore: feed.hasMore || false,
      fetchedAt: feed.fetchedAt || new Date().toISOString(),
      ...(feed.nextCursor && { nextCursor: feed.nextCursor })
    };
    
    console.log(`[RiskFlow] Returning response with ${response.items.length} items`);
    return c.json(response);
  } catch (error) {
    console.error('[RiskFlow] Feed error:', error);
    console.error('[RiskFlow] Error stack:', error instanceof Error ? error.stack : 'No stack');
    // Return empty response structure instead of error to prevent frontend crashes
    return c.json({
      items: [],
      total: 0,
      hasMore: false,
      fetchedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Failed to fetch feed'
    }, 500);
  }
}

/**
 * GET /api/riskflow/breaking
 * Get breaking news only
 */
export async function handleGetBreaking(c: Context) {
  const userId = c.get('userId') as string | undefined;

  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const feed = await feedService.getBreakingNews(userId);
    return c.json(feed);
  } catch (error) {
    console.error('[RiskFlow] Breaking news error:', error);
    return c.json({ error: 'Failed to fetch breaking news' }, 500);
  }
}

/**
 * GET /api/riskflow/preload
 * Pre-load 15 tweets from last 48 hours, level 2+ only
 */
export async function handlePreload(c: Context) {
  const userId = c.get('userId') as string | undefined;

  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const feed = await feedService.getFeed(userId, {
      limit: 15,
      minMacroLevel: 2,
    });
    return c.json({
      ...feed,
      preloaded: true,
      timeWindow: '48h',
    });
  } catch (error) {
    console.error('[RiskFlow] Preload error:', error);
    return c.json({ error: 'Failed to preload feed' }, 500);
  }
}

/**
 * GET /api/riskflow/watchlist
 * Get user watchlist
 */
export async function handleGetWatchlist(c: Context) {
  const userId = c.get('userId') as string | undefined;

  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const watchlist = watchlistService.getWatchlist(userId);
  return c.json({ watchlist, success: true });
}

/**
 * POST /api/riskflow/watchlist
 * Update user watchlist
 */
export async function handleUpdateWatchlist(c: Context) {
  const userId = c.get('userId') as string | undefined;

  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const body = await c.req.json<WatchlistUpdateRequest>().catch(() => ({}));
    const watchlist = watchlistService.updateWatchlist(userId, body);
    return c.json({ watchlist, success: true });
  } catch (error) {
    console.error('[RiskFlow] Watchlist update error:', error);
    return c.json({ error: 'Failed to update watchlist' }, 500);
  }
}

/**
 * POST /api/riskflow/watchlist/symbols
 * Add symbols to watchlist
 */
export async function handleAddSymbols(c: Context) {
  const userId = c.get('userId') as string | undefined;

  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const body = await c.req.json<{ symbols: string[] }>().catch(() => ({ symbols: [] }));

    if (!body.symbols?.length) {
      return c.json({ error: 'Symbols array is required' }, 400);
    }

    const watchlist = watchlistService.addSymbols(userId, body.symbols);
    return c.json({ watchlist, success: true });
  } catch (error) {
    console.error('[RiskFlow] Add symbols error:', error);
    return c.json({ error: 'Failed to add symbols' }, 500);
  }
}

/**
 * DELETE /api/riskflow/watchlist/symbols
 * Remove symbols from watchlist
 */
export async function handleRemoveSymbols(c: Context) {
  const userId = c.get('userId') as string | undefined;

  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const body = await c.req.json<{ symbols: string[] }>().catch(() => ({ symbols: [] }));

    if (!body.symbols?.length) {
      return c.json({ error: 'Symbols array is required' }, 400);
    }

    const watchlist = watchlistService.removeSymbols(userId, body.symbols);
    return c.json({ watchlist, success: true });
  } catch (error) {
    console.error('[RiskFlow] Remove symbols error:', error);
    return c.json({ error: 'Failed to remove symbols' }, 500);
  }
}

/**
 * GET /api/riskflow/stream
 * SSE stream for Level 4 alerts
 * Note: EventSource doesn't support custom headers, so auth token is passed via query param
 */
export async function handleBreakingStream(c: Context) {
  const userId = c.get('userId') || 'anonymous';
  console.log(`[SSE] New connection from user: ${userId}`);
  
  let heartbeatId: ReturnType<typeof setInterval> | null = null;

  // Get origin from request for CORS
  const origin = c.req.header('origin') || c.req.header('Origin');
  // Determine allowed origin from corsConfig (supports string | string[] | function)
  const allowedOrigin = await (async () => {
    const cfg: any = corsConfig.origin;
    if (!origin) return '*';
    if (typeof cfg === 'function') {
      return (await cfg(origin)) || '*';
    }
    if (Array.isArray(cfg)) {
      return cfg.includes(origin) ? origin : cfg[0] || '*';
    }
    if (typeof cfg === 'string') {
      return cfg === '*' ? '*' : cfg === origin ? origin : '*';
    }
    return '*';
  })();

  const stream = new ReadableStream({
    start(controller) {
      console.log(`[SSE] Stream started for user: ${userId}`);
      addClient(controller, userId);
      
      // Send initial connection message to confirm stream is working
      try {
        controller.enqueue(new TextEncoder().encode(': connected\n\n'));
      } catch (error) {
        console.error('[SSE] Failed to send initial message', error);
      }
      
      heartbeatId = setInterval(() => {
        try {
          controller.enqueue(new TextEncoder().encode(': heartbeat\n\n'));
        } catch (error) {
          console.warn('[SSE] Heartbeat failed, closing stream', error);
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
  c.header('Content-Type', 'text/event-stream');
  c.header('Cache-Control', 'no-cache');
  c.header('Connection', 'keep-alive');
  c.header('Access-Control-Allow-Origin', allowedOrigin);
  c.header('Access-Control-Allow-Credentials', 'true');
  c.header('Access-Control-Allow-Headers', 'Cache-Control');
  c.header('X-Accel-Buffering', 'no'); // Disable buffering in nginx/proxy

  console.log(`[SSE] Returning SSE response for user: ${userId}, origin: ${origin}`);
  
  // Return the stream response - Hono will handle it correctly
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': allowedOrigin,
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Headers': 'Cache-Control',
      'X-Accel-Buffering': 'no',
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
  const userId = c.get('userId') as string | undefined;
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const { sql, isDatabaseAvailable } = await import('../../config/database.js');
    
    if (!isDatabaseAvailable() || !sql) {
      return c.json({ error: 'Database not available' }, 503);
    }

    const limitParam = c.req.query('limit');
    const limit = limitParam ? Math.min(parseInt(limitParam, 10), 100) : 5;
    const showAll = c.req.query('all') === 'true';

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
      }
    });
  } catch (error) {
    console.error('[RiskFlow] Debug error:', error);
    return c.json({ error: error instanceof Error ? error.message : 'Debug failed' }, 500);
  }
}

/**
 * POST /api/riskflow/cron/prefetch
 * Cron job endpoint to pre-fetch and store news items
 * Protected by CRON_SECRET_TOKEN environment variable
 */
export async function handleCronPrefetch(c: Context) {
  // Verify cron secret token
  const providedToken = c.req.header('X-Cron-Secret') || c.req.query('token');
  const expectedToken = process.env.CRON_SECRET_TOKEN;

  if (!expectedToken) {
    console.warn('[RiskFlow] CRON_SECRET_TOKEN not configured');
    return c.json({ error: 'Cron job not configured' }, 500);
  }

  if (providedToken !== expectedToken) {
    return c.json({ error: 'Unauthorized' }, 401);
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
  const userId = c.get('userId') as string | undefined;

  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    // Get query params
    const instrument = c.req.query('instrument') || '/ES';
    const priceParam = c.req.query('price');
    
    // Get instrument config from the scoring engine (includes default prices)
    const instrumentConfig = getInstrumentConfig(instrument);
    
    // Use provided price or fallback to config price or 6000
    const currentPrice = priceParam 
      ? parseFloat(priceParam) 
      : (instrumentConfig?.currentPrice ?? 6000);

    // Fetch current VIX
    const vixData = await fetchVIX();
    console.log(`[IV Aggregate] VIX: ${vixData.level}, spike: ${vixData.isSpike}, stale: ${vixData.staleMinutes}min`);

    // Get recent news items from database (last 2 hours)
    const { sql, isDatabaseAvailable } = await import('../../config/database.js');
    
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
    const isFOMCWeek = dayOfWeek >= 1 && dayOfWeek <= 3 && dayOfMonth >= 10 && dayOfMonth <= 20;
    
    // Earnings season: ~2 weeks after quarter end (mid-Jan, mid-Apr, mid-Jul, mid-Oct)
    const month = now.getMonth();
    const isEarningsSeason = [0, 3, 6, 9].includes(month) && dayOfMonth >= 10 && dayOfMonth <= 28;

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
    console.error('[IV Aggregate] Error:', error);
    return c.json({ error: error instanceof Error ? error.message : 'Failed to calculate IV score' }, 500);
  }
}

/**
 * POST /api/riskflow/refresh
 * Manually trigger a feed poll cycle, rescore with current weights,
 * and auto-generate agent notes for critical items.
 * [claude-code 2026-03-27] S3: Full refresh = poll + score + auto-notes
 */
export async function handleRefresh(c: Context) {
  const userId = c.get('userId') as string | undefined;
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    // 1. Poll for fresh items (writes raw → raw_riskflow_items)
    await forcePoll();

    // 2. Re-score in-memory feed with current regime/calibration weights
    const { rescoreInMemoryFeed } = await import('../../services/riskflow/feed-service.js');
    const rescored = await rescoreInMemoryFeed().catch((err: unknown) => {
      console.warn('[RiskFlow] Rescore during refresh failed:', err);
      return 0;
    });

    // 3. Auto-generate agent notes for critical items (fire-and-forget)
    import('../../services/riskflow/agent-notes.js').then(({ generateNotesForCriticalItems }) => {
      generateNotesForCriticalItems().catch((err: unknown) => {
        console.warn('[RiskFlow] Auto-notes during refresh failed:', err);
      });
    });

    return c.json({ success: true, rescored, refreshedAt: new Date().toISOString() });
  } catch (error) {
    console.error('[RiskFlow] Refresh error:', error);
    return c.json({ error: 'Refresh failed' }, 500);
  }
}

/** POST /api/riskflow/:id/generate-note — manual agent note generation trigger */
export async function handleGenerateNote(c: Context) {
  try {
    const itemId = c.req.param('id');
    if (!itemId) return c.json({ error: 'Missing item ID' }, 400);

    const note = await generateNoteForItem(itemId);
    if (!note) return c.json({ error: 'Item not found or generation failed' }, 404);

    return c.json({ note });
  } catch (err) {
    console.error('[RiskFlow] Generate note error:', err);
    return c.json({ error: 'Failed to generate note' }, 500);
  }
}

/**
 * POST /api/riskflow/rescore
 * Re-processes current cached feed items with current regime/calibration weights.
 * Returns the number of items rescored and the updated items.
 */
export async function handleRescore(c: Context) {
  const userId = c.get('userId') as string | undefined;
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    // Re-enrich in-memory feed cache with current regime/calibration/commentator weights
    const { rescoreInMemoryFeed } = await import('../../services/riskflow/feed-service.js');
    const rescored = await rescoreInMemoryFeed();
    return c.json({ success: true, rescored, rescoredAt: new Date().toISOString() });
  } catch (error) {
    console.error('[RiskFlow] Rescore error:', error);
    return c.json({ error: error instanceof Error ? error.message : 'Rescore failed' }, 500);
  }
}

/** GET /api/riskflow/sources — connection status for data source indicators */
export async function handleGetSources(c: Context) {
  const [twitterCli] = await Promise.all([
    isTwitterCliInstalled().catch(() => false),
  ]);
  const supabaseUp = isSupabaseConfigured();
  return c.json({
    notion: supabaseUp, // Now backed by Supabase instead of Notion poller
    twitterCli,
    xApi: false, // Deprecated — replaced by twitter-cli
  });
}
