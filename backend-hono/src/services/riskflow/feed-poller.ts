/**
 * Feed Poller Service
 * Continuously polls for new news items and broadcasts Level 4 events instantly
 * Runs independently of HTTP requests for real-time updates
 */
// [claude-code 2026-04-02] Dynamic polling: hot hours 60s (8-11AM ET), rotation 180s (all other times, 24/7).
// [claude-code 2026-03-12] Removed X API dependency — all tweet ingestion now via twitter-cli

// [claude-code 2026-03-27] S3: Write raw items to raw_riskflow_items for central scorer pipeline
// [claude-code 2026-04-02] Removed user autoRefresh gating — backend polling is autonomous.
import * as newsCache from "./news-cache.js";
import { enrichFeedWithAnalysis, updateFeedCache } from "./feed-service.js";
import { broadcastLevel4 } from "./sse-broadcaster.js";
import { fetchEconomicFeed } from "./economic-feed.js";
import {
  pollForEconNews,
  manualRefresh,
  isRettiwtRateLimited,
  markRettiwtPollSuccess,
  markRettiwtPollEmpty,
} from "./econ-rettiwt-poller.js";
import { isRettiwtAvailable, rettiwtSearch } from "../rettiwt-service.js";
import { writeRawItems, type RawRiskFlowItem } from "../supabase-service.js";
import { isSupabaseConfigured } from "../../config/supabase.js";
import { getPollingConfig } from "./polling-config.js";
import { pollCommentary } from "./commentary-scraper.js";
import { checkForScheduledEvents } from "./exa-scheduled-monitor.js";
import { exaSearch, isExaAvailable } from "../exa-service.js";
import { scrapeMultiple } from "../agent-reach-service.js";
import { areAllUsersKilled } from "./user-polling-registry.js";
import type { FeedItem } from "../../types/riskflow.js";
import { createLogger } from "../../lib/logger.js";

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
    submitted_by: "feed-poller",
  };
}

const log = createLogger("FeedPoller");

let pollTimeout: ReturnType<typeof setTimeout> | null = null;
let isPolling = false;
let consecutivePollingFailures = 0;
let lastPollingAttemptMs = 0;
const POLLING_WARN_THRESHOLD = 5;
const POLLING_CRITICAL_THRESHOLD = 10;
const POLLING_BACKOFF_INTERVAL_MS = 60_000; // extended retry after WARN_THRESHOLD

function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(
        () =>
          reject(new Error(`[FeedPoller] ${label} timed out after ${ms}ms`)),
        ms,
      ),
    ),
  ]);
}

// Health tracking for observability
let _pollsSinceLastLog = 0;
let _itemsSinceLastLog = 0;
let _lastHealthLog = 0;
const HEALTH_LOG_INTERVAL = 10 * 60_000; // Log health every 10 minutes

// S10-T1c: Manual toggle state — when false, ALL polling stops
let manualToggleEnabled = true;

/**
 * Backend polling is autonomous. Only the manual admin toggle can disable it.
 * When all users kill their feed, polling switches to scrape-only mode.
 */
function isPollingAllowed(): boolean {
  if (!manualToggleEnabled) {
    log.info("Polling blocked: manual toggle is OFF");
    return false;
  }
  return true;
}

function shouldUseScrapeOnly(): boolean {
  return areAllUsersKilled();
}

/** Set the manual polling toggle. When false, ALL X API calls stop. */
export function setPollingToggle(enabled: boolean): void {
  manualToggleEnabled = enabled;
  log.info(` Polling toggle set to ${enabled ? "ON" : "OFF"}`);
}

/** Get current polling toggle state */
export function getPollingToggle(): boolean {
  return manualToggleEnabled;
}

/**
 * Log pipeline health periodically so operators can verify the feed is alive.
 */
function maybeLogHealth(): void {
  const now = Date.now();
  if (now - _lastHealthLog < HEALTH_LOG_INTERVAL) return;
  _lastHealthLog = now;

  const { interval, isHotHours } = getPollingConfig();
  const intervalDesc = `${interval / 1000}s (${isHotHours ? "hot" : "rotation"})`;

  log.info(
    `Pipeline health: ${_pollsSinceLastLog} polls, ${_itemsSinceLastLog} new items in last 10min | interval: ${intervalDesc} | toggle: ${manualToggleEnabled ? "ON" : "OFF"}`,
  );

  _pollsSinceLastLog = 0;
  _itemsSinceLastLog = 0;
}

