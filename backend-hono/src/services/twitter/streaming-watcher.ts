// [claude-code 2026-04-25] S40-P3: Twitter streaming watcher.
//   - Acquires one persistent Playwright page (separate from shared 4-page pool)
//   - Logs in once with TP-provided X account (env: X_BURNER_USER, X_BURNER_PASS, X_BURNER_TOTP)
//   - Navigates to a custom List containing the 12 production handles
//   - page.route() intercepts /i/api/graphql/*/UserTweets and HomeLatestTimeline
//   - On response → parses JSON, extracts new tweets (dedup by tweet_id), pushes to ring buffer
//   - Heartbeat every 60s; if no XHR observed in 5 min → DEGRADED state
//
// State machine:
//   HEALTHY    → primary observing XHR
//   DEGRADED   → primary stale > 5min → fallback engages + notifySuperadmins
//   RECOVERING → reconnect attempt every 60s; 3 consecutive XHR → HEALTHY
//   DEAD       → 30+ consecutive failed reconnects → notifySuperadmins (manual intervention)
//
// Burner X account credentials live in 1Password (TP). NEVER LOG THEM.

import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { createLogger } from "../../lib/logger.js";
import { notifySuperadmins } from "../notifications/notify-superadmins.js";
import { NEWS_WORKER_CONTRACT } from "../../workers/news-worker/contract.js";
import {
  createSession as createBrowserbaseSession,
  endSession as endBrowserbaseSession,
  isBrowserbaseAvailable,
} from "../browserbase/client.js";
import type { TwitterStreamState, TwitterTweet } from "./types.js";

const log = createLogger("TwitterStreaming");

const X_LIST_URL =
  process.env.X_BURNER_LIST_URL ?? "https://x.com/i/lists/0"; // TP supplies the real list ID via env
const SESSION_HEARTBEAT_MS = 60_000;
const STALE_THRESHOLD_MS = 5 * 60_000;
const HEALTHY_CONSECUTIVE_THRESHOLD = 3;

interface WatcherInternal {
  browser: Browser | null;
  context: BrowserContext | null;
  page: Page | null;
  state: TwitterStreamState;
  lastXhrAt: number;
  consecutiveXhr: number;
  consecutiveReconnectFailures: number;
  ringBuffer: Map<string, TwitterTweet>;
  startedAt: number;
  heartbeatTimer: NodeJS.Timeout | null;
  deadAlertSent: boolean;
}

const watcher: WatcherInternal = {
  browser: null,
  context: null,
  page: null,
  state: "healthy",
  lastXhrAt: 0,
  consecutiveXhr: 0,
  consecutiveReconnectFailures: 0,
  ringBuffer: new Map(),
  startedAt: 0,
  heartbeatTimer: null,
  deadAlertSent: false,
};

const RING_BUFFER_MAX = 1000;

function ringPut(tweet: TwitterTweet): void {
  if (watcher.ringBuffer.has(tweet.id)) return;
  watcher.ringBuffer.set(tweet.id, tweet);
  if (watcher.ringBuffer.size > RING_BUFFER_MAX) {
    const firstKey = watcher.ringBuffer.keys().next().value;
    if (firstKey) watcher.ringBuffer.delete(firstKey);
  }
}

export function getStreamingState(): TwitterStreamState {
  return watcher.state;
}

export function drainNewTweets(handles: string[]): TwitterTweet[] {
  const handleSet = new Set(handles.map((h) => h.toLowerCase()));
  const out: TwitterTweet[] = [];
  for (const t of watcher.ringBuffer.values()) {
    if (handleSet.has(t.username.toLowerCase())) {
      out.push(t);
    }
  }
  // We don't drain on read — letting items live for the next caller for
  // ~minutes prevents the cache from showing different items to two callers
  // racing. Items age out via RING_BUFFER_MAX + the periodic dedup pass.
  return out;
}

interface UserTweetsXhrPayload {
  data?: {
    user?: {
      result?: {
        timeline_v2?: { timeline?: { instructions?: any[] } };
        timeline?: { timeline?: { instructions?: any[] } };
      };
    };
  };
}

function extractTweetsFromUserTweets(payload: UserTweetsXhrPayload): TwitterTweet[] {
  const tweets: TwitterTweet[] = [];
  const instructions =
    payload?.data?.user?.result?.timeline_v2?.timeline?.instructions ??
    payload?.data?.user?.result?.timeline?.timeline?.instructions ??
    [];

  for (const inst of instructions) {
    const entries = inst.entries ?? (inst.entry ? [inst.entry] : []);
    for (const entry of entries) {
      const tweet = entry?.content?.itemContent?.tweet_results?.result;
      if (!tweet || tweet.__typename === "TweetTombstone") continue;
      try {
        const legacy = tweet.legacy ?? tweet.tweet?.legacy;
        const core =
          tweet.core?.user_results?.result?.legacy ??
          tweet.tweet?.core?.user_results?.result?.legacy;
        if (!legacy || !core) continue;
        const id = String(tweet.rest_id ?? legacy.id_str);
        const username = String(core.screen_name);
        tweets.push({
          id,
          text: String(legacy.full_text ?? legacy.text ?? ""),
          username,
          displayName: String(core.name ?? username),
          publishedAt: new Date(legacy.created_at).toISOString(),
          url: `https://x.com/${username}/status/${id}`,
          isRetweet: Boolean(legacy.retweeted_status_result),
          inReplyToId: legacy.in_reply_to_status_id_str ?? null,
        });
      } catch {
        // ignore malformed entries
      }
    }
  }
  return tweets;
}

