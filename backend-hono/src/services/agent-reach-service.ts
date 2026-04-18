// [claude-code 2026-04-10] Agent-Reach: TypeScript fetch-based web scraper
// [claude-code 2026-04-18] S25-T1: UA pool + per-domain token bucket + circuit breaker
// Graceful: never throws, returns null/empty on failure. No external deps.

import { createLogger } from "../lib/logger.js";

const log = createLogger("AgentReach");

export interface ScrapedArticle {
  title: string;
  text: string;
  url: string;
  publishedDate?: string;
}

export type DomainState = "ok" | "tripped" | "cooldown";

const STRIP_TAGS = ["script", "style", "nav", "footer", "header", "noscript"];
const CONTENT_SELECTORS = ["article", "main", "[role=main]"];

// ── User-Agent pool ──────────────────────────────────────────────────────
const UA_POOL = [
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Safari/605.1.15",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_6_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6_1; rv:131.0) Gecko/20100101 Firefox/131.0",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 Edg/128.0.0.0",
  "Mozilla/5.0 (iPad; CPU OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.6613.85 Safari/537.36",
];

function pickUA(): string {
  return UA_POOL[Math.floor(Math.random() * UA_POOL.length)];
}

// ── Per-domain token bucket + circuit breaker ────────────────────────────
interface DomainBudget {
  lastAccessMs: number;
  nextAvailableMs: number;
  consecutiveFailures: number;
  circuitTrippedUntil: number;
  lastStatus: DomainState;
  totalRequests: number;
  totalFailures: number;
}

const MIN_INTERVAL_MS = 15_000; // 1 request per domain per 15s
const CIRCUIT_FAIL_THRESHOLD = 3; // 403/429/5xx × 3 trips the breaker
const CIRCUIT_PAUSE_MS = 10 * 60_000; // 10 min pause when tripped

const domainBudgets = new Map<string, DomainBudget>();

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function getOrInitBudget(domain: string): DomainBudget {
  let b = domainBudgets.get(domain);
  if (!b) {
    b = {
      lastAccessMs: 0,
      nextAvailableMs: 0,
      consecutiveFailures: 0,
      circuitTrippedUntil: 0,
      lastStatus: "ok",
      totalRequests: 0,
      totalFailures: 0,
    };
    domainBudgets.set(domain, b);
  }
  return b;
}

/** Returns true if we are allowed to fetch this domain right now. */
function canScrape(domain: string): boolean {
  const b = getOrInitBudget(domain);
  const now = Date.now();
  if (now < b.circuitTrippedUntil) return false;
  if (now < b.nextAvailableMs) return false;
  return true;
}

function recordSuccess(domain: string): void {
  const b = getOrInitBudget(domain);
  const now = Date.now();
  b.lastAccessMs = now;
  b.nextAvailableMs = now + MIN_INTERVAL_MS;
  b.consecutiveFailures = 0;
  b.lastStatus = "ok";
  b.totalRequests++;
}

function recordFailure(domain: string, httpStatus: number | null): void {
  const b = getOrInitBudget(domain);
  const now = Date.now();
  b.lastAccessMs = now;
  b.nextAvailableMs = now + MIN_INTERVAL_MS;
  b.totalRequests++;
  b.totalFailures++;

  const isRateLimit =
    httpStatus === 403 ||
    httpStatus === 429 ||
    (httpStatus !== null && httpStatus >= 500);
  if (isRateLimit) {
    b.consecutiveFailures++;
    if (b.consecutiveFailures >= CIRCUIT_FAIL_THRESHOLD) {
      b.circuitTrippedUntil = now + CIRCUIT_PAUSE_MS;
      b.lastStatus = "tripped";
      log.warn(
        `Circuit tripped for ${domain} — pausing ${CIRCUIT_PAUSE_MS / 60_000}min after ${b.consecutiveFailures} failures (last status: ${httpStatus})`,
      );
    } else {
      b.lastStatus = "cooldown";
    }
  }
}

/** Snapshot of every domain's current state, for health reporting. */
export function getDomainStatus(): Record<string, DomainState> {
  const out: Record<string, DomainState> = {};
  const now = Date.now();
  for (const [domain, b] of domainBudgets.entries()) {
    if (now < b.circuitTrippedUntil) {
      out[domain] = "tripped";
    } else if (b.consecutiveFailures > 0) {
      out[domain] = "cooldown";
    } else {
      out[domain] = "ok";
    }
  }
  return out;
}

// ── HTML parsing helpers ─────────────────────────────────────────────────

function stripHtmlTags(html: string, tagsToRemove: string[]): string {
  let result = html;
  for (const tag of tagsToRemove) {
    const regex = new RegExp(`<${tag}[^>]*>[\\s\\S]*?<\\/${tag}>`, "gi");
    result = result.replace(regex, "");
  }
  return result;
}

