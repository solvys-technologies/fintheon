// [claude-code 2026-03-28] S5-T5: Rope engine — auto-connects cards by shared tags
import type { CatalystCard } from './narrative-types';

export interface RopeConnection {
  id: string;
  fromId: string;
  toId: string;
  sharedTags: string[];
  strength: number; // 0-1 based on tag overlap ratio
}

const DEFAULT_MAX = 100;
const MIN_STRENGTH = 0.2;

/**
 * Compute rope connections between all cards based on shared tags.
 * Two cards are connected if they share >= 1 tag.
 * Strength = sharedTags.length / Math.min(card1.tags.length, card2.tags.length)
 *
 * Limits:
 * - Max connections total (default 100, prune weakest)
 * - Min strength threshold: 0.2
 * - Don't connect cards in the same category+time bucket (too close visually)
 */
export function computeRopeConnections(
  cards: CatalystCard[],
  maxConnections = DEFAULT_MAX,
): RopeConnection[] {
  // Only consider cards that have tags
  const tagged = cards.filter(c => c.tags && c.tags.length > 0);
  if (tagged.length < 2) return [];

  const connections: RopeConnection[] = [];

  for (let i = 0; i < tagged.length; i++) {
    const a = tagged[i];
    const aTags = new Set(a.tags!);

    for (let j = i + 1; j < tagged.length; j++) {
      const b = tagged[j];

      // Skip cards in the same category — too close visually
      if (a.category && b.category && a.category === b.category) {
        // Also check date proximity (same week = same time bucket)
        const aWeek = a.date.slice(0, 10);
        const bWeek = b.date.slice(0, 10);
        const dayDiff = Math.abs(
          new Date(aWeek).getTime() - new Date(bWeek).getTime(),
        ) / 86_400_000;
        if (dayDiff < 7) continue;
      }

      const shared = b.tags!.filter(t => aTags.has(t));
      if (shared.length === 0) continue;

      const minLen = Math.min(aTags.size, b.tags!.length);
      const strength = minLen > 0 ? shared.length / minLen : 0;
      if (strength < MIN_STRENGTH) continue;

      connections.push({
        id: `rope-${a.id}-${b.id}`,
        fromId: a.id,
        toId: b.id,
        sharedTags: shared,
        strength,
      });
    }
  }

  // Sort by strength descending, keep top N
  connections.sort((a, b) => b.strength - a.strength);
  return connections.slice(0, maxConnections);
}
