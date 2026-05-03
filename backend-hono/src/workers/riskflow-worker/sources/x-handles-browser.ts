// [claude-code 2026-05-03] Hardened X auto-reauth flow: (1) clear stale x.com
// cookies before login attempt so X shows a clean login form instead of a broken
// session-expired page, (2) pre-flight auth check in fetchHomeTimeline detects
// login wall on first attempt and triggers re-auth immediately instead of waiting
// 3 cycles, (3) multi-strategy selectors for Next/Login buttons, (4) extract ct0
// alongside auth_token so persistent context re-launch has both, (5) challenge
// page handling (username verification step), (6) CAPTCHA/2FA detection in logs.

import type { CollectedNewsItem, NewsTier } from "./types.js";
import { scoreHeadline } from "../score.js";
import {
  browseRead,
  withPersistentBrowserPage,
} from "../../../services/browser/index.js";
import { getTweetsViaXActions } from "../../../services/xactions/client.js";
import {
  getRoutingForHandle,
  passesContentFilter,
} from "./handle-routing.js";

const SYNDICATION_BASE = "https://syndication.twitter.com";
const FETCH_TIMEOUT_MS = 12_000;
const MAX_TWEETS_TOTAL = 60;
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
const HOME_SCROLL_COUNT = 8;
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36";

interface ExtractedTweet {
  tweet_id: string;
  text: string;
  timestamp: string;
  permalink: string;
  author_handle: string;
  image_url?: string | null;
  video_url?: string | null;
  pipeline_tag?: string;
}

function stripHandle(h: string): string {
  return h.replace(/^@/, "").trim();
}

function normalizeTweetText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function extractHandleFromPermalink(href: string): string | null {
  // e.g. /FinancialJuice/status/123 or https://x.com/FinancialJuice/status/123
  const match = href.match(/\/([^/]+)\/status\/\d+/);
  return match ? stripHandle(match[1]) : null;
}

// Home timeline cache — shared across tiers within the same cycle window

let homeTimelineCache: { tweets: ExtractedTweet[]; at: number } | null = null;
const HOME_CACHE_TTL_MS = 90_000;

// Auth expiry detection — consecutive empty cycles means the token likely expired
let consecutiveEmptyCycles = 0;
const AUTH_EXPIRY_THRESHOLD = 3;
let loginInProgress = false;

