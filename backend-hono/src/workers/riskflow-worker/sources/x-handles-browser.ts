// [claude-code 2026-05-03] Hardened X auto-reauth flow: (1) clear stale x.com
// cookies before login attempt so X shows a clean login form instead of a broken
// session-expired page, (2) pre-flight auth check in fetchHomeTimeline detects
// login wall on first attempt and triggers re-auth immediately instead of waiting
// 3 cycles, (3) multi-strategy selectors for Next/Login buttons, (4) extract ct0
// alongside auth_token so persistent context re-launch has both, (5) challenge
// page handling (username verification step), (6) CAPTCHA/2FA detection in logs.
// [claude-code 2026-05-05] Fixed X collector timeout: proactive auth refresh moved
// AFTER timeline fetch (was blocking collection cycle, eating the 90s safeCollect
// window). Login timeout reduced 90s→60s. Timeline fetch runs first with existing
// auth; refresh fires in background for next cycle. Reactive re-auth only on failure.

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
  isDisallowedRepostOrRetweet,
} from "./handle-routing.js";

const SYNDICATION_BASE = "https://syndication.twitter.com";
const FETCH_TIMEOUT_MS = 12_000;
const MAX_TWEETS_TOTAL = 60;
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
const HOME_SCROLL_COUNT = 8;
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36";

const DEFAULT_PROACTIVE_REFRESH_MS = 6 * 60 * 60 * 1000; // 6h
const AUTH_PROACTIVE_REFRESH_MS = Number(
  process.env.X_AUTH_REFRESH_INTERVAL_MS ?? DEFAULT_PROACTIVE_REFRESH_MS,
);

interface ExtractedTweet {
  tweet_id: string;
  text: string;
  timestamp: string;
  permalink: string;
  author_handle: string;
  image_url?: string | null;
  image_urls?: string[] | null;
  video_url?: string | null;
  pipeline_tag?: string;
}

interface XLoginCredential {
  email: string;
  password: string;
  username?: string;
  altEmail?: string;
  label: string;
}

interface CredentialHealth {
  failures: number;
  cooldownUntil: number;
}

function stripHandle(h: string): string {
  return h.replace(/^@/, "").trim();
}

function normalizeTweetText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function isGuardrailRejected(text: string): boolean {
  const t = text.toLowerCase();
  // Keep this narrow: drop only obvious joke/meme/noise patterns.
  if (
    /\b(lol|lmao|haha|meme|joke|shitpost|nostalgia|you had to be there)\b/.test(
      t,
    )
  )
    return true;
  return false;
}

function isStrictPromoRejected(text: string): boolean {
  const t = text.toLowerCase();
  // Aggressive ad/promo filtering for source pull quality.
  const promoPatterns = [
    /\b(promoted|sponsored|paid partnership|ad:|advertisement)\b/i,
    /\b(sign up|subscribe|free trial|join now|use code|coupon|promo code)\b/i,
    /\b(not financial advice|nfa)\b/i,
    /\b(discord\.gg|t\.me\/|patreon|substack\.com\/subscribe)\b/i,
    /\b(affiliate|referral|partner link)\b/i,
    /\b(shop now|buy now|limited time offer)\b/i,
  ];
  return promoPatterns.some((re) => re.test(t));
}

function sanitizeTweetBody(text: string): string {
  let s = text;
  // Remove @mentions from body per formatting requirement.
  s = s.replace(/(^|\s)@[A-Za-z0-9_]{1,20}\b/g, " ");
  // Remove engagement/metric tails that occasionally bleed into innerText.
  s = s.replace(
    /\b\d+(\.\d+)?\s*(k|m)?\s*(views?|likes?|repl(?:y|ies)|reposts?|bookmarks?)\b/gi,
    " ",
  );
  s = s.replace(/\b(show more|replying to|quote)\b/gi, " ");
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

function extractHandleFromPermalink(href: string): string | null {
  // e.g. /FinancialJuice/status/123 or https://x.com/FinancialJuice/status/123
  const match = href.match(/\/([^/]+)\/status\/\d+/);
  return match ? stripHandle(match[1]) : null;
}

function parseAccountLabel(raw: string, fallback: string): string {
  if (!raw) return fallback;
  return raw.replace(/\s+/g, " ").trim() || fallback;
}

function parseAuthAccountsFromJson(raw: string): XLoginCredential[] {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    const out: XLoginCredential[] = [];
    parsed.forEach((entry, idx) => {
      if (!entry || typeof entry !== "object") return null;
      const obj = entry as Record<string, unknown>;
      const email =
        typeof obj.email === "string"
          ? obj.email.trim()
          : typeof obj.x_email === "string"
            ? obj.x_email.trim()
            : "";
      const password =
        typeof obj.password === "string"
          ? obj.password.trim()
          : typeof obj.x_password === "string"
            ? obj.x_password.trim()
            : "";
      const username =
        typeof obj.username === "string"
          ? obj.username.trim()
          : typeof obj.x_username === "string"
            ? obj.x_username.trim()
            : "";
      const altEmail =
        typeof obj.altEmail === "string"
          ? obj.altEmail.trim()
          : typeof obj.alt_email === "string"
            ? obj.alt_email.trim()
            : typeof obj.x_alt_email === "string"
              ? obj.x_alt_email.trim()
              : "";
      const loginIdentity = username || email;
      if (!loginIdentity || !password) return null;
      const labelRaw =
        typeof obj.label === "string"
          ? obj.label
          : typeof obj.name === "string"
            ? obj.name
            : loginIdentity;
      const cred: XLoginCredential = {
        email: loginIdentity,
        password,
        label: parseAccountLabel(labelRaw, `acct-${idx + 1}`),
      };
      if (username) cred.username = username;
      if (altEmail) cred.altEmail = altEmail;
      out.push(cred);
      return null;
    });
    return out;
  } catch {
    return [];
  }
}

