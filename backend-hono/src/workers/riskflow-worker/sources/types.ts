// [claude-code 2026-04-28] S48-T1: Added ingest_pipeline field for per-item pipeline tracking
// [claude-code 2026-04-24] S35-T10: renamed dir from workers/news-worker. Type names
//   (CollectedNewsItem, NewsTier, NewsSource) preserved to keep downstream consumers stable.
// [claude-code 2026-04-19] S27-T7 (W2d): shared types for riskflow-worker sources.

// [claude-code 2026-05-03] Added "unified" to support merged-tier home-timeline polling.
// Items still emit with their routing tier (breaking/standard/commentary); "unified"
// only gates the collector—it tells x-handles-browser to skip per-tier filtering.
export type NewsTier = "breaking" | "standard" | "commentary" | "unified";

export type NewsSource =
  | "browser-harness"
  | "exa"
  | "agent-reach"
  | "kalshi"
  | `twitter:${string}`;

export interface CollectedNewsItem {
  item_id: string;
  source: NewsSource;
  source_domain: string;
  headline: string;
  body: string;
  /** Permalink to the original post / source page. Required — every card
   *  links here when the user taps "open original". */
  url: string;
  /** Photo / hero image URL associated with the headline. Optional but
   *  strongly preferred — RiskFlow detail cards render it as a tappable
   *  image that deep-links to `url`. Pulled from tweet media for Twitter,
   *  og:image / twitter:image for browser-harness, <enclosure> /
   *  <media:thumbnail> for RSS. */
  image_url?: string | null;
  /** Direct .mp4 URL for tweets attaching a video / animated_gif. */
  video_url?: string | null;
  /** Multiple image URLs for tweets with 2+ photos (displayed side by side). */
  image_urls?: string[] | null;
  tier: NewsTier;
  published_at: string;
  fetched_at: string;
  fetch_latency_ms: number;
  /** S48-T1: Which ingest pipeline produced this item */
  ingest_pipeline?: string;
}
