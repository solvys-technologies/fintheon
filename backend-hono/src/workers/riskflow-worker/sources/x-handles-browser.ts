// [claude-code 2026-04-29] X intake is browser-harness first. Rettiwt and
// Agent Reach are retired from the active pipeline; this collector uses the
// worker-owned persistent browser session against x.com, then falls back only
// to the public syndication widget when the session is unavailable.
// [claude-code 2026-04-26] Syndication fallback:
//   https://syndication.twitter.com/srv/timeline-profile/screen-name/{handle}
// Returns an HTML page whose <script id="__NEXT_DATA__"> embeds tweet JSON.

import type { CollectedNewsItem, NewsTier } from "./types.js";
import { scoreHeadline } from "../score.js";
import {
  browseRead,
  withPersistentBrowserPage,
} from "../../../services/browser/index.js";

const SYNDICATION_BASE = "https://syndication.twitter.com";
const FETCH_TIMEOUT_MS = 12_000;
const MAX_TWEETS_PER_HANDLE = 12;
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36";

interface ExtractedTweet {
  tweet_id: string;
  text: string;
  timestamp: string;
  permalink: string;
  /** First media URL attached to the tweet (photo or video thumbnail).
   *  Pulled from extended_entities.media[0].media_url_https with
   *  entities.media[0].media_url_https as fallback. */
  image_url?: string | null;
  /** [claude-code 2026-04-27] S46.4/I: highest-bitrate mp4 from
   *  extended_entities.media[0].video_info.variants[] when the tweet attaches
   *  a video / animated_gif. RiskFlowDetailCard renders <video> inline
   *  (OSINT-prioritized). */
  video_url?: string | null;
  /** Which browser-harness path produced the item. */
  pipeline_tag?: string;
}

function stripHandle(h: string): string {
  return h.replace(/^@/, "").trim();
}

function isoDate(value: string | undefined, fallbackMs: number): string {
  if (value) return value.slice(0, 10);
  return new Date(fallbackMs).toISOString().slice(0, 10);
}

function nextIsoDate(value: string | undefined): string {
  const base = value ? Date.parse(value) : Date.now();
  const ms = Number.isFinite(base) ? base : Date.now();
  return new Date(ms + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function normalizeTweetText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function normalizePermalink(url: string, cleanHandle: string, tweetId: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.endsWith("x.com") || parsed.hostname.endsWith("twitter.com")) {
      return `https://x.com/${cleanHandle}/status/${tweetId}`;
    }
  } catch {
    // fall through
  }
  return `https://x.com/${cleanHandle}/status/${tweetId}`;
}

async function fetchBrowserUseTweets(
  cleanHandle: string,
  opts: { from?: string; to?: string },
): Promise<ExtractedTweet[]> {
  const fromDate = isoDate(opts.from, Date.now() - MAX_AGE_MS);
  const toDate = opts.to ? nextIsoDate(opts.to) : nextIsoDate(undefined);
  const query = `from:${cleanHandle} since:${fromDate} until:${toDate}`;
  const url = `https://x.com/search?q=${encodeURIComponent(query)}&f=live`;

  try {
    return await withPersistentBrowserPage(async (page) => {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
      await page.waitForTimeout(5_000);

      const maxScrolls = opts.from ? 18 : 4;
      for (let i = 0; i < maxScrolls; i++) {
        await page.mouse.wheel(0, 1600);
        await page.waitForTimeout(1_000);
      }

      const rows = await page.evaluate((handle) => {
        return Array.from(document.querySelectorAll("article")).flatMap((article) => {
          const links = Array.from(article.querySelectorAll("a[href*='/status/']"))
            .map((a) => (a as HTMLAnchorElement).href)
            .filter((href) => href.includes(`/${handle}/status/`));
          const permalink = links[0];
          const match = permalink?.match(/\/status\/(\d+)/);
          const tweetId = match?.[1];
          const tweetText = (article.querySelector("[data-testid='tweetText']") as HTMLElement | null)
            ?.innerText;
          const timestamp = article.querySelector("time")?.getAttribute("datetime") ?? "";
          const imageUrl = (article.querySelector("img[src*='twimg.com/media']") as HTMLImageElement | null)
            ?.src;
          if (!tweetId || !tweetText || !timestamp) return [];
          return [{ tweetId, text: tweetText, timestamp, permalink, imageUrl }];
        });
      }, cleanHandle);

      const seen = new Set<string>();
      return rows.flatMap((row) => {
        if (seen.has(row.tweetId)) return [];
        seen.add(row.tweetId);
        return [{
          tweet_id: row.tweetId,
          text: normalizeTweetText(row.text),
          timestamp: row.timestamp,
          permalink: normalizePermalink(row.permalink, cleanHandle, row.tweetId),
          image_url: row.imageUrl ?? null,
          pipeline_tag: "x-browser-session",
        }];
      });
    });
  } catch (err) {
    console.warn(
      JSON.stringify({
        ts: new Date().toISOString(),
        service: "riskflow-worker",
        stage: "x_browser_session_error",
        handle: cleanHandle,
        error: err instanceof Error ? err.message : String(err),
      }),
    );
    return [];
  }
}