function parseUsernamePassAccounts(raw: string): XLoginCredential[] {
  if (!raw.trim()) return [];
  const parts = raw
    .split(/\n|,/)
    .map((s) => s.trim())
    .filter(Boolean);
  const out: XLoginCredential[] = [];
  for (const [idx, part] of parts.entries()) {
    const sep = part.indexOf(":");
    if (sep <= 0) continue;
    const usernameRaw = part.slice(0, sep).trim().replace(/^@/, "");
    const password = part.slice(sep + 1).trim();
    if (!usernameRaw || !password) continue;
    out.push({
      email: usernameRaw, // login identity can be username on X
      username: usernameRaw,
      password,
      label: `acct-${idx + 1}:${usernameRaw}`,
    });
  }
  return out;
}

function getXLoginCredentials(): XLoginCredential[] {
  const fromPairs = parseUsernamePassAccounts(
    process.env.X_AUTH_ACCOUNTS?.trim() ??
      process.env.X_USERNAME_PASS_ACCOUNTS?.trim() ??
      "",
  );
  if (fromPairs.length > 0) return fromPairs;

  const fromJson = parseAuthAccountsFromJson(
    process.env.X_AUTH_ACCOUNTS_JSON?.trim() ??
      process.env.X_ACCOUNTS_JSON?.trim() ??
      "",
  );
  if (fromJson.length > 0) return fromJson;

  const email =
    process.env.X_EMAIL?.trim() ?? process.env.X_USERNAME?.trim() ?? "";
  const password = process.env.X_PASSWORD?.trim() ?? "";
  if (!email || !password) return [];

  return [
    {
      email,
      password,
      username: process.env.X_USERNAME?.trim() || undefined,
      altEmail: process.env.X_ALT_EMAIL?.trim() || undefined,
      label: parseAccountLabel(process.env.X_ACCOUNT_LABEL ?? email, "acct-1"),
    },
  ];
}

function maskEmail(email: string): string {
  if (!email) return "***";
  const [name, domain] = email.split("@");
  const n = (name || "").slice(0, 2);
  const d = domain ? `@${domain}` : "";
  return `${n || "**"}***${d}`;
}

// Home timeline cache — shared across tiers within the same cycle window

let homeTimelineCache: { tweets: ExtractedTweet[]; at: number } | null = null;
const HOME_CACHE_TTL_MS = 15_000; // 15s — bust fast so each cycle re-scrapes for new tweets

// Auth expiry detection — consecutive empty cycles means the token likely expired
let consecutiveEmptyCycles = 0;
const AUTH_EXPIRY_THRESHOLD = 3;
let loginInProgress = false;
let loginStartedAt = 0;
const LOGIN_TIMEOUT_MS = 60_000; // keep below safeCollect window so timeline fetch has headroom

let loginAccountCursor = 0;
const credentialHealth = new Map<string, CredentialHealth>();
let lastSuccessfulLoginAt = 0;
let lastLoginAccountLabel = "";

function shouldRefreshAuthProactively(): boolean {
  if (
    !Number.isFinite(AUTH_PROACTIVE_REFRESH_MS) ||
    AUTH_PROACTIVE_REFRESH_MS <= 0
  ) {
    return false;
  }
  if (lastSuccessfulLoginAt === 0) return false;
  return Date.now() - lastSuccessfulLoginAt >= AUTH_PROACTIVE_REFRESH_MS;
}

function getAccountHealthKey(cred: XLoginCredential): string {
  return cred.email.toLowerCase();
}