// ── Exa Fallback (runs when Twitter CLI is 429'd) ───────────────────────────
// Searches the same macro/geopolitical keywords via Exa neural search,
// pulling from wire services that mirror what FJ/DeItaOne/OSINT cover.

const EXA_FALLBACK_DOMAINS = [
  "financialjuice.com",
  "zerohedge.com",
  "reuters.com",
  "bloomberg.com",
  "macenews.com",
  "citrini.com",
  "cnbc.com",
  "wsj.com",
];

const EXA_FALLBACK_QUERIES = [
  "breaking market news Fed rate CPI NFP tariff today",
  "Iran Israel military strike missile ceasefire Houthi",
  "Trump tariff trade war Bessent Treasury",
  "FOMC Powell rate cut inflation economic data",
  "oil OPEC crude geopolitical supply disruption",
];

const exaFallbackSeenIds = new Set<string>();

function hashForDedup(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h).toString(36);
}

export async function runScrapeFallback(): Promise<number> {
  if (!isSupabaseConfigured()) return 0;

  log.info("[ScrapeFallback] Running Rettiwt + Agent-Reach fallback pipeline");
  let totalWritten = 0;

  // ── Step 1: Try Rettiwt search ──
  if (isRettiwtAvailable()) {
    for (const query of EXA_FALLBACK_QUERIES) {
      try {
        const results = await rettiwtSearch(query, { count: 8 });
        const items: RawRiskFlowItem[] = [];
        for (const r of results) {
          const title = r.text?.trim().slice(0, 280);
          if (!title || title.length < 15) continue;

          const id = `rt-fb-${hashForDedup(title.toLowerCase())}`;
          if (exaFallbackSeenIds.has(id)) continue;
          exaFallbackSeenIds.add(id);

          const isMacro =
            /\b(fed|fomc|cpi|ppi|gdp|nfp|pce|inflation|jobless|retail sales|rate)\b/i.test(
              title,
            );
          const isGeo =
            /\b(iran|israel|missile|strike|houthi|hezbollah|irgc|ceasefire|tariff|trade war)\b/i.test(
              title,
            );
          const isBreaking = /\b(breaking|urgent|alert|flash)\b/i.test(title);

          items.push({
            tweet_id: id,
            source: isMacro
              ? "FinancialJuice"
              : isGeo
                ? "OSINTSources"
                : "Custom",
            headline: title,
            body: r.text.length > 280 ? r.text.slice(280, 600) : undefined,
            url: r.url || undefined,
            symbols: [],
            tags: [],
            is_breaking: isBreaking,
            urgency: isBreaking ? "immediate" : "normal",
            published_at: r.publishedDate ?? new Date().toISOString(),
            submitted_by: "feed-poller:rettiwt-fallback",
          });
        }

        if (items.length > 0) {
          const written = await writeRawItems(items);
          totalWritten += written;
        }
      } catch (err) {
        log.warn(
          `[ScrapeFallback] Rettiwt query failed: "${query.slice(0, 40)}"`,
          { error: String(err) },
        );
      }
    }
    log.info(
      `[ScrapeFallback] Rettiwt phase done — ${totalWritten} items written`,
    );
  }

  // ── Step 2: Try Agent-Reach scrape if Rettiwt yielded nothing ──
  if (totalWritten === 0) {
    const scrapeUrls = EXA_FALLBACK_DOMAINS.map((d) => `https://${d}`);
    const articles = await scrapeMultiple(scrapeUrls);
    const items: RawRiskFlowItem[] = [];
    for (const a of articles) {
      const title = a.title?.trim();
      if (!title || title.length < 15) continue;
      if (/^(home|about|contact|subscribe|sign in|menu|cookie)/i.test(title))
        continue;

      const id = `ar-fb-${hashForDedup(title.toLowerCase())}`;
      if (exaFallbackSeenIds.has(id)) continue;
      exaFallbackSeenIds.add(id);

      const isBreaking = /\b(breaking|urgent|alert|flash)\b/i.test(
        `${title} ${a.text}`,
      );

      items.push({
        tweet_id: id,
        source: "Custom",
        headline: title,
        body: a.text.slice(0, 300) || undefined,
        url: a.url,
        symbols: [],
        tags: [],
        is_breaking: isBreaking,
        urgency: isBreaking ? "immediate" : "normal",
        published_at: a.publishedDate ?? new Date().toISOString(),
        submitted_by: "feed-poller:agent-reach-fallback",
      });
    }

    if (items.length > 0) {
      const written = await writeRawItems(items);
      totalWritten += written;
      log.info(`[ScrapeFallback] Agent-Reach phase — ${written} items written`);
    }
  }

  // ── Step 3: Dead-letter Exa fallback ──
  if (totalWritten === 0 && isExaAvailable()) {
    log.info(
      "[ScrapeFallback] Rettiwt+AgentReach empty — trying Exa dead-letter",
    );
    for (const query of EXA_FALLBACK_QUERIES) {
      try {
        const results = await exaSearch(query, {
          numResults: 8,
          type: "auto",
          useAutoprompt: true,
          includeDomains: EXA_FALLBACK_DOMAINS,
        });

        const items: RawRiskFlowItem[] = [];
        for (const r of results) {
          const title = r.title?.trim();
          if (!title || title.length < 15) continue;
          if (
            /^(home|about|contact|subscribe|sign in|menu|cookie)/i.test(title)
          )
            continue;
          if (
            /\b(download the app|session prep|pre-?session|sign up|create account|free trial|subscribe now|get started|install|app store|google play|newsletter|webinar|podcast|sponsored)\b/i.test(
              title,
            )
          )
            continue;

          const id = `exa-fb-${hashForDedup(title.toLowerCase())}`;
          if (exaFallbackSeenIds.has(id)) continue;
          exaFallbackSeenIds.add(id);

          const fullText = `${title} ${r.text || ""}`;
          const isMacro =
            /\b(fed|fomc|cpi|ppi|gdp|nfp|pce|inflation|jobless|retail sales|rate)\b/i.test(
              fullText,
            );
          const isGeo =
            /\b(iran|israel|missile|strike|houthi|hezbollah|irgc|ceasefire|tariff|trade war)\b/i.test(
              fullText,
            );
          const isBreaking = /\b(breaking|urgent|alert|flash)\b/i.test(
            fullText,
          );

          items.push({
            tweet_id: id,
            source: isMacro
              ? "FinancialJuice"
              : isGeo
                ? "OSINTSources"
                : "Custom",
            headline: title,
            body:
              (r.text || "")
                .replace(/\n+/g, " ")
                .replace(/\s+/g, " ")
                .trim()
                .slice(0, 300) || undefined,
            url: r.url || undefined,
            symbols: [],
            tags: [],
            is_breaking: isBreaking,
            urgency: isBreaking ? "immediate" : "normal",
            published_at: r.publishedDate ?? new Date().toISOString(),
            submitted_by: "feed-poller:exa-fallback",
          });
        }

        if (items.length > 0) {
          const written = await writeRawItems(items);
          totalWritten += written;
        }
      } catch (err) {
        log.warn(`[ScrapeFallback] Exa query failed: "${query.slice(0, 40)}"`, {
          error: String(err),
        });
      }
    }
  }

  // Also run commentary + scheduled event scrapers
  await Promise.all([
    pollCommentary().catch((err) =>
      log.warn("[ScrapeFallback] Commentary scrape failed:", {
        error: String(err),
      }),
    ),
    checkForScheduledEvents().catch((err) =>
      log.warn("[ScrapeFallback] Scheduled events failed:", {
        error: String(err),
      }),
    ),
  ]);

  log.info(
    `[ScrapeFallback] Done — ${totalWritten} new items written to raw_riskflow_items`,
  );
  return totalWritten;
}

