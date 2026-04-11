// [claude-code 2026-04-11] Watchlist phrases service — Catalyst Watch for sticky bulletin
// Stores user-submitted bias-neutral phrases, matched against scored items in central-scorer
import { sql, isDatabaseAvailable } from "../../config/database.js";

const BIAS_WORDS = new Set([
  "bullish",
  "bearish",
  "buy",
  "sell",
  "long",
  "short",
  "calls",
  "puts",
]);

export interface WatchlistPhrase {
  id: number;
  userId: string;
  phrase: string;
  phraseLower: string;
  isActive: boolean;
  matchType: "contains" | "exact";
  repeating: boolean;
  matchCount: number;
  lastMatchedAt: string | null;
  createdAt: string;
}

// In-memory fallback
const memoryPhrases: WatchlistPhrase[] = [];
let nextMemId = 1;

// In-memory cache for scoring cycle lookups (refreshed every 60s)
let phraseCache: WatchlistPhrase[] = [];
let phraseCacheTime = 0;
const CACHE_TTL = 60_000;

/**
 * Strip bias words from a phrase. Returns { cleaned, removed }.
 */
export function stripBias(phrase: string): {
  cleaned: string;
  removed: string[];
} {
  const words = phrase.trim().split(/\s+/);
  const removed: string[] = [];
  const kept: string[] = [];
  for (const w of words) {
    if (BIAS_WORDS.has(w.toLowerCase())) {
      removed.push(w);
    } else {
      kept.push(w);
    }
  }
  return { cleaned: kept.join(" "), removed };
}

/**
 * Add a watchlist phrase for a user
 */
export async function addPhrase(
  userId: string,
  data: {
    phrase: string;
    matchType?: "contains" | "exact";
    repeating?: boolean;
  },
): Promise<{ phrase: WatchlistPhrase; removedBias: string[] }> {
  const { cleaned, removed } = stripBias(data.phrase);

  if (!cleaned.trim()) {
    throw new Error("Phrase is empty after removing bias words");
  }

  const words = cleaned.trim().split(/\s+/);
  if (words.length > 10) {
    throw new Error("Phrase must be 10 words or fewer");
  }

  const phraseLower = cleaned.toLowerCase();
  const matchType = data.matchType ?? "contains";
  const repeating = data.repeating ?? false;

  if (!isDatabaseAvailable() || !sql) {
    const existing = memoryPhrases.find(
      (p) => p.userId === userId && p.phraseLower === phraseLower && p.isActive,
    );
    if (existing) throw new Error("Phrase already exists");

    const entry: WatchlistPhrase = {
      id: nextMemId++,
      userId,
      phrase: cleaned,
      phraseLower,
      isActive: true,
      matchType,
      repeating,
      matchCount: 0,
      lastMatchedAt: null,
      createdAt: new Date().toISOString(),
    };
    memoryPhrases.push(entry);
    return { phrase: entry, removedBias: removed };
  }

  try {
    const result = await sql`
      INSERT INTO watchlist_phrases (user_id, phrase, phrase_lower, match_type, repeating)
      VALUES (${userId}, ${cleaned}, ${phraseLower}, ${matchType}, ${repeating})
      RETURNING id, user_id, phrase, phrase_lower, is_active, match_type, repeating,
                match_count, last_matched_at, created_at
    `;
    return { phrase: rowToPhrase(result[0]), removedBias: removed };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("does not exist")) {
      await ensureTable();
      return addPhrase(userId, data);
    }
    if (msg.includes("unique") || msg.includes("duplicate")) {
      throw new Error("Phrase already exists");
    }
    throw err;
  }
}

/**
 * Get all active phrases for a user
 */
export async function getUserPhrases(
  userId: string,
): Promise<WatchlistPhrase[]> {
  if (!isDatabaseAvailable() || !sql) {
    return memoryPhrases.filter((p) => p.userId === userId && p.isActive);
  }

  try {
    const result = await sql`
      SELECT id, user_id, phrase, phrase_lower, is_active, match_type, repeating,
             match_count, last_matched_at, created_at
      FROM watchlist_phrases
      WHERE user_id = ${userId} AND is_active = true
      ORDER BY created_at DESC
    `;
    return (result as any[]).map(rowToPhrase);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("does not exist")) {
      await ensureTable();
      return [];
    }
    throw err;
  }
}

