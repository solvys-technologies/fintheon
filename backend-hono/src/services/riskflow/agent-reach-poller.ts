// [claude-code 2026-04-18] S25-T1: Dedicated Agent-Reach poller — primary news source
// Runs independently of Rettiwt. RSS preferred, HTML scraping as fallback.
// [claude-code 2026-04-26] S46.1: Mainstream RSS feeds (Reuters, Bloomberg,
// MarketWatch, CNBC, SeekingAlpha, ZeroHedge) PERMANENTLY REMOVED per TP.
// Only Twitter ingest + FRED/BLS/Federal Reserve government feeds are allowed
// off-Internet. Don't add mainstream-media RSS back here without explicit TP
// signoff — they keep getting reverted otherwise.

import { createBasePoller, type PollResult } from "../ingestion/base-poller.js";
import {
  fetchRss,
  scrapeUrl,
  getDomainStatus,
  type RssItem,
  type ScrapedArticle,
} from "../agent-reach-service.js";
import { getPollingConfig } from "./polling-config.js";
import { recordUserPollSuccess } from "./user-polling-registry.js";
import type { RawRiskFlowItem } from "../supabase-service.js";
import type { createLogger } from "../../lib/logger.js";

type PollerLogger = ReturnType<typeof createLogger>;

export const AGENT_REACH_POLLER_NAME = "agent-reach";

// [claude-code 2026-04-26] Approved off-Internet sources: government data only.
// Anything not from Twitter or these feeds is NOISE per TP.
const RSS_FEEDS: { url: string; source: string }[] = [
  // Federal Reserve — press, speeches, FOMC, monetary policy
  {
    url: "https://www.federalreserve.gov/feeds/press_all.xml",
    source: "FederalReserve",
  },
  {
    url: "https://www.federalreserve.gov/feeds/speeches.xml",
    source: "FederalReserve",
  },
  {
    url: "https://www.federalreserve.gov/feeds/press_monetary.xml",
    source: "FederalReserve",
  },
  // BLS — jobs, CPI, PPI, productivity
  { url: "https://www.bls.gov/feed/news_release.rss", source: "BLS" },
  { url: "https://www.bls.gov/feed/bls_latest.rss", source: "BLS" },
  // FRED — economic data + research blog from St. Louis Fed
  {
    url: "https://fredblog.stlouisfed.org/feed/",
    source: "FRED",
  },
];

// HTML scraping fallback — disabled (FinancialJuice covered via Twitter handle).
const HTML_TARGETS: { url: string; source: string }[] = [];

function hashForId(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h).toString(36);
}

function rssItemToRaw(item: RssItem, sourceName: string): RawRiskFlowItem {
  const title = item.title.trim().slice(0, 280);
  const id = `ar-rss-${sourceName.toLowerCase()}-${hashForId(title.toLowerCase())}`;
  const isBreaking = /\b(breaking|urgent|alert|flash)\b/i.test(title);

  let publishedAt: string;
  try {
    publishedAt = item.pubDate
      ? new Date(item.pubDate).toISOString()
      : new Date().toISOString();
  } catch {
    publishedAt = new Date().toISOString();
  }

  return {
    tweet_id: id,
    source: "Custom",
    headline: title,
    body: item.description?.slice(0, 500),
    url: item.link,
    symbols: [],
    tags: [],
    is_breaking: isBreaking,
    urgency: isBreaking ? "immediate" : "normal",
    published_at: publishedAt,
    submitted_by: `agent-reach:rss:${sourceName.toLowerCase()}`,
  };
}

function htmlToRaw(
  article: ScrapedArticle,
  sourceName: string,
): RawRiskFlowItem | null {
  const title = article.title.trim();
  if (!title || title.length < 15) return null;
  if (/^(home|about|contact|subscribe|sign in|menu|cookie)/i.test(title)) {
    return null;
  }

  const id = `ar-html-${sourceName.toLowerCase()}-${hashForId(title.toLowerCase())}`;
  const body = article.text.slice(0, 500);
  const isBreaking = /\b(breaking|urgent|alert|flash)\b/i.test(
    `${title} ${body}`,
  );

  let publishedAt: string;
  try {
    publishedAt = article.publishedDate
      ? new Date(article.publishedDate).toISOString()
      : new Date().toISOString();
  } catch {
    publishedAt = new Date().toISOString();
  }

  return {
    tweet_id: id,
    source: "Custom",
    headline: title.slice(0, 280),
    body: body || undefined,
    url: article.url,
    symbols: [],
    tags: [],
    is_breaking: isBreaking,
    urgency: isBreaking ? "immediate" : "normal",
    published_at: publishedAt,
    submitted_by: `agent-reach:html:${sourceName.toLowerCase()}`,
  };
}

async function pollAgentReach(log: PollerLogger): Promise<PollResult> {
  const items: RawRiskFlowItem[] = [];

  // RSS pass — parallel, each feed hits its own domain
  const rssResults = await Promise.allSettled(
    RSS_FEEDS.map((f) =>
      fetchRss(f.url).then((rss) => ({ rss, source: f.source })),
    ),
  );
  for (const r of rssResults) {
    if (r.status !== "fulfilled") continue;
    const { rss, source } = r.value;
    for (const entry of rss) {
      items.push(rssItemToRaw(entry, source));
    }
  }

  // HTML pass — only for sources without a reliable RSS (e.g. FinancialJuice)
  const htmlResults = await Promise.allSettled(
    HTML_TARGETS.map((t) =>
      scrapeUrl(t.url).then((article) => ({ article, source: t.source })),
    ),
  );
  for (const r of htmlResults) {
    if (r.status !== "fulfilled") continue;
    const { article, source } = r.value;
    if (!article) continue;
    const raw = htmlToRaw(article, source);
    if (raw) items.push(raw);
  }

  const domains = getDomainStatus();
  const tripped = Object.entries(domains)
    .filter(([, s]) => s === "tripped")
    .map(([d]) => d);
  if (tripped.length > 0) {
    log.info(`Domains tripped (paused): ${tripped.join(", ")}`);
  }

  log.info(
    `Poll cycle: ${items.length} items from ${RSS_FEEDS.length} RSS + ${HTML_TARGETS.length} HTML sources`,
  );

  return { items };
}

const poller = createBasePoller(
  {
    name: AGENT_REACH_POLLER_NAME,
    getInterval: () => getPollingConfig().interval,
    initialDelayMs: 3_000,
    // Agent Reach is always backend-attributed — no user credentials involved.
    onWrite: () => recordUserPollSuccess(null),
  },
  pollAgentReach,
);

export function startAgentReachPoller(): void {
  poller.start();
}

export function stopAgentReachPoller(): void {
  poller.stop();
}

export async function agentReachTick(): Promise<void> {
  await poller.tick();
}

export function isAgentReachActive(): boolean {
  return poller.isActive();
}
