// [claude-code 2026-04-19] S27-T7 (W2d): AgentReach collector — RSS-first, HTML
// scrape for enrichment. Reuses the existing domain circuit breaker from
// agent-reach-service (10-min pause after 3 failures).
// [claude-code 2026-04-24] S34-T5: accept `handles?` to expand into Nitter RSS
// with mirror fallback chain. Items are tagged source_domain="nitter:{handle}"
// so T4's per-source counter attributes back to the handle, not the mirror host.

import { createHash } from "node:crypto";
import { fetchRss, scrapeUrl } from "../../../services/agent-reach-service.js";
import type { CollectedNewsItem, NewsTier } from "./types.js";
import { scoreHeadline } from "../score.js";

interface CollectOpts {
  rssFeeds?: string[];
  handles?: string[];
  tier: NewsTier;
  enrich?: boolean; // if true, run scrapeUrl on each RSS entry for full body
}

const NITTER_MIRRORS = [
  "https://nitter.net",
  "https://nitter.poast.org",
  "https://nitter.privacydev.net",
];

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function makeItemId(url: string, title: string): string {
  return createHash("sha1")
    .update(`agent-reach::${url}::${title}`)
    .digest("hex")
    .slice(0, 24);
}

function stripHandle(h: string): string {
  return h.replace(/^@/, "").trim();
}

async function collectFromHandle(
  handle: string,
  tier: NewsTier,
  enrich: boolean,
): Promise<CollectedNewsItem[]> {
  const cleanHandle = stripHandle(handle);
  if (!cleanHandle) return [];
  const sourceTag = `nitter:${cleanHandle}`;

  for (const mirror of NITTER_MIRRORS) {
    const feedUrl = `${mirror}/${cleanHandle}/rss`;
    const started = Date.now();
    const items = await fetchRss(feedUrl);
    const baseLatency = Date.now() - started;
    if (items.length === 0) continue;

    const out: CollectedNewsItem[] = [];
    for (const item of items.slice(0, 15)) {
      if (!item.link || !item.title) continue;
      if (!scoreHeadline(item.title)) continue;

      let body = item.description ?? "";
      if (enrich) {
        const scraped = await scrapeUrl(item.link);
        if (scraped?.text) body = scraped.text;
      }

      out.push({
        item_id: makeItemId(item.link, item.title),
        source: "agent-reach",
        source_domain: sourceTag,
        headline: item.title,
        body,
        url: item.link,
        tier,
        published_at: item.pubDate ?? new Date().toISOString(),
        fetched_at: new Date().toISOString(),
        fetch_latency_ms: baseLatency,
      });
    }
    return out;
  }
  return [];
}

export async function collectFromAgentReach(
  opts: CollectOpts,
): Promise<CollectedNewsItem[]> {
  const out: CollectedNewsItem[] = [];
  const enrich = opts.enrich ?? false;

  for (const feed of opts.rssFeeds ?? []) {
    const started = Date.now();
    const items = await fetchRss(feed);
    const base_latency = Date.now() - started;
    for (const item of items.slice(0, 15)) {
      if (!item.link || !item.title) continue;
      if (!scoreHeadline(item.title)) continue;

      let body = item.description ?? "";
      if (enrich) {
        const scraped = await scrapeUrl(item.link);
        if (scraped?.text) body = scraped.text;
      }

      out.push({
        item_id: makeItemId(item.link, item.title),
        source: "agent-reach",
        source_domain: hostnameOf(item.link),
        headline: item.title,
        body,
        url: item.link,
        tier: opts.tier,
        published_at: item.pubDate ?? new Date().toISOString(),
        fetched_at: new Date().toISOString(),
        fetch_latency_ms: base_latency,
        ingest_pipeline: "agent-reach-nitter",
      });
    }
  }

  for (const handle of opts.handles ?? []) {
    const items = await collectFromHandle(handle, opts.tier, enrich);
    out.push(...items);
  }

  return out;
}
