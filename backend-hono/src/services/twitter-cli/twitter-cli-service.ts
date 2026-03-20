// [claude-code 2026-03-10] twitter-cli wrapper — cookie-based Twitter scraping via execFile (no shell injection)

import { execFileNoThrow } from '../../utils/execFileNoThrow.js';

// Absolute path required — Pulse backend runs with restricted PATH (/usr/local/bin only)
// uv installs to ~/.local/bin which is not in the Pulse process PATH
const TWITTER_BIN =
  process.env.TWITTER_CLI_PATH ??
  `${process.env.HOME ?? '/Users/tifos'}/.local/bin/twitter`;

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
  const result = await execFileNoThrow(TWITTER_BIN, ['--version'], { timeout: 5_000 });
  return result !== null && result.exitCode === 0;
}

/**
 * Search tweets by query string.
 * Uses execFile (NOT exec) — args passed as array, no shell injection possible.
 * Command: twitter search <query> --json [-t latest|top] [-n N]
 */
export async function searchTweets(
  query: string,
  opts?: { limit?: number; filter?: 'top' | 'latest' }
): Promise<TwitterCliTweet[]> {
  const args = ['search', query, '--json'];
  if (opts?.filter) args.push('-t', opts.filter);
  if (opts?.limit) args.push('-n', String(opts.limit));

  const result = await execFileNoThrow(TWITTER_BIN, args, { timeout: 15_000 });
  if (!result || result.exitCode !== 0 || !result.stdout.trim()) {
    if (result?.stderr) {
      console.warn('[TwitterCli] searchTweets stderr:', result.stderr.slice(0, 200));
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
  opts?: { limit?: number }
): Promise<TwitterCliTweet[]> {
  const args = ['user-posts', username, '--json'];
  if (opts?.limit) args.push('-n', String(opts.limit));

  const result = await execFileNoThrow(TWITTER_BIN, args, { timeout: 15_000 });
  if (!result || result.exitCode !== 0 || !result.stdout.trim()) {
    if (result?.stderr) {
      console.warn('[TwitterCli] fetchUserTimeline stderr:', result.stderr.slice(0, 200));
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
    const items: any[] = Array.isArray(raw) ? raw : raw.tweets ?? raw.results ?? [];
    return items.map(normalizeTweet).filter(Boolean) as TwitterCliTweet[];
  } catch {
    // Try newline-delimited JSON (NDJSON)
    const lines = stdout.trim().split('\n');
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
  if (!raw || typeof raw !== 'object') return null;

  // twitter-cli v0.4.x camelCase format: { id, text, author: { screenName }, createdAt }
  // Fallback: legacy Twitter API snake_case: { id_str, full_text, user: { screen_name }, created_at }
  const id = raw.id ?? raw.id_str ?? raw.rest_id;
  const text =
    raw.text ??
    raw.full_text ??
    raw.legacy?.full_text ??
    '';
  const author =
    raw.author?.screenName ??
    raw.author?.screen_name ??
    raw.user?.screen_name ??
    raw.core?.user_results?.result?.legacy?.screen_name ??
    'unknown';
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

/** Normalize Twitter date string ("Thu Mar 10 12:00:00 +0000 2026") to ISO */
function normalizeDate(dateStr: string): string {
  try {
    return new Date(dateStr).toISOString();
  } catch {
    return new Date().toISOString();
  }
}