/** @deprecated Use runScrapeFallback instead */
export const runExaFallback = runScrapeFallback;

/**
 * Poll for new feed items and process them
 */
async function pollForNewItems(): Promise<void> {
  if (isPolling) {
    return; // Prevent concurrent polls
  }

  if (
    consecutivePollingFailures >= POLLING_WARN_THRESHOLD &&
    consecutivePollingFailures < POLLING_CRITICAL_THRESHOLD &&
    Date.now() - lastPollingAttemptMs < POLLING_BACKOFF_INTERVAL_MS
  ) {
    return;
  }
  lastPollingAttemptMs = Date.now();

  if (!isPollingAllowed()) {
    return;
  }

  isPolling = true;
  _pollsSinceLastLog++;

  try {
    // ── Scrape-only mode when all users killed their feeds ──
    if (shouldUseScrapeOnly()) {
      log.info(
        "[FeedPoller] All users killed X feed — running scrape fallback only",
      );
      await runScrapeFallback();
      consecutivePollingFailures = 0;
      return;
    }

    // ── Scrape fallback when Rettiwt is rate-limited ──
    if (isRettiwtRateLimited()) {
      await runScrapeFallback();
      consecutivePollingFailures = 0;
      return;
    }

    // Check Rettiwt availability
    const rettiwtUp = isRettiwtAvailable();
    if (!rettiwtUp) {
      log.warn(
        "Rettiwt NOT available — feed will only contain economic calendar items. Check RETTIWT_AUTH_TOKEN",
      );
    }

    // Gather items from Rettiwt + economic feed
    const [rettiwtItems, econItems] = await Promise.all([
      rettiwtUp
        ? pollForEconNews().catch((err) => {
            log.error("Rettiwt poll failed:", { error: String(err) });
            return [] as FeedItem[];
          })
        : Promise.resolve([] as FeedItem[]),
      fetchEconomicFeed().catch((err) => {
        log.warn("Economic feed fetch failed:", { error: String(err) });
        return [] as FeedItem[];
      }),
    ]);

    // Track empty polls — triggers scrape fallback after consecutive empties
    if (rettiwtUp && rettiwtItems.length === 0) {
      markRettiwtPollEmpty();
      if (isRettiwtRateLimited()) {
        log.info(
          "Rettiwt returning empty — running scrape fallback for headlines",
        );
        await runScrapeFallback();
      }
    } else if (rettiwtItems.length > 0) {
      markRettiwtPollSuccess();
    }

    const rawItems: FeedItem[] = [...econItems, ...rettiwtItems];

    if (rawItems.length === 0) {
      log.info(
        `Poll cycle: 0 items from all sources (rettiwt: ${rettiwtUp ? "available" : "unavailable"}, econ: checked)`,
      );
      consecutivePollingFailures = 0;
      return;
    }

    // Check which items are already cached
    const itemIds = rawItems.map((i) => i.id);
    const cachedIds = await newsCache.getCachedTweetIds(itemIds);
    const newItems = rawItems.filter((i) => !cachedIds.has(i.id));

    if (newItems.length === 0) {
      consecutivePollingFailures = 0;
      return; // No new items
    }

    _itemsSinceLastLog += newItems.length;
    log.info(
      ` Found ${newItems.length} new items (${cachedIds.size} already cached)`,
    );

    // S3: Write raw (unenriched) items to raw_riskflow_items for central scorer
    if (isSupabaseConfigured()) {
      const rawRows = newItems.map(feedItemToRaw);
      const written = await writeRawItems(rawRows);
      log.info(` Wrote ${written} raw items to raw_riskflow_items`);
    }

    // Enrich with AI analysis (this calculates IV scores and macro levels)
    const enrichedItems = await withTimeout(
      enrichFeedWithAnalysis(newItems),
      30_000,
      "enrichFeedWithAnalysis",
    );

    // Store all items in legacy news_feed_items (kept for backward compat during migration)
    await newsCache.storeFeedItems(enrichedItems);
    updateFeedCache(enrichedItems);

    // Broadcast Level 4 items immediately via SSE
    const level4Items = enrichedItems.filter((item) => item.macroLevel === 4);
    for (const item of level4Items) {
      log.info(` Broadcasting Level 4 item: ${item.headline}`);
      broadcastLevel4(item);
    }

    if (level4Items.length > 0) {
      log.info(` Broadcast ${level4Items.length} Level 4 items via SSE`);
    }
    consecutivePollingFailures = 0;
  } catch (error) {
    consecutivePollingFailures += 1;
    const msg = error instanceof Error ? error.message : String(error);
    const timedOut = msg.includes("timed out");

    if (consecutivePollingFailures >= POLLING_CRITICAL_THRESHOLD) {
      log.error(
        "[FeedPoller] CRITICAL: 10+ consecutive failures. Likely env/auth issue. Check SUPABASE_URL, SUPABASE_ANON_KEY, and JWT expiry.",
        { error: msg, consecutivePollingFailures, timedOut },
      );
    } else if (consecutivePollingFailures >= POLLING_WARN_THRESHOLD) {
      log.warn(
        "[FeedPoller] WARNING: 5+ consecutive failures. Backing off to 60s interval.",
        { error: msg, consecutivePollingFailures, timedOut },
      );
    } else if (timedOut) {
      log.warn(
        "[FeedPoller] Enrichment timed out — resetting isPolling guard",
        { msg, consecutivePollingFailures },
      );
    } else {
      log.error("[FeedPoller] Poll error:", { error: msg });
    }
  } finally {
    isPolling = false;
    maybeLogHealth();
  }
}