export async function attemptXLogin(): Promise<boolean> {
  if (loginInProgress) return false;
  const email = process.env.X_EMAIL?.trim();
  const password = process.env.X_PASSWORD?.trim();
  if (!email || !password) {
    console.warn(
      JSON.stringify({
        ts: new Date().toISOString(),
        service: "riskflow-worker",
        stage: "x_login_skipped",
        reason: "X_EMAIL or X_PASSWORD not set — cannot auto-refresh token",
      }),
    );
    return false;
  }

  loginInProgress = true;
  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      service: "riskflow-worker",
      stage: "x_login_attempt",
      email: email.slice(0, 3) + "***",
    }),
  );

  try {
    return await withPersistentBrowserPage(async (page) => {
      // Clear x.com cookies first — stale auth_token from context launch
      // can cause X to show a broken session-expired page instead of login
      const ctx = page.context();
      const preCookies = await ctx.cookies(".x.com");
      if (preCookies.length > 0) {
        await ctx.clearCookies({ domain: ".x.com" });
        console.log(
          JSON.stringify({
            ts: new Date().toISOString(),
            service: "riskflow-worker",
            stage: "x_login_cleared_cookies",
            count: preCookies.length,
          }),
        );
      }

      // Navigate to login
      await page.goto("https://x.com/login", {
        waitUntil: "domcontentloaded",
        timeout: 30_000,
      });
      await page.waitForTimeout(3_000);

      // Detect if we actually landed on a login page (not a broken/error page)
      const pageText = await page.evaluate(() =>
        document.body.innerText.slice(0, 800),
      );
      const hasLoginForm =
        /sign in|log in|sign up/i.test(pageText) &&
        !/\bsomething went wrong\b/i.test(pageText);
      if (!hasLoginForm) {
        console.error(
          JSON.stringify({
            ts: new Date().toISOString(),
            service: "riskflow-worker",
            stage: "x_login_no_form",
            currentUrl: page.url(),
            pagePreview: pageText.slice(0, 250),
          }),
        );
        return false;
      }

      // Fill username/email
      const usernameInput = page.locator(
        'input[autocomplete="username"], input[name="text"], input[type="text"]',
      ).first();
      await usernameInput.fill(email);
      await page.waitForTimeout(800);

      // Click next — try multiple selector strategies
      let nextClicked = false;
      const nextSelectors = [
        '[role="button"]:has-text("Next")',
        '[role="button"]:has-text("next")',
        'button:has-text("Next")',
        'span:has-text("Next")',
      ];
      for (const sel of nextSelectors) {
        const btn = page.locator(sel).first();
        if (await btn.isVisible({ timeout: 1_000 }).catch(() => false)) {
          await btn.click();
          nextClicked = true;
          break;
        }
      }
      if (nextClicked) {
        await page.waitForTimeout(2_500);
      }

      // Handle unusual activity / phone verification challenge if shown
      const challengeText = await page.evaluate(() =>
        document.body.innerText.slice(0, 300),
      );
      if (/\b(verify|unusual|challenge|phone|username)\b/i.test(challengeText)) {
        // X may ask to verify the username before showing password
        const verifyInput = page.locator(
          'input[autocomplete="on"], input[name="text"], input[type="text"]',
        ).first();
        if (await verifyInput.isVisible({ timeout: 1_000 }).catch(() => false)) {
          const verifyValue = await verifyInput.inputValue();
          if (!verifyValue) {
            await verifyInput.fill(email);
            await page.waitForTimeout(500);
            const verifyBtns = page.locator(
              '[role="button"]:has-text("Next"), [role="button"]:has-text("next"), button:has-text("Next")',
            ).first();
            if (await verifyBtns.isVisible({ timeout: 1_000 }).catch(() => false)) {
              await verifyBtns.click();
              await page.waitForTimeout(2_500);
            }
          }
        }
      }

      // Fill password
      const passwordInput = page.locator(
        'input[type="password"], input[name="password"]',
      ).first();
      if (await passwordInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await passwordInput.fill(password);
        await page.waitForTimeout(800);

        // Click login — try multiple selector strategies
        const loginSelectors = [
          '[role="button"]:has-text("Log in")',
          '[role="button"]:has-text("Sign in")',
          'button:has-text("Log in")',
          'span:has-text("Log in")',
        ];
        for (const sel of loginSelectors) {
          const btn = page.locator(sel).first();
          if (await btn.isVisible({ timeout: 1_000 }).catch(() => false)) {
            await btn.click();
            break;
          }
        }
        // Wait for redirect to home
        await page.waitForTimeout(6_000);
      }

      // Check if login succeeded — any X home/feed URL means we're in
      const currentUrl = page.url();
      const loggedIn =
        currentUrl.includes("x.com/home") ||
        currentUrl === "https://x.com/" ||
        currentUrl === "https://x.com" ||
        currentUrl === "https://twitter.com/" ||
        currentUrl === "https://twitter.com";

      if (loggedIn) {
        // Extract auth_token and ct0 cookies
        const cookies = await ctx.cookies();
        const authToken = cookies.find(
          (c) => c.name === "auth_token" && c.domain.includes("x.com"),
        );
        const ct0 = cookies.find(
          (c) => c.name === "ct0" && c.domain.includes("x.com"),
        );
        if (authToken?.value) {
          process.env.X_AUTH_TOKEN = authToken.value;
          if (ct0?.value) {
            process.env.X_CT0_TOKEN = ct0.value;
          }
          console.log(
            JSON.stringify({
              ts: new Date().toISOString(),
              service: "riskflow-worker",
              stage: "x_login_success",
              tokenPrefix: authToken.value.slice(0, 8) + "...",
              hasCt0: Boolean(ct0?.value),
            }),
          );
          consecutiveEmptyCycles = 0;
          loginInProgress = false;
          return true;
        }
      }

      // 2FA, CAPTCHA, or other roadblock
      const finalText = await page.evaluate(() =>
        document.body.innerText.slice(0, 500),
      );
      console.error(
        JSON.stringify({
          ts: new Date().toISOString(),
          service: "riskflow-worker",
          stage: "x_login_failed",
          currentUrl,
          pagePreview: finalText.slice(0, 250),
          has2fa: /\b(authenticator|verification code|two.factor|2FA|confirm your identity)\b/i.test(finalText),
          hasCaptcha: /\b(captcha|prove you|not a robot|verify you are human)\b/i.test(finalText),
        }),
      );
      return false;
    });
  } catch (err) {
    console.error(
      JSON.stringify({
        ts: new Date().toISOString(),
        service: "riskflow-worker",
        stage: "x_login_error",
        error: err instanceof Error ? err.message : String(err),
      }),
    );
    return false;
  } finally {
    loginInProgress = false;
  }
}

