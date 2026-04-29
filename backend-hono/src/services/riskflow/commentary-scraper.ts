// [claude-code 2026-04-12] Curated timeline scraper — replaced open rettiwtSearch + Exa with curated account timelines
// Pulls from the same riskflow_source_accounts table as econ-rettiwt-poller, on a slower 30/60-min cadence.
// All items pass through content guard before hitting raw_riskflow_items.

import { writeRawItems, type RawRiskFlowItem } from "../supabase-service.js";
import { filterWithContentGuard } from "./content-guard.js";
import { rettiwtUserTimeline, isRettiwtAvailable } from "../rettiwt-service.js";
import { getActiveAccounts } from "../source-accounts/source-accounts-service.js";
import { createLogger } from "../../lib/logger.js";
import { getPollingConfig } from "./polling-config.js";

const log = createLogger("CommentaryScraper");

const HOT_INTERVAL_MS = 30 * 60_000;
const OFF_PEAK_INTERVAL_MS = 60 * 60_000;

const submittedIds = new Set<string>();
let scraperTimeout: ReturnType<typeof setTimeout> | null = null;

// ─── Helpers ────────────────────────────────────────────────────

function hashString(s: string): string {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = (hash << 5) - hash + s.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

function extractSymbols(text: string): string[] {
  const symbols: string[] = [];
  const tickerMatches = text.match(/\$[A-Z]{1,5}\b|\/[A-Z]{2,4}\b/g);
  if (tickerMatches) symbols.push(...tickerMatches);

  if (/\b(s&p|spx|spy)\b/i.test(text)) symbols.push("/ES");
  if (/\b(nasdaq|qqq|nq)\b/i.test(text)) symbols.push("/NQ");
  if (/\b(treasury|10.?year|tnx)\b/i.test(text)) symbols.push("/ZN");
  if (/\b(crude|oil|wti|cl)\b/i.test(text)) symbols.push("/CL");
  if (/\b(gold|xau)\b/i.test(text)) symbols.push("/GC");
  if (/\b(dollar|dxy|usd)\b/i.test(text)) symbols.push("DXY");

  return [...new Set(symbols)];
}

function extractTags(text: string): string[] {
  const tags: string[] = [];
  if (/\b(fed|fomc|powell|rate)\b/i.test(text)) tags.push("FED");
  if (/\b(cpi|ppi|inflation|prices)\b/i.test(text)) tags.push("INFLATION");
  if (/\b(jobs|nfp|employment|unemployment|claims)\b/i.test(text))
    tags.push("EMPLOYMENT");
  if (/\b(gdp|growth|recession)\b/i.test(text)) tags.push("GDP");
  if (/\b(tariff|trade war|china|import|export)\b/i.test(text))
    tags.push("TRADE");
  if (
    /\b(iran|israel|irgc|houthi|hezbollah|military|missile|strike|araghchi|khamenei)\b/i.test(
      text,
    )
  )
    tags.push("GEOPOLITICAL");
  if (/\b(trump|bessent|yellen|treasury sec)\b/i.test(text))
    tags.push("POLITICS");
  if (/\b(oil|opec|crude|energy|hormuz)\b/i.test(text)) tags.push("ENERGY");
  if (/\b(earnings|revenue|eps|guidance)\b/i.test(text)) tags.push("EARNINGS");
  if (/\b(breaking|urgent|alert)\b/i.test(text)) tags.push("BREAKING");
  if (/\b(nuclear|enrichment|uranium|iaea)\b/i.test(text)) tags.push("NUCLEAR");
  if (
    /\b(nvidia|nvda|meta|msft|aapl|goog|amzn|tsla|mag.?7|magnificent)\b/i.test(
      text,
    )
  )
    tags.push("MAG7");
  if (
    /\b(liquidity|credit spread|repo|TGA|QT|bank stress|private credit|redemption|withdrawal)\b/i.test(
      text,
    )
  )
    tags.push("LIQUIDITY");
  return [...new Set(tags)];
}

// ─── Timeline Result → RawRiskFlowItem ───────────────────────────

function timelineToRawItem(
  result: {
    id: string;
    text: string;
    author: string;
    publishedDate: string;
    url: string;
  },
  handle: string,
): RawRiskFlowItem | null {
  const text = result.text?.trim();
  if (!text || text.length < 15) return null;

  const headline = text.slice(0, 280);
  const normalizedTitle = headline
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const id = `cs-${handle}-${hashString(normalizedTitle)}`;
  if (submittedIds.has(id)) return null;

  return {
    tweet_id: id,
    source: "CuratedTimeline",
    headline,
    body: text.length > 280 ? text.slice(280, 600) : undefined,
    url: result.url || undefined,
    symbols: extractSymbols(text),
    tags: extractTags(text),
    is_breaking: /\b(breaking|urgent|alert|flash)\b/i.test(text),
    urgency: /\b(breaking|urgent)\b/i.test(text) ? "immediate" : "normal",
    published_at: result.publishedDate ?? new Date().toISOString(),
    submitted_by: `commentary-scraper:${handle}`,
    ingest_pipeline: "rettiwt-commentary",
  };
}

// ─── Main Poll Cycle ────────────────────────────────────────────

export async function pollCommentary(): Promise<void> {
  if (!isRettiwtAvailable()) {
    log.warn("No Rettiwt keys available — commentary scrape skipped");
    return;
  }

  log.info("Starting curated timeline commentary scrape cycle");
  let totalNew = 0;

  const activeAccounts = await getActiveAccounts();
  if (activeAccounts.length === 0) {
    log.warn("No active source accounts — commentary scrape skipped");
    return;
  }

  log.info(`Polling ${activeAccounts.length} curated accounts`);

  for (const account of activeAccounts) {
    try {
      const results = await rettiwtUserTimeline(account.handle, { count: 20 });

      if (results.length === 0) {
        continue;
      }

      const items: RawRiskFlowItem[] = [];
      for (const result of results) {
        const item = timelineToRawItem(result, account.handle);
        if (item) items.push(item);
      }

      if (items.length === 0) continue;

      const cleanItems = filterWithContentGuard(
        items,
        (i) => `${i.headline} ${i.body || ""}`,
        { source: `commentary-scraper:@${account.handle}` },
      );
      if (cleanItems.length === 0) continue;

      const written = await writeRawItems(cleanItems);
      for (const item of cleanItems) submittedIds.add(item.tweet_id);
      totalNew += written;

      log.info(
        `@${account.handle}: ${written} catalysts ingested (${account.category})`,
      );
    } catch (err) {
      log.warn(`@${account.handle} timeline scrape failed`, {
        error: String(err),
      });
    }
  }

  log.info(`Commentary scrape complete: ${totalNew} new catalysts total`);
}

// ─── Boot ───────────────────────────────────────────────────────

export function startCommentaryScraper(): void {
  if (!isRettiwtAvailable()) {
    log.warn("No Rettiwt keys available — commentary scraper disabled");
  }

  if (scraperTimeout) return;
  log.info("Commentary scraper starting (curated timelines only)");

  const scheduledPoll = async (): Promise<void> => {
    try {
      await pollCommentary();
    } catch (err) {
      log.warn("Commentary scrape cycle failed", { error: String(err) });
    }

    const { isHotHours } = getPollingConfig();
    const interval = isHotHours ? HOT_INTERVAL_MS : OFF_PEAK_INTERVAL_MS;
    log.info(
      `Next commentary scrape in ${Math.round(interval / 60_000)}m (hotHours=${isHotHours})`,
    );
    scraperTimeout = setTimeout(scheduledPoll, interval);
  };

  setTimeout(() => void scheduledPoll(), 15_000);
}

export function stopCommentaryScraper(): void {
  if (!scraperTimeout) return;
  clearTimeout(scraperTimeout);
  scraperTimeout = null;
  log.info("Commentary scraper stopped");
}
