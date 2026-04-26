// [claude-code 2026-04-25] S40-P3: rettiwt-api guest-mode fallback for the
// Twitter pipeline. Used when:
//   - Primary streaming-watcher is degraded (XHR stale > 5min)
//   - tier=standard (low-frequency cadence)
//   - mode=fallback-only (debug)
//
// Uses an auth-cookie pool from X_RETTIWT_COOKIES (JSON array of cookie
// strings). Rotates on rate-limit. If the env is unset, falls back to guest
// mode (no auth) — works but lower rate-limit ceiling.

import { createLogger } from "../../lib/logger.js";
import type { TwitterTweet } from "./types.js";

const log = createLogger("TwitterRettiwt");

interface RettiwtTweet {
  id: string;
  fullText?: string;
  text?: string;
  tweetBy: { userName: string; fullName?: string };
  createdAt: string;
  replyTo?: string | null;
  retweetedTweet?: { id: string } | null;
}

let rettiwtCache: any | null = null;
let cookiePoolIdx = 0;

function loadCookiePool(): string[] {
  const raw = process.env.X_RETTIWT_COOKIES;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((s) => typeof s === "string" && s.length > 0);
  } catch {
    return [];
  }
}

async function loadRettiwt(apiKey?: string): Promise<any | null> {
  if (rettiwtCache) return rettiwtCache;
  try {
    // Dynamic import keeps the dep optional — if rettiwt-api isn't installed,
    // this returns null and the caller falls back to "no items" gracefully.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = await import("rettiwt-api").catch(() => null);
    if (!mod) {
      log.warn("rettiwt-api not installed — fallback unavailable");
      return null;
    }
    const Rettiwt = (mod as any).Rettiwt ?? (mod as any).default?.Rettiwt;
    if (!Rettiwt) {
      log.warn("rettiwt-api module shape unexpected");
      return null;
    }
    rettiwtCache = apiKey ? new Rettiwt({ apiKey }) : new Rettiwt();
    return rettiwtCache;
  } catch (err) {
    log.warn("rettiwt instantiate threw", {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

function rotateCookie(): string | undefined {
  const pool = loadCookiePool();
  if (pool.length === 0) return undefined;
  cookiePoolIdx = (cookiePoolIdx + 1) % pool.length;
  return pool[cookiePoolIdx];
}

function mapTweet(raw: RettiwtTweet, fallbackHandle: string): TwitterTweet {
  const text = raw.fullText ?? raw.text ?? "";
  const username = raw.tweetBy?.userName ?? fallbackHandle;
  return {
    id: String(raw.id),
    text,
    username,
    displayName: raw.tweetBy?.fullName,
    publishedAt: raw.createdAt,
    url: `https://x.com/${username}/status/${raw.id}`,
    isRetweet: Boolean(raw.retweetedTweet),
    inReplyToId: raw.replyTo ?? null,
  };
}

export async function pollHandlesViaRettiwt(
  handles: string[],
): Promise<TwitterTweet[]> {
  if (handles.length === 0) return [];

  // Cookie rotation: try the next cookie in pool first, fall back to guest.
  const cookie = rotateCookie();
  const rettiwt = await loadRettiwt(cookie);
  if (!rettiwt) return [];

  const collected: TwitterTweet[] = [];
  await Promise.all(
    handles.map(async (handle) => {
      try {
        const result = await rettiwt.tweet.list({
          fromUsers: [handle],
          count: 20,
        });
        if (!result?.list) return;
        for (const t of result.list as RettiwtTweet[]) {
          collected.push(mapTweet(t, handle));
        }
      } catch (err) {
        log.warn("rettiwt poll handle failed", {
          handle,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }),
  );

  return collected;
}
