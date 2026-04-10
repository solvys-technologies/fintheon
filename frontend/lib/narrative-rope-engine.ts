// [claude-code 2026-03-28] S8-T3: Rope engine overhaul — hub-to-catalyst + cross-catalyst ropes, narrative thread colors
import type { CatalystCard } from "./narrative-types";

export type RopeKind = "hub-to-catalyst" | "cross-catalyst";

export interface RopeConnection {
  id: string;
  fromId: string;
  toId: string;
  sharedTags: string[];
  strength: number; // 0-1 based on tag overlap ratio
  kind: RopeKind;
  fromNarrative?: string; // narrative thread slug of source card
  toNarrative?: string; // narrative thread slug of target card
  crossNarrative: boolean; // true if the two cards belong to different narratives
}

const DEFAULT_MAX = 200;
const MIN_STRENGTH = 0.15;

/**
 * Compute hub-to-catalyst structural ropes.
 * Every catalyst card links to its narrative hub node (group-{narrative}).
 * These are always visible regardless of tag overlap.
 */
export function computeHubRopes(cards: CatalystCard[]): RopeConnection[] {
  const ropes: RopeConnection[] = [];
  for (const c of cards) {
    const thread = c.narrative ?? c.narrativeThreads?.[0];
    if (!thread) continue;
    ropes.push({
      id: `hub-rope-${c.id}`,
      fromId: c.id,
      toId: `group-${thread}`,
      sharedTags: [],
      strength: 0.3,
      kind: "hub-to-catalyst",
      fromNarrative: thread,
      toNarrative: thread,
      crossNarrative: false,
    });
  }
  return ropes;
}

/**
 * Compute cross-catalyst rope connections based on shared tags.
 * Two cards are connected if they share >= 1 tag.
 * Strength = sharedTags.length / Math.min(card1.tags.length, card2.tags.length)
 */
export function computeRopeConnections(
  cards: CatalystCard[],
  maxConnections = DEFAULT_MAX,
): RopeConnection[] {
  // Only consider cards that have tags
  const tagged = cards.filter((c) => c.tags && c.tags.length > 0);
  if (tagged.length < 2) return [];

  const connections: RopeConnection[] = [];

  for (let i = 0; i < tagged.length; i++) {
    const a = tagged[i];
    const aTags = new Set(a.tags!);

    for (let j = i + 1; j < tagged.length; j++) {
      const b = tagged[j];

      // Skip cards in the same category — too close visually
      if (a.category && b.category && a.category === b.category) {
        const aWeek = a.date.slice(0, 10);
        const bWeek = b.date.slice(0, 10);
        const dayDiff =
          Math.abs(new Date(aWeek).getTime() - new Date(bWeek).getTime()) /
          86_400_000;
        if (dayDiff < 7) continue;
      }

      const shared = b.tags!.filter((t) => aTags.has(t));
      if (shared.length === 0) continue;

      const minLen = Math.min(aTags.size, b.tags!.length);
      const strength = minLen > 0 ? shared.length / minLen : 0;
      if (strength < MIN_STRENGTH) continue;

      const aNarr = a.narrative ?? a.narrativeThreads?.[0];
      const bNarr = b.narrative ?? b.narrativeThreads?.[0];

      connections.push({
        id: `rope-${a.id}-${b.id}`,
        fromId: a.id,
        toId: b.id,
        sharedTags: shared,
        strength,
        kind: "cross-catalyst",
        fromNarrative: aNarr,
        toNarrative: bNarr,
        crossNarrative: aNarr !== bNarr,
      });
    }
  }

  // Sort by strength descending, keep top N
  connections.sort((a, b) => b.strength - a.strength);
  return connections.slice(0, maxConnections);
}
