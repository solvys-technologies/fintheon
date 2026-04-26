// [claude-code 2026-04-25] S35: image_url added so RSS enclosure / og:image can carry through
//   to expanded catalyst cards on Sanctum + RiskFlow surfaces.
// [claude-code 2026-04-19] S27-T7 (W2d): shared types for news-worker sources.

export type NewsTier = "breaking" | "standard";

export type NewsSource = "browser-harness" | "exa" | "agent-reach";

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
}