/**
 * Delete (deactivate) a phrase
 */
export async function deletePhrase(
  userId: string,
  phraseId: number,
): Promise<boolean> {
  if (!isDatabaseAvailable() || !sql) {
    const idx = memoryPhrases.findIndex(
      (p) => p.id === phraseId && p.userId === userId,
    );
    if (idx === -1) return false;
    memoryPhrases[idx].isActive = false;
    return true;
  }

  try {
    const result = await sql`
      UPDATE watchlist_phrases
      SET is_active = false
      WHERE id = ${phraseId} AND user_id = ${userId}
      RETURNING id
    `;
    return result.length > 0;
  } catch {
    return false;
  }
}

/**
 * Record a match for a phrase — increment counter, update timestamp.
 * If phrase is one-time (not repeating), deactivate it after first match.
 */
export async function recordMatch(phraseId: number): Promise<void> {
  if (!isDatabaseAvailable() || !sql) {
    const p = memoryPhrases.find((x) => x.id === phraseId);
    if (p) {
      p.matchCount++;
      p.lastMatchedAt = new Date().toISOString();
      if (!p.repeating) p.isActive = false;
    }
    return;
  }

  await sql`
    UPDATE watchlist_phrases
    SET match_count = match_count + 1,
        last_matched_at = NOW(),
        is_active = CASE WHEN repeating THEN true ELSE false END
    WHERE id = ${phraseId}
  `;
}

/**
 * Get ALL active phrases across all users (for scoring cycle).
 * Uses in-memory cache with 60s TTL.
 */
export async function getAllActivePhrases(): Promise<WatchlistPhrase[]> {
  const now = Date.now();
  if (now - phraseCacheTime < CACHE_TTL && phraseCache.length > 0) {
    return phraseCache;
  }

  if (!isDatabaseAvailable() || !sql) {
    phraseCache = memoryPhrases.filter((p) => p.isActive);
    phraseCacheTime = now;
    return phraseCache;
  }

  try {
    const result = await sql`
      SELECT id, user_id, phrase, phrase_lower, is_active, match_type, repeating,
             match_count, last_matched_at, created_at
      FROM watchlist_phrases
      WHERE is_active = true
    `;
    phraseCache = (result as any[]).map(rowToPhrase);
    phraseCacheTime = now;
    return phraseCache;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("does not exist")) {
      await ensureTable();
      return [];
    }
    return phraseCache; // return stale cache on error
  }
}

/**
 * Check if a scored item matches a phrase
 */
export function phraseMatchesItem(
  phrase: WatchlistPhrase,
  headline: string,
  tags: string[],
): boolean {
  const target = [headline, ...tags].join(" ").toLowerCase();
  if (phrase.matchType === "exact") {
    return target.includes(phrase.phraseLower);
  }
  // "contains" — each word in the phrase must appear somewhere in headline+tags
  const words = phrase.phraseLower.split(/\s+/);
  return words.every((w) => target.includes(w));
}

function rowToPhrase(r: any): WatchlistPhrase {
  return {
    id: r.id,
    userId: r.user_id,
    phrase: r.phrase,
    phraseLower: r.phrase_lower,
    isActive: r.is_active,
    matchType: r.match_type ?? "contains",
    repeating: r.repeating ?? false,
    matchCount: parseInt(r.match_count ?? "0", 10),
    lastMatchedAt: r.last_matched_at ?? null,
    createdAt: r.created_at,
  };
}

async function ensureTable(): Promise<void> {
  if (!sql) return;
  await sql`
    CREATE TABLE IF NOT EXISTS watchlist_phrases (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      phrase TEXT NOT NULL,
      phrase_lower TEXT NOT NULL,
      match_type TEXT NOT NULL DEFAULT 'contains',
      repeating BOOLEAN NOT NULL DEFAULT false,
      is_active BOOLEAN DEFAULT true,
      match_count INTEGER DEFAULT 0,
      last_matched_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(user_id, phrase_lower)
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_watchlist_phrases_active
    ON watchlist_phrases (is_active) WHERE is_active = true
  `;
}