async function checkXAuth(page: import("playwright").Page): Promise<boolean> {
  const url = page.url();
  if (url.includes("x.com/home") || url === "https://x.com/" || url === "https://x.com") {
    return true;
  }
  const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 300));
  const isLoginPage =
    /\b(sign in to x|log in to x|sign up for x|join x today)\b/i.test(bodyText) ||
    /\bDon.t have an account\?.*Sign up\b/i.test(bodyText);
  if (isLoginPage) return false;
  const hasTweets = await page.evaluate(
    () => document.querySelectorAll("article").length > 0,
  );
  return hasTweets;
}

async function fetchHomeTimeline(): Promise<ExtractedTweet[]> {
  if (homeTimelineCache && Date.now() - homeTimelineCache.at < HOME_CACHE_TTL_MS) {
    return homeTimelineCache.tweets;
  }

  try {
    return await withPersistentBrowserPage(async (page) => {
      await page.goto("https://x.com/home", {
        waitUntil: "domcontentloaded",
        timeout: 45_000,
      });
      await page.waitForTimeout(3_000);

      const isAuthenticated = await checkXAuth(page);
      if (!isAuthenticated) {
        // Auth is dead — trigger immediate login, don't wait 3 cycles
        console.log(
          JSON.stringify({
            ts: new Date().toISOString(),
            service: "riskflow-worker",
            stage: "home_timeline_not_authenticated",
            message: "Login wall detected — triggering re-auth",
          }),
        );
        throw new Error("X_AUTH_FAILED");
      }

      for (let i = 0; i < HOME_SCROLL_COUNT; i++) {
        await page.mouse.wheel(0, 1600);
        await page.waitForTimeout(800);
      }

      const rawRows = await page.evaluate(() => {
        function extractBestImg(article: Element): string | null {
          // Multiple selector strategies for X tweet media images.
          // X lazy-loads images; after scroll the src should be populated.
          const selectors = [
            "img[src*='pbs.twimg.com/media']",
            "img[src*='pbs.twimg.com/card_img']",
            "img[src*='twimg.com/media']",
            "img[src*='twimg.com/amplify_video_thumb']",
            "img[src*='pbs.twimg.com/amplify_video_thumb']",
            "[data-testid='tweetPhoto'] img",
          ];
          for (const sel of selectors) {
            const el = article.querySelector(sel) as HTMLImageElement | null;
            if (el?.src) return el.src;
          }
          return null;
        }

        function extractBestVideo(article: Element): string | null {
          // X renders videos as <video> elements with src from video.twimg.com
          const videoEls = article.querySelectorAll("video");
          for (const v of Array.from(videoEls)) {
            const ve = v as HTMLVideoElement;
            if (ve.src && /twimg\.com/.test(ve.src)) return ve.src;
            const srcEl = ve.querySelector(
              "source[src*='twimg.com']",
            ) as HTMLSourceElement | null;
            if (srcEl?.src && /twimg\.com/.test(srcEl.src)) return srcEl.src;
          }
          return null;
        }

        return Array.from(document.querySelectorAll("article")).flatMap(
          (article) => {
            const articleText = (article as HTMLElement).innerText || "";
            if (
              /\bPromoted\b/i.test(articleText) &&
              articleText.length < 300
            ) {
              return [];
            }
            const statusLinks = Array.from(
              article.querySelectorAll("a[href*='/status/']"),
            )
              .map((a) => (a as HTMLAnchorElement).href)
              .filter((href) => /\/\w+\/status\/\d+/.test(href));
            const permalink = statusLinks[0];
            if (!permalink) return [];
            const tweetIdMatch = permalink.match(/\/status\/(\d+)/);
            const tweetId = tweetIdMatch?.[1];
            const tweetText = (
              article.querySelector(
                "[data-testid='tweetText']",
              ) as HTMLElement | null
            )?.innerText;
            const timestamp =
              article.querySelector("time")?.getAttribute("datetime") ?? "";
            const imageUrl = extractBestImg(article);
            const videoUrl = extractBestVideo(article);
            if (!tweetId || !tweetText || !timestamp) return [];
            if (
              tweetText.length < 15 ||
              /\b(?:sponsored|advert|promoted|paid partnership)\b/i.test(
                tweetText,
              )
            ) {
              return [];
            }
            return [
              {
                tweetId,
                text: tweetText,
                timestamp,
                permalink,
                imageUrl: imageUrl || null,
                videoUrl: videoUrl || null,
              },
            ];
          },
        );
      });

      const seen = new Set<string>();
      const out: ExtractedTweet[] = [];
      for (const row of rawRows) {
        if (seen.has(row.tweetId)) continue;
        seen.add(row.tweetId);
        const handle = extractHandleFromPermalink(row.permalink) ?? "unknown";
        out.push({
          tweet_id: row.tweetId,
          text: normalizeTweetText(row.text),
          timestamp: row.timestamp,
          permalink: row.permalink,
          author_handle: handle,
          image_url: row.imageUrl ?? null,
          video_url: row.videoUrl ?? null,
          pipeline_tag: "x-home-timeline",
        });
        if (out.length >= MAX_TWEETS_TOTAL) break;
      }
      homeTimelineCache = { tweets: out, at: Date.now() };
      consecutiveEmptyCycles = 0;
      return out;
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.warn(
      JSON.stringify({
        ts: new Date().toISOString(),
        service: "riskflow-worker",
        stage: "home_timeline_error",
        error: errMsg,
      }),
    );

    // Immediate re-auth on known auth failure (login wall detected by checkXAuth)
    if (errMsg === "X_AUTH_FAILED") {
      consecutiveEmptyCycles = AUTH_EXPIRY_THRESHOLD;
    }
  }

  // Track consecutive failures
  consecutiveEmptyCycles++;
  if (consecutiveEmptyCycles >= AUTH_EXPIRY_THRESHOLD) {
    if (await attemptXLogin()) {
      homeTimelineCache = null;
      consecutiveEmptyCycles = 0;
    } else {
      console.error(
        JSON.stringify({
          ts: new Date().toISOString(),
          service: "riskflow-worker",
          stage: "home_timeline_expired_auth",
          consecutiveEmptyCycles,
          message:
            "X home timeline returned empty for multiple cycles and auto-login failed. Check X_EMAIL/X_PASSWORD credentials.",
        }),
      );
    }
  }
  return [];
}

// ── Syndication widget fallback (per-handle, rate-limited) ──

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

function extractTweetsFromNextData(
  data: unknown,
  cleanHandle: string,
): ExtractedTweet[] {
  const out: ExtractedTweet[] = [];
  const seen = new Set<string>();

  function walk(node: unknown): void {
    if (!node || out.length >= 12) return;
    if (Array.isArray(node)) {
      for (const item of node) walk(item);
      return;
    }
    if (typeof node !== "object") return;
    const obj = node as Record<string, unknown>;
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
        if (typeof firstMedia?.media_url_https === "string") {
          imageUrl = firstMedia.media_url_https;
        }
        if (
          (firstMedia?.type === "video" || firstMedia?.type === "animated_gif") &&
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
        author_handle: cleanHandle,
        image_url: imageUrl,
        video_url: videoUrl,
      });
    }
    for (const key of Object.keys(obj)) {
      if (out.length >= 12) return;
      walk(obj[key]);
    }
  }
  walk(data);
  return out;
}

