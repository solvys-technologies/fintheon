// [claude-code 2026-04-19] S24-T3: Lexicon keyword cache for V4 macro-level gate.
// Reads lexicon_keywords (T1 migration) into memory, refreshes every 60s.
// Survives the table being absent (returns empty array) so the V3 → V4 transition is safe.

import { getSupabaseClient } from "../../config/supabase.js";
import { createLogger } from "../../lib/logger.js";

const log = createLogger("LexiconCache");

export interface LexiconKeyword {
  id: string;
  keyword: string;
  phrasePattern: string | null;
  sentiment: "bullish" | "bearish" | "neutral";
  isMatrixFlip: boolean;
  targetRegime: string | null;
  requiresActionVerb: boolean;
  approved: boolean;
  expiresAt: string | null;
}

let cache: LexiconKeyword[] = [];
let cacheLoadedAt = 0;
const CACHE_TTL_MS = 60_000;

export function isLexiconCacheStale(): boolean {
  return Date.now() - cacheLoadedAt > CACHE_TTL_MS;
}

export async function getLexicon(): Promise<LexiconKeyword[]> {
  if (!isLexiconCacheStale() && cache.length > 0) return cache;
  await refreshLexicon();
  return cache;
}

export async function refreshLexicon(): Promise<void> {
  const sb = getSupabaseClient();
  if (!sb) {
    cacheLoadedAt = Date.now();
    return;
  }

  const nowIso = new Date().toISOString();
  const { data, error } = await sb
    .from("lexicon_keywords")
    .select(
      "id, keyword, phrase_pattern, sentiment, is_matrix_flip, target_regime, requires_action_verb, approved, expires_at",
    )
    .eq("approved", true)
    .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
    .limit(2000);

  if (error) {
    // T1 migration may not have landed yet — degrade gracefully
    if (
      error.code === "42P01" ||
      /relation .* does not exist/i.test(error.message)
    ) {
      cache = [];
      cacheLoadedAt = Date.now();
      return;
    }
    log.warn("Lexicon load failed", { error: error.message });
    return;
  }

  cache = (data ?? []).map((row) => ({
    id: row.id as string,
    keyword: ((row.keyword as string) ?? "").toLowerCase(),
    phrasePattern: (row.phrase_pattern as string | null) ?? null,
    sentiment:
      (row.sentiment as "bullish" | "bearish" | "neutral") ?? "neutral",
    isMatrixFlip: Boolean(row.is_matrix_flip),
    targetRegime: (row.target_regime as string | null) ?? null,
    requiresActionVerb: row.requires_action_verb !== false,
    approved: Boolean(row.approved),
    expiresAt: (row.expires_at as string | null) ?? null,
  }));
  cacheLoadedAt = Date.now();
}

/** Find the first lexicon entry whose keyword/phrase appears in the headline. Case-insensitive. */
export function findLexiconMatch(
  headline: string,
  entries: LexiconKeyword[] = cache,
): LexiconKeyword | null {
  if (!headline) return null;
  const lower = headline.toLowerCase();
  for (const entry of entries) {
    if (entry.phrasePattern) {
      try {
        if (new RegExp(entry.phrasePattern, "i").test(headline)) return entry;
      } catch {
        // Bad regex in DB — skip silently
      }
      continue;
    }
    if (entry.keyword && lower.includes(entry.keyword)) return entry;
  }
  return null;
}

/** Test seam — used by rescore-all to inject a snapshot rather than refetch per item. */
export function setLexiconCacheForTesting(entries: LexiconKeyword[]): void {
  cache = entries;
  cacheLoadedAt = Date.now();
}
