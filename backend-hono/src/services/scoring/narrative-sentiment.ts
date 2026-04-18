// [claude-code 2026-04-19] S24-T2: Narrative-Aware Sentiment — tints speaker-attributed
// events through the lens of currently-active narratives.
//
// Reads `active_narratives` (T1 migration 20260419_v4_foundation.sql). Each narrative row
// has a stance (bullish/bearish/neutral) and a list of keywords. When a parsed headline
// matches one or more active narratives, the matched narratives' stance becomes the
// sentiment — overriding the keyword-based default in iv-scorer.determineSentiment().
//
// Example: "rate cuts appropriate" matches `price_stability` + `max_employment`. If both
// narratives have stance='bearish' (Fed cutting amid a breakdown), the statement reads
// bearish, not bullish. If both are bullish, it reads bullish (supportive cut into strength).
//
// Returns `null` when no active narrative matches — caller falls back to the existing
// determineSentiment() in iv-scorer.ts.

import { getSupabaseClient } from "../../config/supabase.js";
import { createLogger } from "../../lib/logger.js";
import type { ParsedHeadline } from "../../types/news-analysis.js";

const log = createLogger("NarrativeSentiment");
const dlog = (msg: string): void => {
  if (process.env.SCORING_V4_VERBOSE === "true") log.info(`[soft] ${msg}`);
};

const TABLE = "active_narratives";

export type NarrativeStance = "bullish" | "bearish" | "neutral";

export interface ActiveNarrative {
  id: string;
  name: string;
  stance: NarrativeStance;
  keywords: string[];
  is_active: boolean;
}

// Small cache to avoid hammering Supabase on every scored item. 60s TTL
// matches the natural cadence of narrative stance changes (T4 refinement cron).
let cached: ActiveNarrative[] | null = null;
let cachedAt = 0;
const CACHE_TTL = 60_000;

export function clearNarrativeCache(): void {
  cached = null;
  cachedAt = 0;
}

/**
 * Read active narratives from Supabase. Soft-fails to an empty list if the
 * table is missing (T1 not yet landed) or on any query error.
 */
export async function fetchActiveNarratives(): Promise<ActiveNarrative[]> {
  if (cached && Date.now() - cachedAt < CACHE_TTL) {
    return cached;
  }
  const sb = getSupabaseClient();
  if (!sb) return [];
  try {
    const { data, error } = await sb
      .from(TABLE)
      .select("id,name,stance,keywords,is_active")
      .eq("is_active", true)
      .limit(50);
    if (error) {
      dlog(`fetchActiveNarratives soft-fail: ${error.message}`);
      return [];
    }
    const rows = ((data as ActiveNarrative[]) ?? []).filter(
      (n) => Array.isArray(n.keywords) && n.keywords.length > 0,
    );
    cached = rows;
    cachedAt = Date.now();
    return rows;
  } catch (err) {
    dlog(`fetchActiveNarratives threw: ${String(err)}`);
    return [];
  }
}

function buildHaystack(parsed: ParsedHeadline): string {
  const parts: string[] = [parsed.raw];
  if (parsed.target) parts.push(parsed.target);
  if (parsed.action) parts.push(parsed.action);
  if (parsed.eventType) parts.push(parsed.eventType);
  if (parsed.tags?.length) parts.push(parsed.tags.join(" "));
  return parts.join(" ").toLowerCase();
}

function keywordMatches(haystack: string, keyword: string): boolean {
  const k = keyword.toLowerCase().trim();
  if (!k) return false;
  // Word-boundary match for short keywords to avoid false positives ("cpi" in "capital").
  if (k.length <= 5) {
    return new RegExp(`\\b${escapeRegex(k)}\\b`, "i").test(haystack);
  }
  return haystack.includes(k);
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Find active narratives whose keyword list overlaps with the parsed headline.
 */
export function matchNarratives(
  parsed: ParsedHeadline,
  narratives: ActiveNarrative[],
): ActiveNarrative[] {
  if (!narratives.length) return [];
  const haystack = buildHaystack(parsed);
  const matched: ActiveNarrative[] = [];
  for (const n of narratives) {
    if (n.keywords.some((k) => keywordMatches(haystack, k))) {
      matched.push(n);
    }
  }
  return matched;
}

/**
 * Resolve the narrative-aware sentiment for a parsed headline.
 *
 * - Requires a speaker (narrative-tinted interpretation is a speaker phenomenon).
 * - Returns the matched narratives' stance if they all agree.
 * - Returns "neutral" if matches disagree (bullish + bearish mixed).
 * - Returns `null` when no active narrative matches → caller falls back.
 */
export async function interpretSentimentThroughNarratives(
  parsed: ParsedHeadline,
  overrideNarratives?: ActiveNarrative[],
): Promise<NarrativeStance | null> {
  // Only apply to speaker-attributed events — walk-back pairer / econ data
  // should not get narrative tinting (they have their own direct sentiment).
  if (!parsed.speaker) return null;

  const narratives =
    overrideNarratives ?? (await fetchActiveNarratives());
  if (!narratives.length) return null;

  const matched = matchNarratives(parsed, narratives);
  if (matched.length === 0) return null;

  let bull = 0;
  let bear = 0;
  let neu = 0;
  for (const n of matched) {
    if (n.stance === "bullish") bull++;
    else if (n.stance === "bearish") bear++;
    else neu++;
  }

  // All-same stance wins outright.
  if (bull > 0 && bear === 0) return "bullish";
  if (bear > 0 && bull === 0) return "bearish";
  // Mixed → neutral (caller may still fall back to keyword-based inference).
  if (bull > 0 && bear > 0) return "neutral";
  return "neutral";
}

export const __test = {
  buildHaystack,
  keywordMatches,
  matchNarratives,
};
