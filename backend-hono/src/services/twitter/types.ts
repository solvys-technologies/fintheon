// [claude-code 2026-04-25] S40-P3: Twitter pipeline shared types.

import type { CollectedNewsItem } from "../../workers/news-worker/sources/types.js";

export type TwitterPipelineMode =
  | "auto" // primary streaming first, rettiwt fallback on degrade
  | "streaming-only" // primary only; never use rettiwt (debug)
  | "fallback-only" // rettiwt only; never use streaming (low-frequency tier)
  | "emergency"; // twitterapi.io WS firehose ($-flag)

export type TwitterStreamState =
  | "healthy"
  | "degraded"
  | "recovering"
  | "dead";

export interface CollectTwitterArgs {
  handles: string[];
  tier: "breaking" | "standard";
  mode?: TwitterPipelineMode;
}

export interface CollectTwitterResult {
  items: CollectedNewsItem[];
  source: "streaming" | "rettiwt" | "emergency" | "none";
  state: TwitterStreamState;
}

export interface TwitterTweet {
  id: string;
  text: string;
  username: string;
  displayName?: string;
  publishedAt: string;
  url: string;
  isRetweet: boolean;
  inReplyToId?: string | null;
}