async function fetchSyndicationTweets(
  cleanHandle: string,
): Promise<ExtractedTweet[]> {
  const url = `${SYNDICATION_BASE}/srv/timeline-profile/screen-name/${encodeURIComponent(
    cleanHandle,
  )}?language=en`;

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
      return parseSyndicationHtml(html, cleanHandle);
    }
  } catch {
    clearTimeout(timer);
  }

  return [];
}

async function fetchXActionsTweets(
  cleanHandle: string,
): Promise<ExtractedTweet[]> {
  const xa = await getTweetsViaXActions({ handle: cleanHandle, limit: 20 });
  if (xa.length === 0) return [];
  return xa.map((t) => ({
    tweet_id: t.tweet_id,
    text: t.text,
    timestamp: t.timestamp,
    permalink: t.permalink,
    author_handle: cleanHandle,
    image_url: (t as { image_url?: string | null }).image_url ?? null,
    pipeline_tag: "xactions",
  }));
}

// ── Unified collector ──

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
  const fromMs = opts.from
    ? Date.parse(`${opts.from}T00:00:00.000Z`)
    : Number.NaN;
  const toMs = opts.to ? Date.parse(`${opts.to}T23:59:59.999Z`) : Number.NaN;
  const historicalWindow =
    Number.isFinite(fromMs) && Number.isFinite(toMs) && opts.from != null && opts.to != null;
  const allowedHandles = new Set(opts.handles.map(stripHandle).filter(Boolean));

  // Primary: home timeline via persistent browser session (requires X_AUTH_TOKEN)
  const started = Date.now();
  const homeTweets = await fetchHomeTimeline();
  const fetchLatency = Date.now() - started;

  if (homeTweets.length > 0) {
    console.log(
      JSON.stringify({
        ts: new Date().toISOString(),
        service: "riskflow-worker",
        stage: "home_timeline_tweets",
        total: homeTweets.length,
        latency_ms: fetchLatency,
      }),
    );
    for (const tw of homeTweets) {
      // Check handle routing config first; fall back to source-accounts allowlist
      const routings = getRoutingForHandle(tw.author_handle);
      const isAllowed = routings.length > 0 || allowedHandles.has(tw.author_handle);
      if (!isAllowed) continue;

      const ts = Date.parse(tw.timestamp);
      if (!Number.isFinite(ts)) continue;
      if (historicalWindow) {
        if (ts < fromMs || ts > toMs) continue;
      } else if (ts < ageCutoff) {
        continue;
      }
      const headline =
        tw.text.length > 220 ? tw.text.slice(0, 220) : tw.text;
      if (!scoreHeadline(headline)) continue;

      // Emit one item per routing entry that passes its content filter,
      // or a single unfiltered entry if handle is only in source-accounts allowlist
      if (routings.length > 0) {
        for (const routing of routings) {
          if (!passesContentFilter(tw.text, routing.contentFilter)) continue;
          if (opts.tier !== "unified" && opts.tier !== routing.tier) continue;
          out.push({
            item_id: tw.tweet_id,
            source: `twitter:${tw.author_handle}`,
            source_domain: "x.com",
            headline,
            body: tw.text,
            url: tw.permalink,
            image_url: tw.image_url ?? null,
            video_url: tw.video_url ?? null,
            tier: opts.tier === "unified" ? routing.tier : opts.tier,
            published_at: tw.timestamp || new Date().toISOString(),
            fetched_at: new Date().toISOString(),
            fetch_latency_ms: fetchLatency,
            ingest_pipeline: tw.pipeline_tag || "x-home-timeline",
          });
        }
      } else {
        out.push({
          item_id: tw.tweet_id,
          source: `twitter:${tw.author_handle}`,
          source_domain: "x.com",
          headline,
          body: tw.text,
          url: tw.permalink,
          image_url: tw.image_url ?? null,
          video_url: tw.video_url ?? null,
          tier: opts.tier === "unified" ? "standard" : opts.tier,
          published_at: tw.timestamp || new Date().toISOString(),
          fetched_at: new Date().toISOString(),
          fetch_latency_ms: fetchLatency,
          ingest_pipeline: tw.pipeline_tag || "x-home-timeline",
        });
      }
    }
  } else {
    // Fallback: per-handle syndication + XActions
    console.log(
      JSON.stringify({
        ts: new Date().toISOString(),
        service: "riskflow-worker",
        stage: "home_timeline_empty_fallback",
        handles: opts.handles.length,
      }),
    );

    const results = await Promise.all(
      opts.handles.map(async (handle) => {
        const cleanHandle = stripHandle(handle);
        if (!cleanHandle) return [] as ExtractedTweet[];
        const sStarted = Date.now();
        let tweets = await fetchSyndicationTweets(cleanHandle);
        if (tweets.length === 0) {
          tweets = await fetchXActionsTweets(cleanHandle);
        }
        const sLatency = Date.now() - sStarted;
        return tweets.map((tw) => ({
          ...tw,
          fetch_latency_ms: sLatency,
        }));
      }),
    );

    for (const batch of results) {
      for (const tw of batch) {
        const ts = Date.parse(tw.timestamp);
        if (!Number.isFinite(ts)) continue;
        if (historicalWindow) {
          if (ts < fromMs || ts > toMs) continue;
        } else if (ts < ageCutoff) {
          continue;
        }
        const headline =
          tw.text.length > 220 ? tw.text.slice(0, 220) : tw.text;
        if (!scoreHeadline(headline)) continue;
        out.push({
          item_id: tw.tweet_id,
          source: `twitter:${tw.author_handle}`,
          source_domain: "x.com",
          headline,
          body: tw.text,
          url: tw.permalink,
          image_url: tw.image_url ?? null,
          video_url: tw.video_url ?? null,
          tier: opts.tier === "unified"
            ? (getRoutingForHandle(tw.author_handle)[0]?.tier ?? "standard")
            : opts.tier,
          published_at: tw.timestamp || new Date().toISOString(),
          fetched_at: new Date().toISOString(),
          fetch_latency_ms:
            (tw as { fetch_latency_ms?: number }).fetch_latency_ms ?? 0,
          ingest_pipeline: tw.pipeline_tag || "x-syndication",
        });
      }
    }
  }

  return out;
}
