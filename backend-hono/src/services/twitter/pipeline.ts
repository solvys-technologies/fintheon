// [claude-code 2026-04-25] S40-P3: Twitter pipeline orchestrator. Routes
// collection requests through the active source: streaming primary,
// rettiwt fallback, or commercial firehose emergency.
//
// State machine (mirrors streaming-watcher.ts):
//   HEALTHY    → drain ringBuffer (streaming)
//   DEGRADED   → drain ringBuffer + rettiwt poll, merge by id
//   RECOVERING → same as DEGRADED, until streaming-watcher returns to healthy
//   DEAD       → rettiwt only + critical alert (already sent by watcher)
//
// `mode` overrides:
//   auto              → state-driven (default)
//   streaming-only    → ringBuffer only; ignore rettiwt
//   fallback-only     → rettiwt only; never read ringBuffer (low-frequency tier)
//   emergency         → twitterapi.io firehose ($-flag, off by default)

import { createLogger } from "../../lib/logger.js";
import {
  drainNewTweets,
  getStreamingState,
} from "./streaming-watcher.js";
import { pollHandlesViaRettiwt } from "./rettiwt-fallback.js";
import type {
  CollectTwitterArgs,
  CollectTwitterResult,
  TwitterPipelineMode,
  TwitterTweet,
} from "./types.js";
import type { CollectedNewsItem } from "../../workers/news-worker/sources/types.js";

const log = createLogger("TwitterPipeline");

export type { TwitterPipelineMode };

function tweetToCollectedItem(
  t: TwitterTweet,
  tier: "breaking" | "standard",
): CollectedNewsItem {
  const fetchedAt = new Date().toISOString();
  return {
    item_id: `twitter:${t.id}`,
    source: "twitter",
    source_domain: "x.com",
    headline: t.text,
    body: t.text,
    url: t.url,
    tier,
    published_at: t.publishedAt,
    fetched_at: fetchedAt,
    fetch_latency_ms: Math.max(
      0,
      new Date(fetchedAt).getTime() - new Date(t.publishedAt).getTime(),
    ),
    raw_data: {
      tweet_id: t.id,
      username: t.username,
      display_name: t.displayName,
      is_retweet: t.isRetweet,
      in_reply_to: t.inReplyToId,
    },
  };
}

function dedupTweets(rows: TwitterTweet[]): TwitterTweet[] {
  const seen = new Set<string>();
  const out: TwitterTweet[] = [];
  for (const t of rows) {
    if (seen.has(t.id)) continue;
    seen.add(t.id);
    out.push(t);
  }
  return out;
}

export async function collectFromTwitterPipeline(
  args: CollectTwitterArgs,
): Promise<CollectedNewsItem[]> {
  const result = await collectFromTwitterPipelineInternal(args);
  return result.items;
}

export async function collectFromTwitterPipelineInternal(
  args: CollectTwitterArgs,
): Promise<CollectTwitterResult> {
  const mode: TwitterPipelineMode = args.mode ?? resolveAutoMode();

  if (process.env.TWITTER_EMERGENCY_FIRESTREAM === "true") {
    // Emergency commercial flag — twitterapi.io WebSocket firehose ($149/mo).
    // The actual WebSocket consumer is not wired in this commit; the flag
    // surfaces a warning so TP knows it's hot. Falls through to rettiwt.
    log.warn(
      "TWITTER_EMERGENCY_FIRESTREAM=true but emergency consumer not yet wired — falling back to rettiwt",
    );
  }

  let tweets: TwitterTweet[] = [];
  let source: CollectTwitterResult["source"] = "none";

  if (mode === "streaming-only") {
    tweets = drainNewTweets(args.handles);
    source = "streaming";
  } else if (mode === "fallback-only") {
    tweets = await pollHandlesViaRettiwt(args.handles);
    source = "rettiwt";
  } else {
    // auto / emergency: drain ringBuffer first, then rettiwt if degraded.
    const fromStream = drainNewTweets(args.handles);
    const state = getStreamingState();
    if (state === "healthy") {
      tweets = fromStream;
      source = "streaming";
    } else {
      const fromRettiwt = await pollHandlesViaRettiwt(args.handles);
      tweets = dedupTweets([...fromStream, ...fromRettiwt]);
      source = fromStream.length >= fromRettiwt.length ? "streaming" : "rettiwt";
    }
  }

  return {
    items: tweets.map((t) => tweetToCollectedItem(t, args.tier)),
    source,
    state: getStreamingState(),
  };
}

function resolveAutoMode(): TwitterPipelineMode {
  return "auto";
}