/**
 * Walk the syndication __NEXT_DATA__ tree looking for tweet shapes. The
 * structure is verbose and version-volatile, so a tolerant tree walk is
 * more reliable than a fixed path lookup.
 */
function extractTweetsFromNextData(
  data: unknown,
  cleanHandle: string,
): ExtractedTweet[] {
  const out: ExtractedTweet[] = [];
  const seen = new Set<string>();

  function walk(node: unknown): void {
    if (!node || out.length >= MAX_TWEETS_PER_HANDLE) return;
    if (Array.isArray(node)) {
      for (const item of node) walk(item);
      return;
    }
    if (typeof node !== "object") return;
    const obj = node as Record<string, unknown>;

    // A tweet object always has id_str + full_text|text + created_at.
    const idStr = obj.id_str ?? obj.id;
    const text = (obj.full_text ?? obj.text) as unknown;
    const created = obj.created_at as unknown;
    if (
      typeof idStr === "string" &&
      typeof text === "string" &&
      typeof created === "string" &&
      idStr.length > 8 &&
      !seen.has(idStr)
    ) {
      seen.add(idStr);
      const ts = Date.parse(created);
      // [claude-code 2026-04-27] Capture first photo from tweet media —
      // extended_entities is the canonical container (multi-media tweets);
      // entities is the legacy fallback. Both shapes nest media[] under the
      // tweet object, so this lookup runs at the same level as id_str/text.
      // S46.4/I: also capture the highest-bitrate .mp4 variant when the
      // attached media is type="video" or type="animated_gif".
      let imageUrl: string | null = null;
      let videoUrl: string | null = null;
      const extEntities = obj.extended_entities as
        | {
            media?: Array<{
              media_url_https?: string;
              type?: string;
              video_info?: {
                variants?: Array<{
                  bitrate?: number;
                  content_type?: string;
                  url?: string;
                }>;
              };
            }>;
          }
        | undefined;
      const entities = obj.entities as
        | { media?: Array<{ media_url_https?: string }> }
        | undefined;
      const mediaArr = extEntities?.media ?? entities?.media;
      if (Array.isArray(mediaArr) && mediaArr.length > 0) {
        const firstMedia = mediaArr[0] as {
          media_url_https?: string;
          type?: string;
          video_info?: {
            variants?: Array<{
              bitrate?: number;
              content_type?: string;
              url?: string;
            }>;
          };
        };
        const firstUrl = firstMedia?.media_url_https;
        if (typeof firstUrl === "string" && firstUrl.length > 0) {
          imageUrl = firstUrl;
        }
        const mediaType = firstMedia?.type;
        if (
          (mediaType === "video" || mediaType === "animated_gif") &&
          Array.isArray(firstMedia.video_info?.variants)
        ) {
          const mp4s = firstMedia.video_info!.variants!.filter(
            (v) => v.content_type === "video/mp4" && typeof v.url === "string",
          );
          mp4s.sort((a, b) => (b.bitrate ?? 0) - (a.bitrate ?? 0));
          if (mp4s.length > 0 && mp4s[0].url) videoUrl = mp4s[0].url;
        }
      }
      out.push({
        tweet_id: idStr,
        text: text.trim(),
        timestamp: Number.isFinite(ts)
          ? new Date(ts).toISOString()
          : new Date().toISOString(),
        permalink: `https://x.com/${cleanHandle}/status/${idStr}`,
        image_url: imageUrl,
        video_url: videoUrl,
      });
      // Don't return — tweets can nest (quote tweets, retweets), we want
      // the full timeline, not just the outermost level.
    }

    for (const key of Object.keys(obj)) {
      if (out.length >= MAX_TWEETS_PER_HANDLE) return;
      walk(obj[key]);
    }
  }

  walk(data);
  return out;
}

function parseSyndicationHtml(
  html: string,
  cleanHandle: string,
): ExtractedTweet[] {
  const match = html.match(
    /<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i,
  );
  if (!match) return [];
  try {
    const json = JSON.parse(match[1]);
    return extractTweetsFromNextData(json, cleanHandle);
  } catch {
    return [];
  }
}

