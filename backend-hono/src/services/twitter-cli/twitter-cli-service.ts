// [claude-code 2026-03-10] twitter-cli wrapper — cookie-based Twitter scraping via execFile (no shell injection)
// [claude-code 2026-04-06] Added global 429 cooldown — pauses all CLI calls for 90s after rate limit hit

import { execFileNoThrow } from "../../utils/execFileNoThrow.js";

// Absolute path required — Fintheon backend runs with restricted PATH (/usr/local/bin only)
// uv installs to ~/.local/bin which is not in the Fintheon process PATH
const TWITTER_BIN =
  process.env.TWITTER_CLI_PATH ??
  `${process.env.HOME ?? "/Users/tifos"}/.local/bin/twitter`;

// ── Global 429 Rate Limit Cooldown ──────────────────────────────────────────
const RATE_LIMIT_COOLDOWN_MS = 300_000; // 5 min pause after any 429 (Twitter limits last 15min+)
let rateLimitedUntil = 0;
let consecutiveEmptyPolls = 0;
const EMPTY_POLL_THRESHOLD = 2; // After 2 consecutive empty polls, assume still rate limited

/** Check if we're currently in a 429 cooldown window OR getting empty results */
export function isRateLimited(): boolean {
  return (
    Date.now() < rateLimitedUntil ||
    consecutiveEmptyPolls >= EMPTY_POLL_THRESHOLD
  );
}

/** Get remaining cooldown ms (0 if not rate limited) */
export function getRateLimitCooldownMs(): number {
  return Math.max(0, rateLimitedUntil - Date.now());
}

/** Record that a poll returned results — resets empty counter */
export function markPollSuccess(): void {
  consecutiveEmptyPolls = 0;
}

/** Record that a poll returned 0 items — increments empty counter */
export function markPollEmpty(): void {
  consecutiveEmptyPolls++;
  if (consecutiveEmptyPolls >= EMPTY_POLL_THRESHOLD) {
    console.warn(
      `[TwitterCli] ${consecutiveEmptyPolls} consecutive empty polls — treating as rate limited, Exa fallback will fire`,
    );
  }
}

function markRateLimited(): void {
  rateLimitedUntil = Date.now() + RATE_LIMIT_COOLDOWN_MS;
  consecutiveEmptyPolls = EMPTY_POLL_THRESHOLD; // Immediately qualify for Exa fallback
  console.warn(
    `[TwitterCli] 429 rate limit hit — pausing ALL calls for ${RATE_LIMIT_COOLDOWN_MS / 1000}s (until ${new Date(rateLimitedUntil).toISOString()})`,
  );
}

export interface TwitterCliTweet {
  id: string;
  text: string;
  author: string;
  publishedAt: string;
}

/**
 * Check if twitter-cli is installed and functional.
 * Returns false gracefully so callers can skip without crashing.
 */
export async function isTwitterCliInstalled(): Promise<boolean> {
  const result = await execFileNoThrow(TWITTER_BIN, ["--version"], {
    timeout: 5_000,
  });
  return result !== null && result.exitCode === 0;
}

/**
 * Search tweets by query string.
 * Uses execFile (NOT exec) — args passed as array, no shell injection possible.
 * Command: twitter search <query> --json [-t latest|top] [-n N]
 */
export async function searchTweets(
  query: string,
  opts?: { limit?: number; filter?: "top" | "latest" },
): Promise<TwitterCliTweet[]> {
  if (isRateLimited()) return [];

  const args = ["search", query, "--json"];
  if (opts?.filter) args.push("-t", opts.filter);
  if (opts?.limit) args.push("-n", String(opts.limit));

  const result = await execFileNoThrow(TWITTER_BIN, args, { timeout: 15_000 });
  if (!result || result.exitCode !== 0 || !result.stdout.trim()) {
    if (
      result?.stderr?.includes("429") ||
      result?.stdout?.includes("rate_limited")
    ) {
      markRateLimited();
    } else if (result?.stderr) {
      console.warn(
        "[TwitterCli] searchTweets stderr:",
        result.stderr.slice(0, 200),
      );
    }
    return [];
  }

  return parseTweetJson(result.stdout);
}