async function attachInterceptor(page: Page): Promise<void> {
  page.on("response", async (res) => {
    try {
      const url = res.url();
      if (!/\/i\/api\/graphql\/[^/]+\/(UserTweets|HomeLatestTimeline)/.test(url)) {
        return;
      }
      const ct = res.headers()["content-type"] ?? "";
      if (!ct.includes("application/json")) return;
      const json = (await res.json().catch(() => null)) as
        | UserTweetsXhrPayload
        | null;
      if (!json) return;
      watcher.lastXhrAt = Date.now();
      watcher.consecutiveXhr += 1;
      const tweets = extractTweetsFromUserTweets(json);
      for (const t of tweets) ringPut(t);
      if (
        watcher.state === "recovering" &&
        watcher.consecutiveXhr >= HEALTHY_CONSECUTIVE_THRESHOLD
      ) {
        await onRecover();
      }
    } catch (err) {
      log.warn("XHR interceptor threw (ignored)", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });
}

async function loginIfNeeded(page: Page): Promise<boolean> {
  const user = process.env.X_BURNER_USER;
  const pass = process.env.X_BURNER_PASS;
  if (!user || !pass) {
    log.warn("X_BURNER_USER / X_BURNER_PASS missing — login skipped");
    return false;
  }

  // The X login flow is fragile against UI changes. We only sketch the happy
  // path here; in production TP will paste a long-lived auth_token cookie via
  // X_RETTIWT_COOKIES + we'll inject it at context-creation time instead of
  // typing through the form.
  try {
    await page.goto("https://x.com/login", { waitUntil: "networkidle" });
    await page.fill('input[name="text"]', user);
    await page.click('button:has-text("Next")');
    await page.fill('input[name="password"]', pass);
    await page.click('button:has-text("Log in")');
    // 2FA: if X_BURNER_TOTP is set, use it
    const totp = process.env.X_BURNER_TOTP;
    if (totp) {
      try {
        await page.fill('input[name="text"]', totp, { timeout: 5_000 });
        await page.click('button:has-text("Next")');
      } catch {
        /* no TOTP prompt */
      }
    }
    await page.waitForURL(/x\.com\/home/i, { timeout: 30_000 });
    return true;
  } catch (err) {
    log.warn("X login flow failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}

let browserbaseSessionId: string | null = null;

async function bootSession(): Promise<boolean> {
  // [S40-P3] Browserbase preferred when credentialed — connectUrl is a CDP
  // endpoint we can hand to chromium.connectOverCDP. Falls back to local
  // headless Chromium when Browserbase is unavailable (dev / no key).
  if (!watcher.browser || !watcher.browser.isConnected()) {
    if (isBrowserbaseAvailable()) {
      const bb = await createBrowserbaseSession();
      if (bb && bb.connectUrl) {
        try {
          watcher.browser = await chromium.connectOverCDP(bb.connectUrl);
          browserbaseSessionId = bb.id;
          log.info("Streaming over Browserbase", { sessionId: bb.id });
        } catch (err) {
          log.warn("Browserbase connectOverCDP failed; falling back to local", {
            error: err instanceof Error ? err.message : String(err),
          });
          if (bb.id) await endBrowserbaseSession(bb.id).catch(() => {});
          browserbaseSessionId = null;
        }
      }
    }
    if (!watcher.browser || !watcher.browser.isConnected()) {
      watcher.browser = await chromium.launch({
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-blink-features=AutomationControlled",
          "--disable-dev-shm-usage",
        ],
      });
    }
  }
  // Browserbase sessions ship with their own context — when CDP-connected, the
  // first existing context is the one to use. Locally we create a fresh one.
  const existingContexts = watcher.browser.contexts();
  watcher.context =
    existingContexts.length > 0
      ? existingContexts[0]
      : await watcher.browser.newContext({
          viewport: { width: 1280, height: 900 },
        });

  // Cookie injection path (preferred over UI login). X_AUTH_COOKIES is a JSON
  // array shaped like [{name, value, domain: ".x.com", path: "/", ...}].
  const rawCookies = process.env.X_AUTH_COOKIES;
  if (rawCookies) {
    try {
      const cookies = JSON.parse(rawCookies);
      if (Array.isArray(cookies)) {
        await watcher.context.addCookies(cookies);
        log.info("Injected X auth cookies", { count: cookies.length });
      }
    } catch (err) {
      log.warn("X_AUTH_COOKIES parse failed", { error: String(err) });
    }
  }

  watcher.page = await watcher.context.newPage();
  await attachInterceptor(watcher.page);

  // If cookies were injected this is a no-op; otherwise attempt UI login.
  await loginIfNeeded(watcher.page);

  await watcher.page.goto(X_LIST_URL, { waitUntil: "domcontentloaded" });
  watcher.startedAt = Date.now();
  watcher.lastXhrAt = Date.now();
  watcher.consecutiveXhr = 0;
  return true;
}

async function tearDown(): Promise<void> {
  try {
    if (watcher.page && !watcher.page.isClosed()) await watcher.page.close();
  } catch {
    /* ignore */
  }
  watcher.page = null;
  try {
    if (watcher.context) await watcher.context.close();
  } catch {
    /* ignore */
  }
  watcher.context = null;
  // [S40-P3] Release the Browserbase session if we hold one — local Chromium
  // we leave alive across reconnects so the cookie jar persists.
  if (browserbaseSessionId) {
    await endBrowserbaseSession(browserbaseSessionId).catch(() => {});
    browserbaseSessionId = null;
  }
}

async function onDegrade(): Promise<void> {
  if (watcher.state === "degraded" || watcher.state === "dead") return;
  watcher.state = "degraded";
  await notifySuperadmins({
    title: "Twitter primary degraded",
    body: "Twitter streaming watcher hasn't observed an XHR in >5 min. Fallback (rettiwt) is now active in parallel.",
    severity: "warn",
    source: "twitter-streaming",
  }).catch(() => {});
  log.warn("State → degraded");
}

async function onRecover(): Promise<void> {
  if (watcher.state === "healthy") return;
  watcher.state = "healthy";
  watcher.consecutiveReconnectFailures = 0;
  watcher.deadAlertSent = false;
  await notifySuperadmins({
    title: "Twitter primary restored",
    body: "Streaming watcher has 3+ consecutive XHRs. Falling back to streaming-only mode.",
    severity: "warn",
    source: "twitter-streaming",
  }).catch(() => {});
  log.info("State → healthy");
}

async function onDead(): Promise<void> {
  if (watcher.deadAlertSent) return;
  watcher.deadAlertSent = true;
  watcher.state = "dead";
  await notifySuperadmins({
    title: "Twitter primary DEAD — manual intervention required",
    body: `Streaming watcher: ${watcher.consecutiveReconnectFailures} consecutive reconnect failures (~30 min). Fallback running indefinitely. Burner account may be locked.`,
    severity: "critical",
    source: "twitter-streaming",
  }).catch(() => {});
  log.error("State → dead", {
    consecutiveFailures: watcher.consecutiveReconnectFailures,
  });
}

async function reconnectAttempt(): Promise<void> {
  watcher.state = "recovering";
  await tearDown();
  try {
    const ok = await bootSession();
    if (!ok) {
      watcher.consecutiveReconnectFailures += 1;
    } else {
      watcher.consecutiveReconnectFailures = 0;
    }
  } catch (err) {
    watcher.consecutiveReconnectFailures += 1;
    log.warn("Reconnect threw", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
  if (
    watcher.consecutiveReconnectFailures >=
    NEWS_WORKER_CONTRACT.DEAD_RECONNECT_ATTEMPTS
  ) {
    await onDead();
  }
}

async function heartbeat(): Promise<void> {
  const now = Date.now();
  const ageMs = now - watcher.lastXhrAt;
  if (watcher.state === "healthy" && ageMs > STALE_THRESHOLD_MS) {
    await onDegrade();
    return;
  }
  if (watcher.state === "degraded" || watcher.state === "recovering") {
    await reconnectAttempt();
  }
}

let started = false;

export async function startTwitterStreamingWatcher(): Promise<void> {
  if (started) return;
  if (process.env.TWITTER_STREAMING_ENABLED === "false") {
    log.info("Disabled via TWITTER_STREAMING_ENABLED=false");
    return;
  }
  started = true;
  try {
    await bootSession();
  } catch (err) {
    log.warn("Initial boot threw", {
      error: err instanceof Error ? err.message : String(err),
    });
    watcher.state = "degraded";
  }
  watcher.heartbeatTimer = setInterval(() => {
    heartbeat().catch((err) =>
      log.warn("Heartbeat threw (swallowed)", { error: String(err) }),
    );
  }, SESSION_HEARTBEAT_MS);
  log.info("Started");
}

export async function stopTwitterStreamingWatcher(): Promise<void> {
  if (!started) return;
  started = false;
  if (watcher.heartbeatTimer) clearInterval(watcher.heartbeatTimer);
  watcher.heartbeatTimer = null;
  await tearDown();
  if (watcher.browser && watcher.browser.isConnected()) {
    await watcher.browser.close().catch(() => {});
  }
  watcher.browser = null;
}
