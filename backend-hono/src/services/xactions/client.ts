// [claude-code 2026-04-26] XActions (https://github.com/nirholas/XActions)
// client. Self-hostable Puppeteer-based X/Twitter scraper that exposes its
// surface as MCP tools (or HTTP/CLI). We use it as the SECONDARY fallback
// behind browser-harness for the news pipeline — when the local Playwright
// path on Fly hits an X login wall or a 429 from syndication.twitter.com,
// we ask XActions to fetch the same handle's timeline using its own
// Puppeteer harness (which can carry an XACTIONS_SESSION_COOKIE if needed
// to bypass guest-mode walls).
//
// Configure on the consuming app:
//   XACTIONS_API_BASE — e.g. "https://fintheon-xactions.fly.dev" (required)
//   XACTIONS_SESSION_COOKIE — optional auth_token cookie for X (forwarded
//                             as XACTIONS_SESSION_COOKIE inside the XActions
//                             container, set there directly per repo docs)
//
// We talk to XActions over its Streamable HTTP MCP transport, posting a
// JSON-RPC `tools/call` envelope. The tool we want is `x_get_tweets`.

import { createLogger } from "../../lib/logger.js";

const log = createLogger("XActions");

const FETCH_TIMEOUT_MS = 25_000;

export interface XActionsTweet {
  tweet_id: string;
  text: string;
  timestamp: string; // ISO 8601 if XActions returns it, else fetch time
  permalink: string;
  author_handle: string;
}

export function isXActionsConfigured(): boolean {
  return Boolean(process.env.XACTIONS_API_BASE);
}

function xactionsBase(): string | null {
  const raw = process.env.XACTIONS_API_BASE?.trim();
  if (!raw) return null;
  return raw.replace(/\/+$/, "");
}

/**
 * Walk an unknown response payload looking for tweet-shaped objects so the
 * client tolerates schema drift between XActions versions.
 */
function harvestTweets(node: unknown, handle: string): XActionsTweet[] {
  const out: XActionsTweet[] = [];
  const seen = new Set<string>();

  function walk(n: unknown): void {
    if (!n || typeof n !== "object") return;
    if (Array.isArray(n)) {
      for (const item of n) walk(item);
      return;
    }
    const obj = n as Record<string, unknown>;
    const idStr =
      (obj.tweet_id as string | undefined) ??
      (obj.id_str as string | undefined) ??
      (typeof obj.id === "string" ? obj.id : undefined);
    const text =
      (obj.text as string | undefined) ??
      (obj.full_text as string | undefined) ??
      (obj.content as string | undefined);
    if (
      typeof idStr === "string" &&
      idStr.length > 8 &&
      typeof text === "string" &&
      text.length > 0 &&
      !seen.has(idStr)
    ) {
      seen.add(idStr);
      const created =
        (obj.created_at as string | undefined) ??
        (obj.timestamp as string | undefined) ??
        (obj.date as string | undefined);
      let isoTs: string;
      if (created) {
        const ms = Date.parse(created);
        isoTs = Number.isFinite(ms)
          ? new Date(ms).toISOString()
          : new Date().toISOString();
      } else {
        isoTs = new Date().toISOString();
      }
      out.push({
        tweet_id: idStr,
        text: text.trim(),
        timestamp: isoTs,
        permalink:
          (obj.url as string | undefined) ??
          `https://x.com/${handle}/status/${idStr}`,
        author_handle: handle,
      });
    }
    for (const k of Object.keys(obj)) walk(obj[k]);
  }

  walk(node);
  return out;
}

interface GetTweetsOpts {
  handle: string;
  limit?: number;
  includeReplies?: boolean;
}

/**
 * Fetch the latest tweets for a public handle via XActions's MCP `x_get_tweets`
 * tool. Returns [] on missing config, network error, or empty payload — the
 * caller decides whether to retry or move on.
 */
export async function getTweetsViaXActions(
  opts: GetTweetsOpts,
): Promise<XActionsTweet[]> {
  const base = xactionsBase();
  if (!base) return [];
  const handle = opts.handle.replace(/^@/, "").trim();
  if (!handle) return [];
  const limit = Math.max(1, Math.min(opts.limit ?? 20, 50));

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${base}/mcp`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: `${Date.now()}-${handle}`,
        method: "tools/call",
        params: {
          name: "x_get_tweets",
          arguments: {
            user: handle,
            username: handle,
            limit,
            includeReplies: Boolean(opts.includeReplies),
          },
        },
      }),
    });
    if (!res.ok) {
      log.warn("XActions non-OK", { status: res.status, handle });
      return [];
    }
    const json = (await res.json()) as {
      result?: { content?: unknown; tweets?: unknown };
      error?: { message?: string };
    };
    if (json.error) {
      log.warn("XActions tool error", { error: json.error, handle });
      return [];
    }
    // tools/call wraps the actual return in result.content (MCP spec) or
    // sometimes flatly under result. Walk both.
    const payload = json.result?.content ?? json.result;
    return harvestTweets(payload, handle);
  } catch (err) {
    log.warn("XActions request failed", {
      handle,
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  } finally {
    clearTimeout(timer);
  }
}
