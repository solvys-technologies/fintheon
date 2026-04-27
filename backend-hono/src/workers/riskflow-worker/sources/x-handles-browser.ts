// [claude-code 2026-04-26] Primary X (Twitter) handle intake via the
// `syndication.twitter.com` embed endpoint. Same data path X uses for
// third-party timeline widgets — public, no auth, no JS execution required.
// Replaces the dead public-Nitter mirror chain that was returning 0 items
// per tick AND the Playwright x.com path that was timing out on
// domcontentloaded due to X's progressive-load wall.
//
// Per TP: this is the PRIMARY intake. Agent-reach Nitter remains as a
// secondary fallback inside sources/index.ts when this returns nothing for
// a handle.
//
// Endpoint shape:
//   https://syndication.twitter.com/srv/timeline-profile/screen-name/{handle}
// Returns an HTML page whose <script id="__NEXT_DATA__"> embeds a JSON
// object containing a `props.pageProps.timeline.entries[]` array. Each
// entry has `content.tweet` with id_str, full_text, created_at, etc.

import type { CollectedNewsItem, NewsTier } from "./types.js";
import { scoreHeadline } from "../score.js";
import { getTweetsViaXActions } from "../../../services/xactions/client.js";
import { browseRead } from "../../../services/browser/index.js";

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
}

function stripHandle(h: string): string {
  return h.replace(/^@/, "").trim();
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
      out.push({
        tweet_id: idStr,
        text: text.trim(),
        timestamp: Number.isFinite(ts)
          ? new Date(ts).toISOString()
          : new Date().toISOString(),
        permalink: `https://x.com/${cleanHandle}/status/${idStr}`,
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

  // [claude-code 2026-04-27] PRIMARY: route through browser-harness Playwright
  // pool (services/browser/harness.ts → browseRead with textOnly:false so the
  // <script id="__NEXT_DATA__"> survives). The pool ships a real Chromium with
  // realistic headers + circuit breaker + Steel CDP fallback baked in, which
  // bypasses Twitter's 429 wall on Fly's IAD shared IP that plain fetch hits
  // immediately. If the pool itself errors (no browsers available, allowlist
  // miss, circuit tripped), we fall through to plain fetch as a last-ditch
  // before XActions.
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
  // Fly this almost always 429s, but the no-cost retry is fine before XActions.
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

  // SECONDARY (per TP): XActions behind browser-harness. Self-hosted
  // Puppeteer-based X scraper. Reaches X with its own egress IP + optional
  // session cookie, so it bypasses the 429 wall Fly's IAD shared IP hits on
  // syndication.twitter.com. Returns [] when XACTIONS_API_BASE is not set.
  const xa = await getTweetsViaXActions({ handle: cleanHandle, limit: 20 });
  if (xa.length > 0) {
    console.log(
      JSON.stringify({
        ts: new Date().toISOString(),
        service: "riskflow-worker",
        stage: "syndication_via_xactions",
        handle: cleanHandle,
        tweets: xa.length,
      }),
    );
    return xa.map((t) => ({
      tweet_id: t.tweet_id,
      text: t.text,
      timestamp: t.timestamp,
      permalink: t.permalink,
    }));
  }

  return [];
}

interface CollectOpts {
  handles: string[];
  tier: NewsTier;
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
      const tweets = await fetchSyndicationTweets(cleanHandle);
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
        tier: opts.tier,
        published_at: tw.timestamp || new Date().toISOString(),
        fetched_at: new Date().toISOString(),
        fetch_latency_ms,
      });
    }
  }
  return out;
}