function getAccountHealth(cred: XLoginCredential): CredentialHealth {
  const key = getAccountHealthKey(cred);
  const existing = credentialHealth.get(key);
  if (existing) return existing;
  const created = { failures: 0, cooldownUntil: 0 };
  credentialHealth.set(key, created);
  return created;
}

function markAccountFailure(cred: XLoginCredential): void {
  const h = getAccountHealth(cred);
  h.failures += 1;
  // Exponential-ish backoff capped at 15 minutes.
  const cooldownMs = Math.min(15 * 60_000, 60_000 * Math.max(1, h.failures));
  h.cooldownUntil = Date.now() + cooldownMs;
}

function markAccountSuccess(cred: XLoginCredential): void {
  const h = getAccountHealth(cred);
  h.failures = 0;
  h.cooldownUntil = 0;
}

function orderCredentialsForAttempt(
  creds: XLoginCredential[],
): XLoginCredential[] {
  if (creds.length <= 1) return creds;
  const now = Date.now();
  const available: XLoginCredential[] = [];
  const cooling: XLoginCredential[] = [];

  const start = loginAccountCursor % creds.length;
  for (let i = 0; i < creds.length; i++) {
    const idx = (start + i) % creds.length;
    const cred = creds[idx];
    const h = getAccountHealth(cred);
    if (h.cooldownUntil > now) cooling.push(cred);
    else available.push(cred);
  }

  return available.length > 0 ? available : cooling;
}