/**
 * Fetch a user's recent posts.
 * Command: twitter user-posts <username> --json [-n N]
 */
export async function fetchUserTimeline(
  username: string,
  opts?: { limit?: number },
): Promise<TwitterCliTweet[]> {
  if (isRateLimited()) return [];

  const args = ["user-posts", username, "--json"];
  if (opts?.limit) args.push("-n", String(opts.limit));

  const result = await execFileNoThrow(TWITTER_BIN, args, { timeout: 15_000 });
  if (!result || result.exitCode !== 0 || !result.stdout.trim()) {
    if (
      result?.stderr?.includes("429") ||
      result?.stdout?.includes("rate_limited")
    ) {
      markRateLimited();
    } else if (result?.stderr) {
      console.warn(
        "[TwitterCli] fetchUserTimeline stderr:",
        result.stderr.slice(0, 200),
      );
    }
    return [];
  }

  return parseTweetJson(result.stdout);
}

/**
 * Parse twitter-cli JSON output into normalized TwitterCliTweet[].
 * Handles both array format and newline-delimited JSON.
 */
function parseTweetJson(stdout: string): TwitterCliTweet[] {
  try {
    // Try array format first
    const raw = JSON.parse(stdout.trim());
    // twitter-cli v0.7.0 wraps in {ok, schema_version, data: [...]}
    const items: any[] = Array.isArray(raw)
      ? raw
      : (raw.data ?? raw.tweets ?? raw.results ?? []);
    return items.map(normalizeTweet).filter(Boolean) as TwitterCliTweet[];
  } catch {
    // Try newline-delimited JSON (NDJSON)
    const lines = stdout.trim().split("\n");
    const tweets: TwitterCliTweet[] = [];
    for (const line of lines) {
      try {
        const item = JSON.parse(line.trim());
        const t = normalizeTweet(item);
        if (t) tweets.push(t);
      } catch {
        // skip malformed lines
      }
    }
    return tweets;
  }
}

function normalizeTweet(raw: any): TwitterCliTweet | null {
  if (!raw || typeof raw !== "object") return null;

  // twitter-cli v0.4.x camelCase format: { id, text, author: { screenName }, createdAt }
  // Fallback: legacy Twitter API snake_case: { id_str, full_text, user: { screen_name }, created_at }
  const id = raw.id ?? raw.id_str ?? raw.rest_id;
  const text = raw.text ?? raw.full_text ?? raw.legacy?.full_text ?? "";
  const author =
    raw.author?.screenName ??
    raw.author?.screen_name ??
    raw.user?.screen_name ??
    raw.core?.user_results?.result?.legacy?.screen_name ??
    "unknown";
  const publishedAt =
    raw.createdAt ??
    raw.created_at ??
    raw.legacy?.created_at ??
    new Date().toISOString();

  if (!id || !text) return null;

  return {
    id: String(id),
    text: String(text),
    author: String(author),
    publishedAt: normalizeDate(publishedAt),
  };
}

/**
 * Fetch the authenticated user's bookmarks.
 * Command: twitter bookmarks --json [-n N]
 */
export async function fetchBookmarks(opts?: {
  limit?: number;
}): Promise<TwitterCliTweet[]> {
  if (isRateLimited()) return [];

  const args = ["bookmarks", "--json"];
  if (opts?.limit) args.push("-n", String(opts.limit));

  const result = await execFileNoThrow(TWITTER_BIN, args, { timeout: 20_000 });
  if (!result || result.exitCode !== 0 || !result.stdout.trim()) {
    if (
      result?.stderr?.includes("429") ||
      result?.stdout?.includes("rate_limited")
    ) {
      markRateLimited();
    } else if (result?.stderr) {
      console.warn(
        "[TwitterCli] fetchBookmarks stderr:",
        result.stderr.slice(0, 200),
      );
    }
    return [];
  }

  return parseTweetJson(result.stdout);
}

/** Normalize Twitter date string ("Thu Mar 10 12:00:00 +0000 2026") to ISO */
function normalizeDate(dateStr: string): string {
  try {
    return new Date(dateStr).toISOString();
  } catch {
    return new Date().toISOString();
  }
}
