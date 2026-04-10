// [claude-code 2026-03-26] S2-T3: Commentator registry service — in-memory cache + fuzzy match + CRUD delegation

import type {
  CommentatorEntry,
  CommentatorTier,
} from "../../types/commentator.js";
import {
  TIER_DEFAULT_MULTIPLIERS,
  UNTAGGED_MULTIPLIER,
} from "../../types/commentator.js";
import {
  readCommentatorRegistry,
  writeCommentator,
  updateCommentatorEntry,
  deactivateCommentator,
} from "../supabase-service.js";

// ─── In-memory cache ──────────────────────────────────────────

let registry: CommentatorEntry[] = [];
let registryLoadedAt = 0;
const CACHE_TTL = 300_000; // 5 min

export function clearRegistryCache(): void {
  registry = [];
  registryLoadedAt = 0;
}

// Internal alias
const clearCache = clearRegistryCache;

// ─── Registry CRUD ────────────────────────────────────────────

export async function getRegistry(): Promise<CommentatorEntry[]> {
  if (Date.now() - registryLoadedAt < CACHE_TTL && registry.length > 0) {
    return registry;
  }
  registry = await readCommentatorRegistry();
  registryLoadedAt = Date.now();
  return registry;
}

export async function addCommentator(
  entry: Omit<CommentatorEntry, "id" | "createdAt">,
): Promise<CommentatorEntry | null> {
  const id = await writeCommentator(entry);
  if (!id) return null;
  clearCache();
  const fresh = await getRegistry();
  return fresh.find((e) => e.id === id) ?? null;
}

export async function updateCommentator(
  id: string,
  updates: Partial<CommentatorEntry>,
): Promise<void> {
  // Map TS field names to DB column names
  const dbUpdates: Record<string, unknown> = {};
  if (updates.name !== undefined) dbUpdates.name = updates.name;
  if (updates.aliases !== undefined) dbUpdates.aliases = updates.aliases;
  if (updates.tier !== undefined) dbUpdates.tier = updates.tier;
  if (updates.role !== undefined) dbUpdates.role = updates.role;
  if (updates.institution !== undefined)
    dbUpdates.institution = updates.institution;
  if (updates.weightMultiplier !== undefined)
    dbUpdates.weight_multiplier = updates.weightMultiplier;
  if (updates.active !== undefined) dbUpdates.active = updates.active;

  await updateCommentatorEntry(id, dbUpdates);
  clearCache();
}

export async function removeCommentator(id: string): Promise<void> {
  await deactivateCommentator(id);
  clearCache();
}

// ─── Speaker Lookup ───────────────────────────────────────────

export async function getMultiplierForSpeaker(
  speakerName: string,
): Promise<number> {
  const reg = await getRegistry();
  const match = fuzzyMatchSpeaker(speakerName, reg);
  if (!match) return UNTAGGED_MULTIPLIER;
  return (
    match.weightMultiplier ??
    TIER_DEFAULT_MULTIPLIERS[match.tier as CommentatorTier] ??
    UNTAGGED_MULTIPLIER
  );
}

/**
 * Case-insensitive fuzzy match against entry.name and entry.aliases[].
 * Handles partial matches: "Powell" matches alias "Jerome Powell".
 */
export function fuzzyMatchSpeaker(
  name: string,
  entries: CommentatorEntry[],
): CommentatorEntry | null {
  const needle = name.toLowerCase().trim();
  if (!needle) return null;

  // Pass 1: exact match on name or alias
  for (const entry of entries) {
    if (entry.name.toLowerCase() === needle) return entry;
    if (entry.aliases.some((a) => a.toLowerCase() === needle)) return entry;
  }

  // Pass 2: partial match — needle is a substring of alias or vice versa
  for (const entry of entries) {
    if (entry.name.toLowerCase().includes(needle)) return entry;
    if (entry.aliases.some((a) => a.toLowerCase().includes(needle)))
      return entry;
    // Reverse: alias is a substring of needle (e.g. needle = "Jerome Powell", alias = "Powell")
    if (entry.aliases.some((a) => needle.includes(a.toLowerCase())))
      return entry;
  }

  return null;
}