async function attemptLoginWithCredential(
  cred: XLoginCredential,
): Promise<boolean> {
  const prevAuthToken = process.env.X_AUTH_TOKEN;
  const prevCt0Token = process.env.X_CT0_TOKEN;
  // Prevent persistent context bootstrap from re-injecting stale cookies.
  process.env.X_AUTH_TOKEN = "";
  process.env.X_CT0_TOKEN = "";

  let loginSucceeded = false;

  try {
    return await Promise.race<boolean>([
      withPersistentBrowserPage(async (page) => {
        // Clear x.com cookies first — stale auth_token from context launch
        // can cause X to show a broken session-expired page instead of login.
        const ctx = page.context();
        const preCookies = await ctx.cookies("https://x.com");
        if (preCookies.length > 0) {
          await ctx.clearCookies({ domain: ".x.com" });
          console.log(
            JSON.stringify({
              ts: new Date().toISOString(),
              service: "riskflow-worker",
              stage: "x_login_cleared_cookies",
              count: preCookies.length,
              account: cred.label,
            }),
          );
        }

        // Navigate to login.
        await page.goto("https://x.com/login", {
          waitUntil: "domcontentloaded",
          timeout: 30_000,
        });
        await page.waitForTimeout(3_000);

        // If X serves the transient error shell, retry before attempting login.
        for (let attempt = 0; attempt < 3; attempt++) {
          const shellText = await page.evaluate(() =>
            document.body.innerText.slice(0, 800),
          );
          if (!/\bsomething went wrong\b/i.test(shellText)) break;
          const retryBtn = page
            .locator(
              '[role="button"]:has-text("Retry"), button:has-text("Retry")',
            )
            .first();
          if (await retryBtn.isVisible({ timeout: 1_500 }).catch(() => false)) {
            await retryBtn.click().catch(() => undefined);
          } else {
            await page
              .reload({ waitUntil: "domcontentloaded" })
              .catch(() => undefined);
          }
          await page.waitForTimeout(2_000);
        }

        // Detect if we actually landed on a login page.
        const pageText = await page.evaluate(() =>
          document.body.innerText.slice(0, 800),
        );

        // X now serves a two-step flow: sign-up shell first, "Sign in" link to
        // reach the actual login form. Click "Sign in" if it's present.
        const signInLink = page
          .locator(
            'a[href*="login"]:has-text("Sign in"), [role="button"]:has-text("Sign in"), span:has-text("Sign in")',
          )
          .first();
        const signInVisible = await signInLink
          .isVisible({ timeout: 2_000 })
          .catch(() => false);
        if (signInVisible) {
          await signInLink.click().catch(() => undefined);
          await page.waitForTimeout(3_000);
        }

        const loginPageText = await page.evaluate(() =>
          document.body.innerText.slice(0, 800),
        );
        const hasLoginForm =
          /\b(sign in to x|log in to x|phone, email, or username|enter your (phone|password|email))\b/i.test(
            loginPageText,
          ) && !/\bsomething went wrong\b/i.test(loginPageText);
        if (!hasLoginForm) {
          console.error(
            JSON.stringify({
              ts: new Date().toISOString(),
              service: "riskflow-worker",
              stage: "x_login_no_form",
              account: cred.label,
              currentUrl: page.url(),
              pagePreview: loginPageText.slice(0, 250),
            }),
          );
          return false;
        }

        const identityCandidates = [
          cred.username,
          cred.altEmail,
          cred.email,
        ].filter((v): v is string => Boolean(v && v.length > 0));
        const usernameInput = page
          .locator(
            'input[autocomplete="username"], input[name="text"], input[type="text"]',
          )
          .first();
        const nextButton = page
          .locator(
            '[role="button"]:has-text("Next"), button:has-text("Next"), div[role="button"]:has-text("Next")',
          )
          .first();
        const passwordInput = page
          .locator('input[type="password"], input[name="password"]')
          .first();

        if (
          await usernameInput.isVisible({ timeout: 6_000 }).catch(() => false)
        ) {
          for (const identity of identityCandidates) {
            await usernameInput.click().catch(() => undefined);
            await usernameInput.fill("");
            await usernameInput.type(identity, { delay: 75 });
            await page.waitForTimeout(300);
            if (
              await nextButton.isVisible({ timeout: 2_000 }).catch(() => false)
            ) {
              await nextButton.click().catch(() => undefined);
            } else {
              await usernameInput.press("Enter").catch(() => undefined);
            }
            await page.waitForTimeout(2_500);
            if (
              await passwordInput.isVisible({ timeout: 800 }).catch(() => false)
            ) {
              break;
            }
            // If flow reset to shell, continue with next identity candidate.
            if ((await page.url()).includes("/i/flow/login")) {
              const currentText = await page.evaluate(() =>
                document.body.innerText.slice(0, 250),
              );
              if (
                /\b(happening now|join today)\b/i.test(currentText) &&
                /\bphone, email, or username\b/i.test(currentText)
              ) {
                continue;
              }
            }
          }
        }

        const afterNextText = await page.evaluate(() =>
          document.body.innerText.slice(0, 300),
        );
        const stillOnUsernameStep = /\b(phone, email, or username)\b/i.test(
          afterNextText,
        );
        console.log(
          JSON.stringify({
            ts: new Date().toISOString(),
            service: "riskflow-worker",
            stage: "x_login_after_next",
            account: cred.label,
            currentUrl: page.url(),
            stillOnUsernameStep,
            pagePreview: afterNextText.slice(0, 250),
            hasPasswordField:
              /\bpassword\b/i.test(afterNextText) &&
              !/\bforgot password\b/i.test(afterNextText),
          }),
        );

        // Handle unusual activity / phone verification challenge if shown.
        const challengeText = await page.evaluate(() =>
          document.body.innerText.slice(0, 300),
        );
        if (
          /\b(verify|unusual|challenge|phone|username)\b/i.test(challengeText)
        ) {
          // X may ask to verify the username before showing password.
          const verifyInput = page
            .locator(
              'input[autocomplete="on"], input[name="text"], input[type="text"]',
            )
            .first();
          if (
            await verifyInput.isVisible({ timeout: 1_000 }).catch(() => false)
          ) {
            const verifyValue = await verifyInput.inputValue();
            if (!verifyValue) {
              await verifyInput.fill(
                cred.username ?? cred.altEmail ?? cred.email ?? "",
              );
              await page.waitForTimeout(500);
              await verifyInput.press("Enter").catch(() => undefined);
              const verifyBtns = page
                .locator(
                  '[role="button"]:has-text("Next"), [role="button"]:has-text("next"), button:has-text("Next")',
                )
                .first();
              if (
                await verifyBtns
                  .isVisible({ timeout: 1_000 })
                  .catch(() => false)
              ) {
                await verifyBtns.click();
                await page.waitForTimeout(2_500);
              }
            }
          }
        }

        // Fill password.
        if (
          await passwordInput.isVisible({ timeout: 3_000 }).catch(() => false)
        ) {
          await passwordInput.fill(cred.password);
          await page.waitForTimeout(800);

          // Click Log in.
          const loginButton = page
            .locator(
              '[role="button"]:has-text("Log in"), [role="button"]:has-text("Sign in"), button:has-text("Log in"), button:has-text("Sign in")',
            )
            .first();
          if (
            await loginButton.isVisible({ timeout: 3_000 }).catch(() => false)
          ) {
            await loginButton.click();
            await page.waitForTimeout(6_000);
          }
        }

        // Check if login succeeded — any X home/feed URL means we're in.
        const currentUrl = page.url();
        const loggedIn =
          currentUrl.includes("x.com/home") ||
          currentUrl === "https://x.com/" ||
          currentUrl === "https://x.com" ||
          currentUrl === "https://twitter.com/" ||
          currentUrl === "https://twitter.com";

        if (loggedIn) {
          // Extract auth_token and ct0 cookies.
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
                account: cred.label,
                tokenPrefix: authToken.value.slice(0, 8) + "...",
                hasCt0: Boolean(ct0?.value),
              }),
            );
            loginSucceeded = true;
            return true;
          }
        }

        // 2FA, CAPTCHA, or other roadblock.
        const finalText = await page.evaluate(() =>
          document.body.innerText.slice(0, 500),
        );
        console.error(
          JSON.stringify({
            ts: new Date().toISOString(),
            service: "riskflow-worker",
            stage: "x_login_failed",
            account: cred.label,
            currentUrl,
            pagePreview: finalText.slice(0, 250),
            has2fa:
              /\b(authenticator|verification code|two.factor|2FA|confirm your identity)\b/i.test(
                finalText,
              ),
            hasCaptcha:
              /\b(captcha|prove you|not a robot|verify you are human)\b/i.test(
                finalText,
              ),
          }),
        );
        return false;
      }),
      new Promise<boolean>((_, reject) =>
        setTimeout(() => reject(new Error("LOGIN_TIMEOUT")), LOGIN_TIMEOUT_MS),
      ),
    ]);
  } catch (err) {
    console.error(
      JSON.stringify({
        ts: new Date().toISOString(),
        service: "riskflow-worker",
        stage: "x_login_error",
        account: cred.label,
        error: err instanceof Error ? err.message : String(err),
      }),
    );
    return false;
  } finally {
    if (!loginSucceeded) {
      process.env.X_AUTH_TOKEN = prevAuthToken;
      process.env.X_CT0_TOKEN = prevCt0Token;
    }
  }
}

