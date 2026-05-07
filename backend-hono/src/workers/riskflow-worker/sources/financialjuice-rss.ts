// [codex 2026-05-07] FinancialJuice RSS primary ingestion pipe.
// The feed gives us stable numeric GUIDs and real timestamps without X/browser
// credentials, so this collector replaces the old profile-scrape dependency.

import type { CollectedNewsItem, NewsTier } from "./types.js";

const FEED_URL = "https://www.financialjuice.com/feed.ashx?xy=rss";
const HANDLE = "financialjuice";
const SOURCE = `twitter:${HANDLE}` as const;
const MAX_ITEMS = 80;

interface FinancialJuiceRssItem {
  title: string;
  link: string;
  guid: string;
  description?: string;
  pubDate?: string;
  author?: string;
}

interface CollectFinancialJuiceRssOpts {
  tier?: NewsTier;
  limit?: number;
}

function decodeXml(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) =>
      String.fromCharCode(Number(code)),
    )
    .replace(/<br\s*\/?>/gi, " ")
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

function normalizeText(value: string): string {
  return value
    .replace(/\bhttps?:\/\/\S+/gi, "")
    .replace(/\bFinancialJuice\s*(?:\||:)\s*/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

const AD_OR_PROMO_PATTERNS: RegExp[] = [
  /\b(sponsored|promoted|advertisement|paid partnership)\b/i,
  /\bad\s*:/i,
  /\bFinancialJuice\s*\|/i,
  /\bfinancialjuice\.com\b/i,
  /\b(subscribe|sign up|download|free trial|promo code|use code|coupon)\b/i,
  /\bjoin\s+(?:us|our)\b/i,
  /\bvoice users only\b/i,
  /\bblue stream button\b/i,
  /\bclick\s+(?:the\s+)?(?:blue\s+)?stream\b/i,
  /\bwait for it to say streaming\b/i,
  /\bdon'?t refresh site\b/i,
  /\blets you trade\b/i,
  /\blet'?s you trade\b/i,
  /\btrade like\b/i,
  /\bdiscount(?:ed)?\s+(?:code|offer|subscription|trial)\b/i,
];

const PROMO_EMOJIS = [
  "😂",
  "🤣",
  "😭",
  "💀",
  "😆",
  "😅",
  "🤡",
  "😜",
  "😝",
  "🤪",
  "😹",
  "😀",
  "😁",
  "😄",
  "🤭",
  "🫠",
];

export function isFinancialJuiceAdOrPromo(text: string): boolean {
  const compact = text.replace(/\s+/g, " ").trim();
  if (!compact) return false;
  if (AD_OR_PROMO_PATTERNS.some((pattern) => pattern.test(compact))) {
    return true;
  }
  return PROMO_EMOJIS.some((emoji) => compact.includes(emoji));
}

function parseRss(xml: string, limit: number): FinancialJuiceRssItem[] {
  const items: FinancialJuiceRssItem[] = [];
  const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi;
  let match: RegExpExecArray | null;
  while ((match = itemRegex.exec(xml)) !== null && items.length < limit) {
    const block = match[1];
    const title = extractTag(block, "title");
    const guid = extractTag(block, "guid");
    const link = extractTag(block, "link") ?? FEED_URL;
    if (!title || !guid) continue;
    items.push({
      title: normalizeText(title),
      link,
      guid: guid.trim(),
      description: extractTag(block, "description"),
      pubDate: extractTag(block, "pubDate"),
      author: extractTag(block, "author"),
    });
  }
  return items;
}

function toIsoDate(value: string | undefined): string {
  if (!value) return new Date().toISOString();
  const parsed = Date.parse(value);
  return Number.isFinite(parsed)
    ? new Date(parsed).toISOString()
    : new Date().toISOString();
}

function makeBody(item: FinancialJuiceRssItem): string {
  const description = item.description ? normalizeText(item.description) : "";
  if (!description || description === item.title) return item.title;
  return description;
}

export async function collectFromFinancialJuiceRss(
  opts: CollectFinancialJuiceRssOpts = {},
): Promise<CollectedNewsItem[]> {
  const started = Date.now();
  const response = await fetch(FEED_URL, {
    headers: {
      Accept: "application/rss+xml, application/xml, text/xml",
      "User-Agent": "FintheonRiskFlow/1.0 (+financialjuice-rss)",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    throw new Error(`FinancialJuice RSS ${response.status}`);
  }

  const fetchedAt = new Date().toISOString();
  const latency = Date.now() - started;
  const limit = Math.min(Math.max(opts.limit ?? MAX_ITEMS, 1), MAX_ITEMS);
  const rssItems = parseRss(await response.text(), limit);

  return rssItems.flatMap((item) => {
    if (!item.title.trim()) return [];
    const promoProbe = `${item.title} ${item.description ?? ""}`;
    if (isFinancialJuiceAdOrPromo(promoProbe)) return [];
    const guid = item.guid.replace(/^https?:\/\/\S+#?/i, "").trim();
    if (!guid) return [];
    return [
      {
        item_id: `financialjuice:${guid}`,
        source: SOURCE,
        source_domain: "financialjuice.com",
        headline: item.title,
        body: makeBody(item),
        url: item.link || FEED_URL,
        tier: opts.tier ?? "breaking",
        published_at: toIsoDate(item.pubDate),
        fetched_at: fetchedAt,
        fetch_latency_ms: latency,
        ingest_pipeline: "financialjuice-rss",
      },
    ];
  });
}
