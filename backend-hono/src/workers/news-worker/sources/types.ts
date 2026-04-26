// [claude-code 2026-04-25] S35: image_url added so RSS enclosure / og:image can carry through
//   to expanded catalyst cards on Sanctum + RiskFlow surfaces.
// [claude-code 2026-04-19] S27-T7 (W2d): shared types for news-worker sources.
// [claude-code 2026-04-25] S40-P3: "twitter" source added — primary Twitter
//   pipeline (Browserbase XHR + rettiwt fallback). "agent-reach" retained for
//   the deprecated tombstone module; do not emit new items with that tag.

export type NewsTier = "breaking" | "standard";

export type NewsSource = "browser-harness" | "exa" | "agent-reach" | "twitter";

export interface CollectedNewsItem {
  item_id: string;
  source: NewsSource;
  source_domain: string;
  headline: string;
  body: string;
  url: string;
  image_url?: string | null;
  tier: NewsTier;
  published_at: string;
  fetched_at: string;
  fetch_latency_ms: number;
  raw_data?: Record<string, unknown> | null;
}