/**
 * Start the continuous polling service
 */
export function startFeedPoller(): void {
  if (pollTimeout) {
    log.info("FeedPoller already running");
    return;
  }

  log.info("FeedPoller starting (dynamic interval, 24/7)");
  _pollerStarted = true;

  const scheduledPoll = async (): Promise<void> => {
    await pollForNewItems();

    const { interval, isHotHours } = getPollingConfig();
    log.info(
      `[FeedPoller] Next poll in ${interval / 1000}s (hotHours=${isHotHours})`,
    );
    pollTimeout = setTimeout(scheduledPoll, interval);
  };

  void scheduledPoll();
}

/**
 * Stop the polling service
 */
export function stopFeedPoller(): void {
  if (pollTimeout) {
    clearTimeout(pollTimeout);
    pollTimeout = null;
    _pollerStarted = false;
    console.log("[FeedPoller] Stopped");
  }
}

/**
 * Force an immediate poll cycle (used by manual refresh endpoint).
 * Uses manualRefreshTweets to force timeline fetch regardless of schedule cadence.
 * Waits for any active poll to finish before running, so the refresh
 * is never silently dropped.
 */
export async function forcePoll(): Promise<void> {
  // Wait for any in-flight poll to complete (max ~5s)
  let waited = 0;
  while (isPolling && waited < 5000) {
    await new Promise((r) => setTimeout(r, 250));
    waited += 250;
  }

  isPolling = true;
  try {
    // Manual refresh path — Rettiwt + Agent-Reach + economic feed
    const [rettiwtItems, econItems] = await Promise.all([
      manualRefresh().catch(() => []),
      fetchEconomicFeed().catch(() => []),
    ]);

    const rawItems: FeedItem[] = [...econItems, ...rettiwtItems];
    if (rawItems.length === 0) return;

    const itemIds = rawItems.map((i) => i.id);
    const cachedIds = await newsCache.getCachedTweetIds(itemIds);
    const newItems = rawItems.filter((i) => !cachedIds.has(i.id));

    if (newItems.length === 0) return;

    log.info(
      ` Manual refresh: ${newItems.length} new items (${cachedIds.size} already cached)`,
    );

    // S3: Write raw items to raw_riskflow_items for central scorer
    if (isSupabaseConfigured()) {
      const rawRows = newItems.map(feedItemToRaw);
      const written = await writeRawItems(rawRows);
      log.info(
        ` Manual refresh: wrote ${written} raw items to raw_riskflow_items`,
      );
    }

    const enrichedItems = await enrichFeedWithAnalysis(newItems);
    await newsCache.storeFeedItems(enrichedItems);
    updateFeedCache(enrichedItems);

    const level4Items = enrichedItems.filter((item) => item.macroLevel === 4);
    for (const item of level4Items) {
      log.info(` Broadcasting Level 4 item: ${item.headline}`);
      broadcastLevel4(item);
    }
  } catch (error) {
    log.error(" Manual refresh error:", error);
  } finally {
    isPolling = false;
  }
}

/**
 * Get polling status — true if poller has been started (even if currently in a poll cycle)
 */
let _pollerStarted = false;
export function isPollingActive(): boolean {
  return _pollerStarted;
}
