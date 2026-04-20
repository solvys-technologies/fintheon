// [claude-code 2026-04-19] Extracted from catalyst-promoter so the central-scorer
// dedup purge can share the same canonicalization as headline-dedup cache.
// Aggressive lowercase, strip non-alphanum, collapse whitespace — good enough
// to match "Powell: Rates Steady" against "Powell rates steady" across sources.
export function normalizeHeadline(headline: string): string {
  return headline
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Extract a URL from a tag list of form "url:https://..." */
export function extractUrlFromTags(
  tags: string[] | undefined | null,
): string | null {
  if (!tags || tags.length === 0) return null;
  for (const tag of tags) {
    if (typeof tag !== "string") continue;
    if (tag.startsWith("url:")) {
      const url = tag.slice(4).trim();
      if (url.length > 0) return url;
    }
  }
  return null;
}
