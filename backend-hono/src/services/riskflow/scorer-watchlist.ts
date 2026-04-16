// [claude-code 2026-04-16] S20-T9: Split from central-scorer.ts — POI priority boost
// [claude-code 2026-03-31] POI priority boost — Top 3 POI = Critical (macroLevel 4), Top 8 = High (macroLevel 3)

import {
  DEFAULT_COMMENTATORS,
  type CommentatorEntry,
} from "../../types/commentator.js";
import type { FeedItem } from "../../types/riskflow.js";

// ── Person of Interest Priority Boost ────────────────────────────────────────
// Commentary is a PRIMARY market driver. Any headline mentioning a POI gets
// boosted: Top 3 (rank 1-3) → Critical (macroLevel 4), Top 8 (rank 4-8) → High (macroLevel 3).
// All remaining POI mentions → at least Medium (macroLevel 2).

const POI_ALIAS_MAP = new Map<
  string,
  Omit<CommentatorEntry, "id" | "createdAt">
>();
for (const c of DEFAULT_COMMENTATORS) {
  if (!c.active) continue;
  for (const alias of c.aliases) {
    POI_ALIAS_MAP.set(alias.toLowerCase(), c);
  }
  POI_ALIAS_MAP.set(c.name.toLowerCase(), c);
}

export function matchPersonOfInterest(
  headline: string,
): Omit<CommentatorEntry, "id" | "createdAt"> | null {
  const text = headline.toLowerCase();
  let bestMatch: Omit<CommentatorEntry, "id" | "createdAt"> | null = null;

  for (const [alias, entry] of POI_ALIAS_MAP) {
    if (text.includes(alias)) {
      if (!bestMatch || entry.rank < bestMatch.rank) {
        bestMatch = entry;
      }
    }
  }

  return bestMatch;
}

export function applyPOIBoost(item: FeedItem): string | null {
  const poi = matchPersonOfInterest(item.headline);
  if (!poi) return null;

  const currentLevel = item.macroLevel ?? 1;

  if (poi.rank <= 3) {
    item.macroLevel = 4;
  } else if (poi.rank <= 8) {
    item.macroLevel = Math.max(currentLevel, 3) as FeedItem["macroLevel"];
  } else {
    item.macroLevel = Math.max(currentLevel, 2) as FeedItem["macroLevel"];
  }

  if (!item.tags) item.tags = [];
  if (!item.tags.includes("POI")) item.tags.push("POI");

  return poi.name;
}
