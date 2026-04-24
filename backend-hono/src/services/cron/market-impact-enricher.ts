// [claude-code 2026-04-23] Removed MARKET_IMPACT_VIA_ROUTINE gate — Claude Code routines retired.
// [claude-code 2026-03-28] Market impact enricher — nightly cron enriches HIGH/CRITICAL scored items with NQ/ES/YM daily close

import { fetchDailyClose } from "../market-data/daily-close-service.js";
import {
  readItemsNeedingMarketImpact,
  writeMarketImpact,
} from "../supabase-service.js";
import type { MarketImpactData } from "../supabase-service.js";
import { createLogger } from "../../lib/logger.js";

const log = createLogger("MarketImpact");

const MAX_ITEMS_PER_RUN = 50;
const MAX_AGE_DAYS = 365;

/**
 * Runs nightly at 6 PM ET (22:00 UTC).
 * Finds scored_riskflow_items with macro_level >= 3, older than 24h,
 * that don't have market_impact data yet. Fetches daily close for each
 * event date and writes back.
 */
export async function runMarketImpactEnrichment(): Promise<{
  processed: number;
  enriched: number;
  errors: number;
}> {
  let processed = 0;
  let enriched = 0;
  let errors = 0;

  try {
    const items = await readItemsNeedingMarketImpact(MAX_ITEMS_PER_RUN);
    if (items.length === 0) {
      log.info("No items needing market impact");
      return { processed: 0, enriched: 0, errors: 0 };
    }

    processed = items.length;

    // Group items by date (share the same close data)
    const byDate = new Map<string, string[]>();
    const cutoffDate = new Date(Date.now() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    for (const item of items) {
      const date = (item.published_at ?? (item as any).created_at ?? "").slice(
        0,
        10,
      );
      if (!date || date < cutoffDate) continue;

      if (!byDate.has(date)) byDate.set(date, []);
      byDate.get(date)!.push(item.tweet_id);
    }

    log.info(`Processing ${processed} items across ${byDate.size} dates`);

    // Fetch daily close for each unique date
    const closeCache = new Map<
      string,
      Awaited<ReturnType<typeof fetchDailyClose>>
    >();

    for (const date of byDate.keys()) {
      try {
        const closes = await fetchDailyClose(date);
        closeCache.set(date, closes);
      } catch (err) {
        log.error(`Failed to fetch closes for ${date}`, { error: String(err) });
        errors++;
      }
    }

    // Build updates
    const updates: Array<{
      tweet_id: string;
      market_impact: MarketImpactData;
    }> = [];

    for (const [date, tweetIds] of byDate) {
      const closes = closeCache.get(date);
      if (!closes) continue;

      const impact: MarketImpactData = {
        nq: closes.nq
          ? { points: closes.nq.change, percent: closes.nq.changePercent }
          : null,
        es: closes.es
          ? { points: closes.es.change, percent: closes.es.changePercent }
          : null,
        ym: closes.ym
          ? { points: closes.ym.change, percent: closes.ym.changePercent }
          : null,
        asOf: date,
      };

      for (const tweet_id of tweetIds) {
        updates.push({ tweet_id, market_impact: impact });
      }
    }

    // Batch write
    if (updates.length > 0) {
      const written = await writeMarketImpact(updates);
      enriched = written;
    }

    log.info(
      `Enriched ${enriched}/${processed} items across ${byDate.size} dates`,
    );
  } catch (err) {
    log.error("Market impact enrichment failed", { error: String(err) });
    errors++;
  }

  return { processed, enriched, errors };
}

// ─── Scheduler (setInterval-based, same pattern as econ-enricher) ───

let enricherTimer: ReturnType<typeof setInterval> | null = null;
const INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

export function startMarketImpactEnricher(): void {
  log.info("Starting market impact enricher (24h interval)");

  // Run once on boot
  runMarketImpactEnrichment().catch((err) =>
    log.error("Initial run error", { error: String(err) }),
  );

  enricherTimer = setInterval(() => {
    runMarketImpactEnrichment().catch((err) =>
      log.error("Scheduled run error", { error: String(err) }),
    );
  }, INTERVAL_MS);
}

export function stopMarketImpactEnricher(): void {
  if (enricherTimer) {
    clearInterval(enricherTimer);
    enricherTimer = null;
  }
}