async function fetchSyndicationTweets(
  cleanHandle: string,
): Promise<ExtractedTweet[]> {
  const url = `${SYNDICATION_BASE}/srv/timeline-profile/screen-name/${encodeURIComponent(
    cleanHandle,
  )}?language=en`;

  // Fallback: route through browser-harness Playwright
  // pool (services/browser/harness.ts → browseRead with textOnly:false so the
  // <script id="__NEXT_DATA__"> survives). The pool ships a real Chromium with
  // realistic headers + circuit breaker + Steel CDP fallback baked in, which
  // bypasses Twitter's 429 wall on Fly's IAD shared IP that plain fetch hits
  // immediately. If the pool itself errors (no browsers available, allowlist
  // miss, circuit tripped), we fall through to plain fetch as a last-ditch.
  try {
    const result = await browseRead({
      url,
      mode: "allowlist",
      textOnly: false,
      waitFor: "load",
    });
    if (result?.body && result.body.length > 0) {
      const tweets = parseSyndicationHtml(result.body, cleanHandle);
      if (tweets.length > 0) return tweets;
    }
    console.warn(
      JSON.stringify({
        ts: new Date().toISOString(),
        service: "riskflow-worker",
        stage: "syndication_harness_empty",
        handle: cleanHandle,
        status: result?.status ?? null,
      }),
    );
  } catch (err) {
    console.warn(
      JSON.stringify({
        ts: new Date().toISOString(),
        service: "riskflow-worker",
        stage: "syndication_harness_error",
        handle: cleanHandle,
        error: err instanceof Error ? err.message : String(err),
      }),
    );
  }

  // Last-ditch plain fetch — kept for the local-dev path where the Playwright
  // pool might be unavailable (no browsers installed on the dev machine). On
  // Fly this almost always 429s, but the no-cost retry is fine after harness.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    clearTimeout(timer);
    if (res.ok) {
      const html = await res.text();
      const tweets = parseSyndicationHtml(html, cleanHandle);
      if (tweets.length > 0) return tweets;
    } else {
      console.warn(
        JSON.stringify({
          ts: new Date().toISOString(),
          service: "riskflow-worker",
          stage: "syndication_non_ok",
          handle: cleanHandle,
          status: res.status,
        }),
      );
    }
  } catch (err) {
    clearTimeout(timer);
    console.warn(
      JSON.stringify({
        ts: new Date().toISOString(),
        service: "riskflow-worker",
        stage: "syndication_error",
        handle: cleanHandle,
        error: err instanceof Error ? err.message : String(err),
      }),
    );
  }

  return [];
}

interface CollectOpts {
  handles: string[];
  tier: NewsTier;
  from?: string;
  to?: string;
}

export async function collectFromXHandlesBrowser(
  opts: CollectOpts,
): Promise<CollectedNewsItem[]> {
  if (opts.handles.length === 0) return [];
  const out: CollectedNewsItem[] = [];
  const ageCutoff = Date.now() - MAX_AGE_MS;

  // Run handles in parallel — syndication is a plain HTTPS GET, no need to
  // serialize. 7 handles × ~600ms = a few seconds total, well inside the
  // breaking-tier interval.
  type AnnotatedTweet = {
    tw: ExtractedTweet;
    cleanHandle: string;
    fetch_latency_ms: number;
  };

  const results: AnnotatedTweet[][] = await Promise.all(
    opts.handles.map(async (handle): Promise<AnnotatedTweet[]> => {
      const cleanHandle = stripHandle(handle);
      if (!cleanHandle) return [];
      const started = Date.now();
      const browserTweets = await fetchBrowserUseTweets(cleanHandle, {
        from: opts.from,
        to: opts.to,
      });
      const tweets =
        browserTweets.length > 0
          ? browserTweets
          : await fetchSyndicationTweets(cleanHandle);
      const fetch_latency_ms = Date.now() - started;
      return tweets.map((tw) => ({ tw, cleanHandle, fetch_latency_ms }));
    }),
  );

  for (const batch of results) {
    for (const { tw, cleanHandle, fetch_latency_ms } of batch) {
      const ts = Date.parse(tw.timestamp);
      if (Number.isFinite(ts) && ts < ageCutoff) continue;
      const headline = tw.text.length > 220 ? tw.text.slice(0, 220) : tw.text;
      if (!scoreHeadline(headline)) continue;
      out.push({
        item_id: tw.tweet_id,
        source: `twitter:${cleanHandle}`,
        source_domain: "x.com",
        headline,
        body: tw.text,
        url: tw.permalink,
        image_url: tw.image_url ?? null,
        video_url: tw.video_url ?? null,
        tier: opts.tier,
        published_at: tw.timestamp || new Date().toISOString(),
        fetched_at: new Date().toISOString(),
        fetch_latency_ms,
        ingest_pipeline: tw.pipeline_tag || "x-syndication",
      });
    }
  }
  return out;
}
