// [claude-code 2026-04-29] Official government RSS collector. Keeps approved
// Federal Reserve feeds in RiskFlow without routing through retired Agent Reach.

import { createHash } from "node:crypto";
import type { CollectedNewsItem, NewsTier } from "./types.js";
import { scoreHeadline } from "../score.js";

const APPROVED_RSS_HOSTS = [
  "federalreserve.gov",
  "bls.gov",
  "fred.stlouisfed.org",
  "bea.gov",
  "census.gov",
  "treasury.gov",
];

interface RssItem {
  title: string;
  link: string;
  description?: string;
  pubDate?: string;
}

interface CollectOfficialGovRssOpts {
  feeds: string[];
  tier: NewsTier;
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function isApprovedHost(host: string): boolean {
  return APPROVED_RSS_HOSTS.some(
    (approved) => host === approved || host.endsWith(`.${approved}`),
  );
}

function decodeXml(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractTag(block: string, tag: string): string | undefined {
  const match = block.match(
    new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"),
  );
  return match?.[1] ? decodeXml(match[1]) : undefined;
}

function makeItemId(url: string, title: string): string {
  return createHash("sha1")
    .update(`official-gov-rss::${url}::${title}`)
    .digest("hex")
    .slice(0, 24);
}

function parseRss(xml: string): RssItem[] {
  const items: RssItem[] = [];
  const itemRegex = /<(item|entry)[^>]*>([\s\S]*?)<\/\1>/gi;
  let match: RegExpExecArray | null;
  while ((match = itemRegex.exec(xml)) !== null && items.length < 40) {
    const block = match[2];
    const title = extractTag(block, "title");
    const link =
      extractTag(block, "link") ??
      block.match(/<link[^>]+href=["']([^"']+)["']/i)?.[1]?.trim();
    if (!title || !link) continue;
    items.push({
      title,
      link,
      description: extractTag(block, "description") ?? extractTag(block, "summary"),
      pubDate:
        extractTag(block, "pubDate") ??
        extractTag(block, "published") ??
        extractTag(block, "updated"),
    });
  }
  return items;
}

async function fetchOfficialRss(feedUrl: string): Promise<RssItem[]> {
  const host = hostOf(feedUrl);
  if (!isApprovedHost(host)) return [];
  const response = await fetch(feedUrl, {
    headers: {
      Accept: "application/rss+xml, application/atom+xml, application/xml",
      "User-Agent": "FintheonRiskFlow/1.0 (+official-gov-rss)",
    },
    signal: AbortSignal.timeout(10_000),
    redirect: "follow",
  });
  if (!response.ok) return [];
  return parseRss(await response.text());
}

export async function collectFromOfficialGovRss(
  opts: CollectOfficialGovRssOpts,
): Promise<CollectedNewsItem[]> {
  const out: CollectedNewsItem[] = [];
  for (const feed of opts.feeds) {
    const started = Date.now();
    const feedHost = hostOf(feed);
    const items = await fetchOfficialRss(feed);
    const latency = Date.now() - started;
    for (const item of items) {
      const itemHost = hostOf(item.link);
      if (!isApprovedHost(itemHost)) continue;
      if (!scoreHeadline(item.title)) continue;
      out.push({
        item_id: makeItemId(item.link, item.title),
        source: "browser-harness",
        source_domain: itemHost || feedHost,
        headline: item.title,
        body: item.description ?? item.title,
        url: item.link,
        tier: opts.tier,
        published_at: item.pubDate ?? new Date().toISOString(),
        fetched_at: new Date().toISOString(),
        fetch_latency_ms: latency,
        ingest_pipeline: "browser-harness",
      });
    }
  }
  return out;
}
