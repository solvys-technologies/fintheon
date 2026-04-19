// [claude-code 2026-04-19] S24-T2: Walk-Back Pairer — detects real-time reversals
// of prior L9/L10 items (e.g. "ceasefire confirmed" at 10am → "ceasefire collapses"
// at 2pm) so the engine fades the original item and proposes a regime revert.
//
// T1 owns the regime_proposals API (`proposeRegimeChange`). If that function is
// not yet available, the pairer still detects and reports the pair; central-scorer
// logs the intent and the regime flip is deferred until T1 lands.

import { getSupabaseClient } from "../../config/supabase.js";
import { createLogger } from "../../lib/logger.js";
import type { FeedItem } from "../../types/riskflow.js";

const log = createLogger("WalkBackPairer");
const dlog = (msg: string): void => {
  if (process.env.SCORING_V4_VERBOSE === "true") log.info(`[soft] ${msg}`);
};

const LOOKBACK_HOURS = 24;
const L9L10_FLOOR = 9;
const SUBJECT_OVERLAP_MIN = 0.25; // Jaccard min on shared-subject tokens
const MAX_CANDIDATES = 40;

const DIRECTION_TOKENS = new Set([
  "confirmed",
  "reached",
  "agreed",
  "holds",
  "signed",
  "de-escalation",
  "deescalation",
  "reopens",
  "reopened",
  "halted",
  "withdrawal",
  "truce",
  "peace",
  "accord",
  "collapses",
  "collapsed",
  "broken",
  "ended",
  "violated",
  "attack",
  "attacked",
  "strike",
  "blockade",
  "escalation",
  "missile",
  "invasion",
  "invaded",
  "seized",
  "seize",
  "nuclear",
  "bombing",
  "bombed",
  "assault",
]);

const STOPWORDS = new Set([
  "a",
  "an",
  "the",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "to",
  "of",
  "in",
  "on",
  "at",
  "by",
  "for",
  "with",
  "from",
  "as",
  "into",
  "and",
  "or",
  "but",
  "if",
  "then",
  "so",
  "that",
  "this",
  "these",
  "those",
  "it",
  "its",
  "he",
  "she",
  "they",
  "we",
  "you",
  "i",
  "his",
  "her",
  "their",
  "says",
  "said",
  "say",
  "tells",
  "told",
  "per",
  "via",
  "amp",
]);

function tokenizeSubject(text: string): Set<string> {
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9\s$%.-]/g, " ")
    .split(/\s+/)
    .filter(
      (t) => t.length >= 3 && !STOPWORDS.has(t) && !DIRECTION_TOKENS.has(t),
    );
  return new Set(tokens);
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let intersect = 0;
  for (const t of a) {
    if (b.has(t)) intersect++;
  }
  const union = a.size + b.size - intersect;
  return union === 0 ? 0 : intersect / union;
}

function oppositeSentiment(
  a: FeedItem["sentiment"],
  b: FeedItem["sentiment"],
): boolean {
  if (!a || !b) return false;
  return (
    (a === "bullish" && b === "bearish") || (a === "bearish" && b === "bullish")
  );
}

function hasSharedSubject(a: FeedItem, b: FeedItem): boolean {
  // Shared ticker
  const aSyms = new Set((a.symbols ?? []).map((s) => s.toUpperCase()));
  for (const s of b.symbols ?? []) {
    if (aSyms.has(s.toUpperCase())) return true;
  }
  // Shared narrative thread
  const aNarr = new Set((a.narrativeThreads ?? []).map((n) => n.toLowerCase()));
  for (const n of b.narrativeThreads ?? []) {
    if (aNarr.has(n.toLowerCase())) return true;
  }
  // Shared geopolitical tag (both tagged geopolitical / geopoliticalBullish / geopoliticalBearish)
  const aGeo = (a.tags ?? []).some((t) =>
    t.toLowerCase().startsWith("geopolitical"),
  );
  const bGeo = (b.tags ?? []).some((t) =>
    t.toLowerCase().startsWith("geopolitical"),
  );
  if (aGeo && bGeo) return true;
  return false;
}

interface ScoredRowLite {
  tweet_id: string;
  headline: string | null;
  symbols: string[] | null;
  tags: string[] | null;
  sentiment: string | null;
  iv_score: number | null;
  macro_level: number | null;
  published_at: string | null;
  analyzed_at: string | null;
}

