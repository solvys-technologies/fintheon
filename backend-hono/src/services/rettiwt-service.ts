// [claude-code 2026-04-10] Rettiwt-API wrapper — graceful, never throws, returns empty on failure
// Replaces Exa as primary Twitter search fallback

import { Rettiwt } from "rettiwt-api";
import { createLogger } from "../lib/logger.js";

const log = createLogger("RettiwtService");

export interface RettiwtSearchResult {
  id: string;
  text: string;
  author: string;
  publishedDate: string;
  url: string;
}

let client: Rettiwt | null = null;

function getClient(): Rettiwt | null {
  if (client) return client;
  const token = process.env.RETTIWT_AUTH_TOKEN;
  if (!token) return null;
  client = new Rettiwt({ apiKey: token });
  return client;
}

export function isRettiwtAvailable(): boolean {
  return Boolean(process.env.RETTIWT_AUTH_TOKEN);
}

export async function rettiwtSearch(
  query: string,
  opts?: { count?: number },
): Promise<RettiwtSearchResult[]> {
  const rt = getClient();
  if (!rt) return [];

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const response = await rt.tweet.search(
      { includeWords: query.split(" ").slice(0, 10) },
      opts?.count ?? 10,
    );

    clearTimeout(timeout);

    if (!response?.list) return [];

    return response.list.map((tweet) => ({
      id: tweet.id ?? "",
      text: tweet.fullText ?? "",
      author: tweet.tweetBy?.userName ?? "unknown",
      publishedDate: tweet.createdAt
        ? new Date(tweet.createdAt).toISOString()
        : new Date().toISOString(),
      url: `https://x.com/${tweet.tweetBy?.userName ?? "i"}/status/${tweet.id}`,
    }));
  } catch (err) {
    log.warn("Rettiwt search failed (graceful)", { error: String(err) });
    return [];
  }
}

export async function rettiwtUserTimeline(
  username: string,
  opts?: { count?: number },
): Promise<RettiwtSearchResult[]> {
  const rt = getClient();
  if (!rt) return [];

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    // Need user ID for timeline — search by username first
    const user = await rt.user.details(username);
    if (!user?.id) {
      clearTimeout(timeout);
      return [];
    }

    const response = await rt.user.timeline(user.id, opts?.count ?? 10);
    clearTimeout(timeout);

    if (!response?.list) return [];

    return response.list.map((tweet) => ({
      id: tweet.id ?? "",
      text: tweet.fullText ?? "",
      author: username,
      publishedDate: tweet.createdAt
        ? new Date(tweet.createdAt).toISOString()
        : new Date().toISOString(),
      url: `https://x.com/${username}/status/${tweet.id}`,
    }));
  } catch (err) {
    log.warn(`Rettiwt timeline failed for @${username} (graceful)`, {
      error: String(err),
    });
    return [];
  }
}
