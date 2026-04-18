// [claude-code 2026-04-19] S24-T2: Speaker Novelty Engine — damps commentator multiplier on repeat utterances
//
// Reads/writes `speaker_utterance_cache` (T1-owned migration 20260419_v4_foundation.sql).
// Prefers pgvector cosine similarity if an `embedding` column is present; otherwise falls
// back to Jaccard on tokenized headline text. If the table is missing or empty (T1 migration
// not yet landed, or first run), returns 1.0 (novel) and never throws.
//
// Decay curve: sim < 0.3 → 1.0, linear from (0.3, 1.0) to (0.9, 0.4), floor 0.3 above 0.9.

import { getSupabaseClient } from "../../config/supabase.js";
import { createLogger } from "../../lib/logger.js";

const log = createLogger("SpeakerNovelty");
const dlog = (msg: string): void => {
  if (process.env.SCORING_V4_VERBOSE === "true") log.info(`[soft] ${msg}`);
};

const LOOKBACK_DAYS = 7;
const TABLE = "speaker_utterance_cache";
const NOVEL_FLOOR = 0.3;
const NOVEL_CEILING = 1.0;
const SIM_NOVEL = 0.3; // below this → fully novel
const SIM_SATURATED = 0.9; // above this → floor

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

function normalizeSpeaker(name: string): string {
  return name.toLowerCase().trim();
}

function tokenize(text: string): Set<string> {
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9\s$%.-]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t));
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

/**
 * Apply the decay curve: similarity → commentator-damping factor.
 * 0.3 (very repetitive) ← bounded → 1.0 (novel).
 */
export function similarityToNoveltyFactor(similarity: number): number {
  if (!Number.isFinite(similarity) || similarity <= SIM_NOVEL) {
    return NOVEL_CEILING;
  }
  if (similarity > SIM_SATURATED) {
    return NOVEL_FLOOR;
  }
  // Linear: f(0.3)=1.0, f(0.9)=0.4 → slope = -1.0
  const factor = 1.0 - (similarity - SIM_NOVEL);
  return Math.max(NOVEL_FLOOR, Math.min(NOVEL_CEILING, factor));
}

interface CacheRow {
  speaker: string;
  headline_text: string;
  embedding?: number[] | null;
  created_at?: string;
}

async function fetchRecentUtterances(speaker: string): Promise<CacheRow[]> {
  const sb = getSupabaseClient();
  if (!sb) return [];
  const since = new Date(
    Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
  try {
    const { data, error } = await sb
      .from(TABLE)
      .select("speaker,headline_text,embedding,created_at")
      .eq("speaker", normalizeSpeaker(speaker))
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) {
      // Table missing or not yet migrated → treat as empty. Do not throw.
      dlog(`fetchRecentUtterances soft-fail: ${error.message}`);
      return [];
    }
    return (data as CacheRow[]) ?? [];
  } catch (err) {
    dlog(`fetchRecentUtterances threw: ${String(err)}`);
    return [];
  }
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (!a.length || !b.length || a.length !== b.length) return 0;
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * Compute max similarity between the new headline and the speaker's prior
 * utterances in the last 7 days. Uses pgvector embeddings if present, otherwise
 * Jaccard on tokens.
 */
export async function computeMaxPriorSimilarity(
  speaker: string,
  headline: string,
  embedding?: number[] | null,
): Promise<number> {
  const prior = await fetchRecentUtterances(speaker);
  if (prior.length === 0) return 0;

  const needleTokens = tokenize(headline);
  let maxSim = 0;

  for (const row of prior) {
    let sim = 0;
    const priorEmbedding = row.embedding;
    if (
      embedding &&
      Array.isArray(priorEmbedding) &&
      priorEmbedding.length > 0 &&
      embedding.length === priorEmbedding.length
    ) {
      sim = cosineSimilarity(embedding, priorEmbedding);
    } else {
      const priorTokens = tokenize(row.headline_text || "");
      sim = jaccard(needleTokens, priorTokens);
    }
    if (sim > maxSim) maxSim = sim;
    if (maxSim >= SIM_SATURATED) break; // early exit — already at floor
  }
  return maxSim;
}

/**
 * Compute novelty factor ∈ [0.3, 1.0] for a speaker's headline.
 * Returns 1.0 if no prior utterances (novel), 0.3 if highly repetitive.
 * Never throws — degrades to 1.0 (novel) on any DB error.
 */
export async function computeNoveltyFactor(
  speaker: string,
  headline: string,
  embedding?: number[] | null,
): Promise<number> {
  if (!speaker || !headline) return NOVEL_CEILING;
  try {
    const sim = await computeMaxPriorSimilarity(speaker, headline, embedding);
    return similarityToNoveltyFactor(sim);
  } catch (err) {
    dlog(`computeNoveltyFactor fallback: ${String(err)}`);
    return NOVEL_CEILING;
  }
}

/**
 * Record a speaker utterance into the cache. Soft-fails if the table is
 * missing — T2 callers should not block on this.
 */
export async function recordUtterance(
  speaker: string,
  headline: string,
  embedding?: number[] | null,
): Promise<void> {
  if (!speaker || !headline) return;
  const sb = getSupabaseClient();
  if (!sb) return;

  const row: Record<string, unknown> = {
    speaker: normalizeSpeaker(speaker),
    headline_text: headline,
    created_at: new Date().toISOString(),
  };
  if (embedding && embedding.length > 0) {
    row.embedding = embedding;
  }

  try {
    const { error } = await sb.from(TABLE).insert(row);
    if (error) {
      dlog(`recordUtterance soft-fail: ${error.message}`);
    }
  } catch (err) {
    dlog(`recordUtterance threw: ${String(err)}`);
  }
}

/**
 * Purge utterances older than the lookback window. Optional maintenance call.
 */
export async function purgeStaleUtterances(): Promise<number> {
  const sb = getSupabaseClient();
  if (!sb) return 0;
  const cutoff = new Date(
    Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
  try {
    const { count, error } = await sb
      .from(TABLE)
      .delete({ count: "exact" })
      .lt("created_at", cutoff);
    if (error) {
      dlog(`purgeStaleUtterances soft-fail: ${error.message}`);
      return 0;
    }
    return count ?? 0;
  } catch (err) {
    dlog(`purgeStaleUtterances threw: ${String(err)}`);
    return 0;
  }
}

// Exposed for unit-tests and the novelty-sanity script
export const __test = {
  tokenize,
  jaccard,
  cosineSimilarity,
  similarityToNoveltyFactor,
};