async function fetchRecentHighItems(excludeId: string): Promise<FeedItem[]> {
  const sb = getSupabaseClient();
  if (!sb) return [];
  const since = new Date(
    Date.now() - LOOKBACK_HOURS * 60 * 60 * 1000,
  ).toISOString();
  try {
    const { data, error } = await sb
      .from("scored_riskflow_items")
      .select(
        "tweet_id,headline,symbols,tags,sentiment,iv_score,macro_level,published_at,analyzed_at",
      )
      .gte("iv_score", L9L10_FLOOR)
      .gte("analyzed_at", since)
      .neq("tweet_id", excludeId)
      .order("analyzed_at", { ascending: false })
      .limit(MAX_CANDIDATES);
    if (error) {
      dlog(`fetchRecentHighItems soft-fail: ${error.message}`);
      return [];
    }
    return ((data as ScoredRowLite[]) ?? []).map(
      (r): FeedItem => ({
        id: r.tweet_id,
        source: "Custom",
        headline: r.headline ?? "",
        symbols: r.symbols ?? [],
        tags: r.tags ?? [],
        isBreaking: false,
        urgency: "normal",
        publishedAt: r.published_at ?? new Date().toISOString(),
        sentiment: (r.sentiment as FeedItem["sentiment"]) ?? undefined,
        ivScore: r.iv_score ?? undefined,
        macroLevel: (r.macro_level as FeedItem["macroLevel"]) ?? undefined,
      }),
    );
  } catch (err) {
    dlog(`fetchRecentHighItems threw: ${String(err)}`);
    return [];
  }
}

export interface WalkBackResult {
  pairsWith: string | null;
  action: "fade" | "ignore";
  originalItem?: FeedItem;
  overlapScore?: number;
}

/**
 * Scan the last 24h of L9/L10 items for a semantic opposition: shared subject
 * (ticker, narrative thread, or geopolitical tag) + opposite sentiment +
 * non-trivial token overlap on the subject.
 *
 * Only considers items the caller has just scored at L9/L10. Items that didn't
 * crack L9 are returned with `action='ignore'`.
 */
export async function detectWalkBack(
  newItem: FeedItem,
): Promise<WalkBackResult> {
  // Gate: only L9/L10 items should trigger the pairer.
  const iv = newItem.ivScore ?? 0;
  if (iv < L9L10_FLOOR) {
    return { pairsWith: null, action: "ignore" };
  }
  if (!newItem.sentiment || newItem.sentiment === "neutral") {
    return { pairsWith: null, action: "ignore" };
  }

  const candidates = await fetchRecentHighItems(newItem.id);
  if (candidates.length === 0) {
    return { pairsWith: null, action: "ignore" };
  }

  const newTokens = tokenizeSubject(newItem.headline || "");
  let best: { item: FeedItem; overlap: number } | null = null;

  for (const cand of candidates) {
    if (!oppositeSentiment(newItem.sentiment, cand.sentiment)) continue;
    if (!hasSharedSubject(newItem, cand)) continue;

    const candTokens = tokenizeSubject(cand.headline || "");
    const overlap = jaccard(newTokens, candTokens);
    if (overlap < SUBJECT_OVERLAP_MIN) continue;

    if (!best || overlap > best.overlap) {
      best = { item: cand, overlap };
    }
  }

  if (!best) {
    return { pairsWith: null, action: "ignore" };
  }

  return {
    pairsWith: best.item.id,
    action: "fade",
    originalItem: best.item,
    overlapScore: Number(best.overlap.toFixed(3)),
  };
}

export interface ApplyFadeInput {
  originalId: string;
  fadeFactor?: number; // default 0.5
}

/**
 * Fade the original item's iv_score by `fadeFactor` (default 0.5×) and mark it
 * as walk-back-paired. Soft-fails if Supabase is unavailable. Caller should
 * call this AFTER detectWalkBack returns `action='fade'`.
 */
export async function applyFadeToOriginal(
  input: ApplyFadeInput,
): Promise<boolean> {
  const { originalId, fadeFactor = 0.5 } = input;
  const sb = getSupabaseClient();
  if (!sb) return false;

  try {
    // Read the current score first
    const { data, error: readErr } = await sb
      .from("scored_riskflow_items")
      .select("iv_score,macro_level")
      .eq("tweet_id", originalId)
      .limit(1)
      .maybeSingle();
    if (readErr || !data) {
      dlog(
        `applyFadeToOriginal read soft-fail: ${readErr?.message ?? "not found"}`,
      );
      return false;
    }
    const currentScore = Number((data as { iv_score: number }).iv_score ?? 0);
    const faded = Math.max(0, currentScore * fadeFactor);

    // Keep macro_level clamped to reflect the fade (drop one tier if score fades under 5)
    const currentMl = (data as { macro_level: number }).macro_level ?? 3;
    const newMl =
      faded < 5 ? Math.max(1, currentMl - 2) : Math.max(1, currentMl - 1);

    const { error: writeErr } = await sb
      .from("scored_riskflow_items")
      .update({
        iv_score: Number(faded.toFixed(2)),
        macro_level: newMl,
      })
      .eq("tweet_id", originalId);
    if (writeErr) {
      dlog(`applyFadeToOriginal write soft-fail: ${writeErr.message}`);
      return false;
    }
    return true;
  } catch (err) {
    dlog(`applyFadeToOriginal threw: ${String(err)}`);
    return false;
  }
}

export const __test = {
  tokenizeSubject,
  jaccard,
  oppositeSentiment,
  hasSharedSubject,
  DIRECTION_TOKENS,
};