export async function attemptXLogin(): Promise<boolean> {
  // If a previous login attempt is still running, check if it's timed out.
  if (loginInProgress) {
    if (Date.now() - loginStartedAt > LOGIN_TIMEOUT_MS + 10_000) {
      loginInProgress = false; // force-reset stale flag
      console.log(
        JSON.stringify({
          ts: new Date().toISOString(),
          service: "riskflow-worker",
          stage: "x_login_stale_reset",
          elapsedMs: Date.now() - loginStartedAt,
        }),
      );
    } else {
      return false;
    }
  }

  const credentials = getXLoginCredentials();
  if (credentials.length === 0) {
    console.warn(
      JSON.stringify({
        ts: new Date().toISOString(),
        service: "riskflow-worker",
        stage: "x_login_skipped",
        reason:
          "No X login credentials found. Set X_AUTH_ACCOUNTS_JSON (preferred) or X_EMAIL/X_PASSWORD.",
      }),
    );
    return false;
  }

  loginInProgress = true;
  loginStartedAt = Date.now();

  try {
    const ordered = orderCredentialsForAttempt(credentials);
    console.log(
      JSON.stringify({
        ts: new Date().toISOString(),
        service: "riskflow-worker",
        stage: "x_login_attempt",
        accountCount: credentials.length,
        refreshMode: shouldRefreshAuthProactively() ? "proactive" : "reactive",
      }),
    );

    for (const cred of ordered) {
      const health = getAccountHealth(cred);
      const cooldownLeft = Math.max(0, health.cooldownUntil - Date.now());
      console.log(
        JSON.stringify({
          ts: new Date().toISOString(),
          service: "riskflow-worker",
          stage: "x_login_account_try",
          account: cred.label,
          emailMasked: maskEmail(cred.email),
          priorFailures: health.failures,
          cooldownLeftMs: cooldownLeft,
        }),
      );

      const ok = await attemptLoginWithCredential(cred);
      if (ok) {
        markAccountSuccess(cred);
        lastSuccessfulLoginAt = Date.now();
        lastLoginAccountLabel = cred.label;
        loginAccountCursor =
          (credentials.indexOf(cred) + 1) % credentials.length;
        consecutiveEmptyCycles = 0;
        return true;
      }

      markAccountFailure(cred);
    }

    console.error(
      JSON.stringify({
        ts: new Date().toISOString(),
        service: "riskflow-worker",
        stage: "x_login_all_accounts_failed",
        accountCount: credentials.length,
      }),
    );
    return false;
  } finally {
    loginInProgress = false;
  }
}

async function checkXAuth(page: import("playwright").Page): Promise<boolean> {
  const url = page.url();
  const bodyText = await page.evaluate(() =>
    document.body.innerText.slice(0, 800),
  );
  const isLoginPage =
    /\b(sign in to x|log in to x|sign up for x|join x today)\b/i.test(
      bodyText,
    ) || /\bDon.t have an account\?.*Sign up\b/i.test(bodyText);
  if (isLoginPage) return false;
  const isLoggedOutShell =
    /\b(Welcome to X|See what.s happening|Don.t miss what.s happening|Sign in to see|Happening now)\b/i.test(
      bodyText,
    );
  if (isLoggedOutShell) return false;
  const isErrorPage =
    /\bsomething went wrong\b/i.test(bodyText) ||
    /\bthis page isn.t available\b/i.test(bodyText) ||
    /\bTry reloading\b/i.test(bodyText);
  if (
    url.includes("x.com/home") ||
    url === "https://x.com/" ||
    url === "https://x.com"
  ) {
    if (isErrorPage) return false;
    return true;
  }
  const hasTweets = await page.evaluate(
    () => document.querySelectorAll("article").length > 0,
  );
  return hasTweets;
}

