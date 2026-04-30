// [claude-code 2026-04-28] S48-T1: Added ingest_pipeline field for per-item pipeline tracking
// [claude-code 2026-04-24] S35-T10: renamed dir from workers/news-worker. Type names
//   (CollectedNewsItem, NewsTier, NewsSource) preserved to keep downstream consumers stable.
// [claude-code 2026-04-19] S27-T7 (W2d): shared types for riskflow-worker sources.

export type NewsTier = "breaking" | "standard" | "commentary";

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
  /** Direct .mp4 URL for tweets attaching a video / animated_gif.
   *  Highest-bitrate variant from extended_entities.media[].video_info.variants[].
   *  RiskFlowDetailCard renders it inline as <video controls poster={image_url}>
   *  when present; falls back to <img> otherwise. */
  video_url?: string | null;
  tier: NewsTier;
  published_at: string;
  fetched_at: string;
  fetch_latency_ms: number;
  /** S48-T1: Which ingest pipeline produced this item */
  ingest_pipeline?: string;
}
