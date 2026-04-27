// [claude-code 2026-04-24] S35-T10: renamed dir from workers/news-worker. Type names
//   (CollectedNewsItem, NewsTier, NewsSource) preserved to keep downstream consumers stable.
// [claude-code 2026-04-19] S27-T7 (W2d): shared types for riskflow-worker sources.

export type NewsTier = "breaking" | "standard";

export type NewsSource =
  | "browser-harness"
  | "exa"
  | "agent-reach"
  | `twitter:${string}`;

export interface CollectedNewsItem {
  item_id: string;
  source: NewsSource;
  source_domain: string;
  headline: string;
  body: string;
  url: string;
  tier: NewsTier;
  published_at: string;
  fetched_at: string;
  fetch_latency_ms: number;
}