async function fetchHomeTimeline(): Promise<ExtractedTweet[]> {
  if (
    homeTimelineCache &&
    Date.now() - homeTimelineCache.at < HOME_CACHE_TTL_MS
  ) {
    return homeTimelineCache.tweets;
  }

  // Scrape with existing auth cookies first.
  let result = await scrapeHomeTimeline();

  if (result && result.length > 0) {
    homeTimelineCache = { tweets: result, at: Date.now() };
    consecutiveEmptyCycles = 0;
    return result;
  }

  // Reactive re-auth on empty timeline — attempt login with X_EMAIL/X_PASSWORD
  // and retry the scrape once.
  if (consecutiveEmptyCycles >= 3) {
    const reAuthed = await attemptXLogin();
    if (reAuthed) {
      result = await scrapeHomeTimeline();
      if (result && result.length > 0) {
        homeTimelineCache = { tweets: result, at: Date.now() };
        consecutiveEmptyCycles = 0;
        return result;
      }
    }
  }

  consecutiveEmptyCycles++;
  return [];
}

/** Pure home-timeline scrape — no auth refresh logic. */
async function scrapeHomeTimeline(): Promise<ExtractedTweet[] | null> {
  try {
    return await withPersistentBrowserPage(async (page) => {
      await page.goto("https://x.com/home", {
        waitUntil: "domcontentloaded",
        timeout: 45_000,
      });
      await page.waitForTimeout(3_000);

      const isAuthenticated = await checkXAuth(page);
      if (!isAuthenticated) {
        console.log(
          JSON.stringify({
            ts: new Date().toISOString(),
            service: "riskflow-worker",
            stage: "home_timeline_not_authenticated",
            message: "Login wall — skipping, no re-auth attempt",
          }),
        );
        return [];
      }

      // Always read from Following tab
      const followingSelected = await page.evaluate(() => {
        const tabs = Array.from(
          document.querySelectorAll(
            '[role="tab"], a[href*="following"], [data-testid="ScrollSnap-List"] [role="link"]',
          ),
        ) as HTMLElement[];
        const following = tabs.find((el) =>
          /\bfollowing\b/i.test((el.textContent || "").trim()),
        );
        if (!following) return false;
        const alreadySelected =
          following.getAttribute("aria-selected") === "true";
        if (!alreadySelected) following.click();
        return true;
      });
      if (followingSelected) {
        await page.waitForTimeout(2_000);
      }

      for (let i = 0; i < HOME_SCROLL_COUNT; i++) {
        await page.mouse.wheel(0, 1600);
        await page.waitForTimeout(800);
      }

      const rawRows = await page.evaluate(() => {
        function normalizeMediaUrl(
          raw: string | null | undefined,
        ): string | null {
          if (!raw) return null;
          const first = raw.split(",")[0]?.trim().split(/\s+/)[0]?.trim();
          if (!first) return null;
          if (!/^https?:\/\//i.test(first)) return null;
          if (
            /profile_images|profile_banners|emoji\/v2|abs-0\.twimg\.com/i.test(
              first,
            )
          ) {
            return null;
          }
          return first;
        }

        function extractBestImg(article: Element): string | null {
          const selectors = [
            "[data-testid='tweetPhoto'] img",
            "a[href*='/photo/'] img",
            "[data-testid='card.wrapper'] img",
            "img[src*='pbs.twimg.com/media']",
            "img[src*='pbs.twimg.com/card_img']",
            "img[src*='pbs.twimg.com/amplify_video_thumb']",
            "img[src*='twimg.com/media']",
            "img[src*='twimg.com/card_img']",
            "img[src*='twimg.com/amplify_video_thumb']",
          ];

          let best: { score: number; url: string } | null = null;
          for (const sel of selectors) {
            const imgs = Array.from(
              article.querySelectorAll(sel),
            ) as HTMLImageElement[];
            for (const img of imgs) {
              const candidate =
                normalizeMediaUrl(img.currentSrc) ??
                normalizeMediaUrl(img.src) ??
                normalizeMediaUrl(img.getAttribute("data-src")) ??
                normalizeMediaUrl(img.getAttribute("srcset"));
              if (!candidate) continue;
              const width = img.naturalWidth || img.clientWidth || 0;
              const height = img.naturalHeight || img.clientHeight || 0;
              let score = 0;
              if (/media|card_img|amplify_video_thumb/i.test(candidate))
                score += 4;
              if (sel.includes("tweetPhoto") || sel.includes("/photo/"))
                score += 3;
              if (sel.includes("card.wrapper")) score += 2;
              if (width >= 180 || height >= 180) score += 1;
              if (!best || score > best.score) best = { score, url: candidate };
            }
          }

          const videoPoster = normalizeMediaUrl(
            (article.querySelector("video") as HTMLVideoElement | null)
              ?.poster ?? null,
          );
          if (best) return best.url;
          return videoPoster;
        }

        function extractBestVideo(article: Element): string | null {
          const videoEls = Array.from(
            article.querySelectorAll("video"),
          ) as HTMLVideoElement[];
          for (const ve of videoEls) {
            const direct = normalizeMediaUrl(ve.src);
            if (
              direct &&
              /video\.twimg\.com|twimg\.com|\.mp4($|\?)/i.test(direct)
            ) {
              return direct;
            }
            const sources = Array.from(
              ve.querySelectorAll("source"),
            ) as HTMLSourceElement[];
            for (const src of sources) {
              const u = normalizeMediaUrl(src.src);
              if (u && /video\.twimg\.com|twimg\.com|\.mp4($|\?)/i.test(u))
                return u;
            }
          }
          return null;
        }

        return Array.from(
          document.querySelectorAll("article[data-testid='tweet']"),
        ).flatMap((article) => {
          const articleText = (article as HTMLElement).innerText || "";
          if (
            /\b(promoted|sponsored|paid partnership|advertisement)\b/i.test(
              articleText,
            )
          ) {
            return [];
          }
          if (/\bPinned\b/i.test(articleText)) {
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
          const tweetTextEl = article.querySelector(
            "[data-testid='tweetText']",
          ) as HTMLElement | null;
          const tweetText = (tweetTextEl?.innerText || articleText)
            .replace(/\s+/g, " ")
            .replace(/\b(Show more|Quote|Replying to)\b/gi, "")
            .trim();
          const timestamp =
            article.querySelector("time")?.getAttribute("datetime") ?? "";
          const imageUrl = extractBestImg(article);
          const videoUrl = extractBestVideo(article);
          if (!tweetId || !tweetText || !timestamp) return [];
          if (
            tweetText.length < 15 ||
            /\b(?:sponsored|advert|promoted|paid partnership)\b/i.test(
              tweetText,
            ) ||
            /\b(?:sign up|subscribe|free trial|use code|coupon|promo code)\b/i.test(
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
        });
      });

      const seen = new Set<string>();
      const out: ExtractedTweet[] = [];
      for (const row of rawRows) {
        if (seen.has(row.tweetId)) continue;
        seen.add(row.tweetId);
        const handle = extractHandleFromPermalink(row.permalink) ?? "unknown";
        const bodyRaw = normalizeTweetText(row.text);
        if (!bodyRaw || bodyRaw.length < 15) continue;
        if (isStrictPromoRejected(bodyRaw)) continue;
        out.push({
          tweet_id: row.tweetId,
          text: bodyRaw,
          timestamp: row.timestamp,
          permalink: row.permalink,
          author_handle: handle,
          image_url: row.imageUrl ?? null,
          video_url: row.videoUrl ?? null,
          pipeline_tag: "x-home-timeline",
        });
        if (out.length >= MAX_TWEETS_TOTAL) break;
      }
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
    // Signal auth failure to caller so fetchHomeTimeline can trigger a refresh.
    if (errMsg === "X_AUTH_FAILED") return null;
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
      const imageUrls: string[] = [];
      if (Array.isArray(mediaArr) && mediaArr.length > 0) {
        for (const m of mediaArr) {
          const media = m as {
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
          if (typeof media?.media_url_https === "string") {
            imageUrls.push(media.media_url_https);
          }
          if (
            !videoUrl &&
            (media?.type === "video" || media?.type === "animated_gif") &&
            Array.isArray(media.video_info?.variants)
          ) {
            const mp4s = media.video_info!.variants!.filter(
              (v) =>
                v.content_type === "video/mp4" && typeof v.url === "string",
            );
            mp4s.sort((a, b) => (b.bitrate ?? 0) - (a.bitrate ?? 0));
            if (mp4s.length > 0 && mp4s[0].url) videoUrl = mp4s[0].url;
          }
        }
      }
      const imageUrl = imageUrls[0] ?? null;
      out.push({
        tweet_id: idStr,
        text: String(text),
        timestamp: Number.isFinite(ts)
          ? new Date(ts).toISOString()
          : String(created),
        permalink: `https://twitter.com/${cleanHandle}/status/${idStr}`,
        author_handle: cleanHandle,
        image_url: imageUrl,
        image_urls: imageUrls.length > 0 ? imageUrls : null,
        video_url: videoUrl,
        pipeline_tag: "syndication",
      });
      if (out.length >= 12) return;
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

  // Browser-pool based fetch (same method as standard tier)
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
    // continue to direct fetch fallback
  }

  // Fall back to direct HTTP fetch
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
    image_url: t.image_url ?? null,
    image_urls: t.image_urls ?? null,
    video_url: t.video_url ?? null,
    pipeline_tag: "xactions",
  }));
}

/** Collect tweets for a single handle via syndication (primary, no auth) + XActions fallback. */
async function collectTweetsViaApi(
  cleanHandle: string,
): Promise<ExtractedTweet[]> {
  // Try syndication first (fast, no auth needed for public tweets)
  const synd = await fetchSyndicationTweets(cleanHandle);
  if (synd.length > 0) return synd;

  // Fall back to XActions API (requires XACTIONS_API_BASE in env)
  return fetchXActionsTweets(cleanHandle);
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

  // Primary: browser-based home timeline → click Following → scrape.
  // Uses injected auth cookies only — no login automation.
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
    const allowedHandles = new Set(
      opts.handles.map(stripHandle).filter(Boolean),
    );
    for (const tw of homeTweets) {
      if (!allowedHandles.has(stripHandle(tw.author_handle))) continue;
      const routings = getRoutingForHandle(tw.author_handle);
      if (routings.length === 0) continue;
      const rawText = normalizeTweetText(tw.text);
      if (isDisallowedRepostOrRetweet(rawText, allowedHandles)) continue;
      const cleanText = sanitizeTweetBody(rawText);
      if (!cleanText || cleanText.length < 15) continue;
      const headline =
        cleanText.length > 220 ? cleanText.slice(0, 220) : cleanText;
      if (!scoreHeadline(headline)) continue;
      if (isGuardrailRejected(cleanText)) continue;
      if (isStrictPromoRejected(cleanText)) continue;
      for (const routing of routings) {
        if (!passesContentFilter(cleanText, routing.contentFilter)) continue;
        out.push({
          item_id: tw.tweet_id,
          source: `twitter:${tw.author_handle}`,
          source_domain: "x.com",
          headline,
          body: cleanText,
          url: tw.permalink,
          image_url: tw.image_url ?? null,
          image_urls: tw.image_urls ?? null,
          video_url: tw.video_url ?? null,
          tier: routing.tier,
          published_at: tw.timestamp || new Date().toISOString(),
          fetched_at: new Date().toISOString(),
          fetch_latency_ms: fetchLatency,
          ingest_pipeline: tw.pipeline_tag || "x-home-timeline",
        });
      }
    }
  } else {
    // Browser timeline empty — fall back to per-handle syndication API.
    console.log(
      JSON.stringify({
        ts: new Date().toISOString(),
        service: "riskflow-worker",
        stage: "x_api_collected",
        handles: opts.handles.length,
      }),
    );

    const apiTweets: ExtractedTweet[] = [];
    for (const handle of opts.handles) {
      try {
        const tweets = await collectTweetsViaApi(handle);
        apiTweets.push(...tweets);
      } catch {
        // continue
      }
    }

    console.log(
      JSON.stringify({
        ts: new Date().toISOString(),
        service: "riskflow-worker",
        stage: "x_api_collected_done",
        tweets: apiTweets.length,
        latency_ms: Date.now() - started,
      }),
    );

    for (const tw of apiTweets) {
      const cleanText = sanitizeTweetBody(tw.text);
      if (!cleanText || cleanText.length < 15) continue;
      if (!scoreHeadline(cleanText)) continue;
      if (isGuardrailRejected(cleanText)) continue;
      if (isStrictPromoRejected(cleanText)) continue;
      const routings = getRoutingForHandle(tw.author_handle);
      for (const routing of routings) {
        if (!passesContentFilter(cleanText, routing.contentFilter)) continue;
        out.push({
          item_id: tw.tweet_id,
          source: `twitter:${tw.author_handle}`,
          source_domain: "x.com",
          headline:
            cleanText.length > 220 ? cleanText.slice(0, 220) : cleanText,
          body: cleanText,
          url: tw.permalink,
          image_url: tw.image_url ?? null,
          image_urls: tw.image_urls ?? null,
          video_url: tw.video_url ?? null,
          tier: routing.tier,
          published_at: tw.timestamp || new Date().toISOString(),
          fetched_at: new Date().toISOString(),
          ingest_pipeline: tw.pipeline_tag || "x-api-fallback",
          fetch_latency_ms: fetchLatency,
        });
      }
    }
  }

  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      service: "riskflow-worker",
      stage: "x_collect_done",
      total_out: out.length,
      sources: [...new Set(out.map((i) => i.source_domain ?? i.source))].slice(
        0,
        10,
      ),
    }),
  );

  return out;
}
