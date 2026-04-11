// [claude-code 2026-04-10] Agent-Reach: TypeScript fetch-based web scraper
// Graceful: never throws, returns null/empty on failure. No external deps.

import { createLogger } from "../lib/logger.js";

const log = createLogger("AgentReach");

export interface ScrapedArticle {
  title: string;
  text: string;
  url: string;
  publishedDate?: string;
}

const STRIP_TAGS = ["script", "style", "nav", "footer", "header", "noscript"];
const CONTENT_SELECTORS = ["article", "main", "[role=main]"];

function stripHtmlTags(html: string, tagsToRemove: string[]): string {
  let result = html;
  for (const tag of tagsToRemove) {
    const regex = new RegExp(`<${tag}[^>]*>[\\s\\S]*?<\\/${tag}>`, "gi");
    result = result.replace(regex, "");
  }
  return result;
}

function extractContent(html: string): string {
  // Try content selectors first
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
  // Fall back to body
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  return bodyMatch?.[1] ?? html;
}

function extractTitle(html: string): string {
  // Try <title> tag
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch?.[1]?.trim()) return titleMatch[1].trim();

  // Try og:title meta
  const ogMatch = html.match(
    /<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i,
  );
  if (ogMatch?.[1]?.trim()) return ogMatch[1].trim();

  // Try first h1
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1Match?.[1]?.trim()) {
    return h1Match[1].replace(/<[^>]+>/g, "").trim();
  }

  return "Untitled";
}

function extractPublishedDate(html: string): string | undefined {
  // Try <time> datetime
  const timeMatch = html.match(/<time[^>]*datetime=["']([^"']+)["']/i);
  if (timeMatch?.[1]) return timeMatch[1];

  // Try article:published_time meta
  const metaMatch = html.match(
    /<meta[^>]*property=["']article:published_time["'][^>]*content=["']([^"']+)["']/i,
  );
  if (metaMatch?.[1]) return metaMatch[1];

  // Try datePublished in JSON-LD
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

export async function scrapeUrl(url: string): Promise<ScrapedArticle | null> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; FintheonBot/1.0; +https://fintheon.com)",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(8000),
      redirect: "follow",
    });

    if (!response.ok) return null;

    const html = await response.text();
    const stripped = stripHtmlTags(html, STRIP_TAGS);
    const contentHtml = extractContent(stripped);
    const text = htmlToText(contentHtml).slice(0, 1200);
    const title = extractTitle(html);
    const publishedDate = extractPublishedDate(html);

    if (!text || text.length < 50) return null;

    return { title, text, url, publishedDate };
  } catch (err) {
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
