// [claude-code 2026-04-19] S27-T7 (W2d): Worker-side pre-filter. The heavy IV
// scoring lives in the central scorer (riskflow/central-scorer.ts) which picks
// up raw items from Supabase and enriches them — the worker only needs to
// reject obvious junk (empty headlines, pure ad copy) to keep the scorer's
// inbox clean.

const MIN_HEADLINE_LEN = 10;
const MIN_ALNUM_RATIO = 0.35;

const REJECT_PATTERNS: RegExp[] = [
  /^\s*(sponsored|advert|promoted)\b/i,
  /^\s*sign up\s+/i,
  /^\s*subscribe\s+/i,
  /^\s*sale\b.*(off|%)/i,
];

/**
 * Cheap gate run per item before it hits Supabase. Returns true if the item
 * should be persisted, false if it is obviously non-news.
 */
export function scoreHeadline(headline: string): boolean {
  if (!headline) return false;
  const trimmed = headline.trim();
  if (trimmed.length < MIN_HEADLINE_LEN) return false;
  for (const pattern of REJECT_PATTERNS) {
    if (pattern.test(trimmed)) return false;
  }

  const alnum = (trimmed.match(/[\p{L}\p{N}]/gu) ?? []).length;
  const ratio = alnum / trimmed.length;
  if (ratio < MIN_ALNUM_RATIO) return false;

  return true;
}