function extractContent(html: string): string {
  for (const selector of CONTENT_SELECTORS) {
    const tagName = selector.replace(/[\[\]=]/g, "");
    const regex = new RegExp(
      `<(?:${tagName}|[a-z]+ ${selector.replace("[", "").replace("]", "")})[^>]*>([\\s\\S]*?)<\\/(?:${tagName}|[a-z]+)>`,
      "i",
    );
    const match = html.match(regex);
    if (match?.[1] && match[1].length > 100) {
      return match[1];
    }
  }
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  return bodyMatch?.[1] ?? html;
}

function extractTitle(html: string): string {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch?.[1]?.trim()) return titleMatch[1].trim();

  const ogMatch = html.match(
    /<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i,
  );
  if (ogMatch?.[1]?.trim()) return ogMatch[1].trim();

  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1Match?.[1]?.trim()) {
    return h1Match[1].replace(/<[^>]+>/g, "").trim();
  }

  return "Untitled";
}

function extractPublishedDate(html: string): string | undefined {
  const timeMatch = html.match(/<time[^>]*datetime=["']([^"']+)["']/i);
  if (timeMatch?.[1]) return timeMatch[1];

  const metaMatch = html.match(
    /<meta[^>]*property=["']article:published_time["'][^>]*content=["']([^"']+)["']/i,
  );
  if (metaMatch?.[1]) return metaMatch[1];

  const jsonLdMatch = html.match(/"datePublished"\s*:\s*"([^"]+)"/i);
  if (jsonLdMatch?.[1]) return jsonLdMatch[1];

  return undefined;
}

function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\s+/g, " ")
    .trim();
}

// ── Public scraper API ───────────────────────────────────────────────────

export async function scrapeUrl(url: string): Promise<ScrapedArticle | null> {
  const domain = getDomain(url);
  if (!canScrape(domain)) return null;

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": pickUA(),
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: AbortSignal.timeout(8000),
      redirect: "follow",
    });

    if (!response.ok) {
      recordFailure(domain, response.status);
      return null;
    }

    const html = await response.text();
    const stripped = stripHtmlTags(html, STRIP_TAGS);
    const contentHtml = extractContent(stripped);
    const text = htmlToText(contentHtml).slice(0, 1200);
    const title = extractTitle(html);
    const publishedDate = extractPublishedDate(html);

    if (!text || text.length < 50) {
      recordFailure(domain, null);
      return null;
    }

    recordSuccess(domain);
    return { title, text, url, publishedDate };
  } catch (err) {
    recordFailure(domain, null);
    log.warn(`Scrape failed for ${url} (graceful)`, { error: String(err) });
    return null;
  }
}

export async function scrapeMultiple(
  urls: string[],
): Promise<ScrapedArticle[]> {
  const results = await Promise.allSettled(urls.map(scrapeUrl));
  return results
    .filter(
      (r): r is PromiseFulfilledResult<ScrapedArticle | null> =>
        r.status === "fulfilled",
    )
    .map((r) => r.value)
    .filter((a): a is ScrapedArticle => a !== null);
}

// ── RSS support ──────────────────────────────────────────────────────────

export interface RssItem {
  title: string;
  link: string;
  description?: string;
  pubDate?: string;
}

/**
 * Fetch + parse an RSS/Atom feed. Gentler than HTML scraping — lower rate-limit
 * footprint, structured dates/titles. Returns [] on failure.
 */
export async function fetchRss(feedUrl: string): Promise<RssItem[]> {
  const domain = getDomain(feedUrl);
  if (!canScrape(domain)) return [];

  try {
    const response = await fetch(feedUrl, {
      headers: {
        "User-Agent": pickUA(),
        Accept: "application/rss+xml, application/atom+xml, application/xml",
      },
      signal: AbortSignal.timeout(8000),
      redirect: "follow",
    });

    if (!response.ok) {
      recordFailure(domain, response.status);
      return [];
    }

    const xml = await response.text();
    const items: RssItem[] = [];

    // Match both <item>…</item> (RSS 2.0) and <entry>…</entry> (Atom)
    const itemRegex = /<(item|entry)[^>]*>([\s\S]*?)<\/\1>/gi;
    let match;
    while ((match = itemRegex.exec(xml)) !== null && items.length < 40) {
      const block = match[2];
      const title = block
        .match(
          /<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i,
        )?.[1]
        ?.trim();
      const link =
        block.match(/<link[^>]*>([\s\S]*?)<\/link>/i)?.[1]?.trim() ||
        block.match(/<link[^>]*href=["']([^"']+)["']/i)?.[1]?.trim();
      const description = block
        .match(
          /<description[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i,
        )?.[1]
        ?.trim();
      const pubDate =
        block.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i)?.[1]?.trim() ||
        block.match(/<published[^>]*>([\s\S]*?)<\/published>/i)?.[1]?.trim() ||
        block.match(/<updated[^>]*>([\s\S]*?)<\/updated>/i)?.[1]?.trim();

      if (title && link) {
        items.push({
          title: htmlToText(title),
          link,
          description: description ? htmlToText(description) : undefined,
          pubDate,
        });
      }
    }

    recordSuccess(domain);
    return items;
  } catch (err) {
    recordFailure(domain, null);
    log.warn(`RSS fetch failed for ${feedUrl} (graceful)`, {
      error: String(err),
    });
    return [];
  }
}
