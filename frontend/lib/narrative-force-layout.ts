// [claude-code 2026-03-28] S7: Force-directed layout config for NarrativeFlow mind map
import type { NarrativeCategory } from "./narrative-types";
export {
  NARRATIVE_THREADS,
  THREAD_MAP,
  TERRITORY_LAYOUT,
  HUB_POSITIONS,
  CROSS_NARRATIVE_ROPE,
  SEVERITY_COLORS,
  safeSlug,
  getSemanticZoom,
  getMonthKey,
  formatDateShort,
  deriveIvScore,
  deriveCyclicality,
} from "./narrative-territory-layout";

// Category cluster positions — arranged in a circle for visual balance
export const CATEGORY_CENTERS: Record<
  NarrativeCategory,
  { x: number; y: number }
> = {
  geopolitical: { x: -400, y: -250 },
  monetary: { x: 400, y: -250 },
  macroeconomic: { x: 0, y: -350 },
  "market-structure": { x: -400, y: 250 },
  earnings: { x: 400, y: 250 },
  "supply-chain": { x: 0, y: 350 },
  "black-swan": { x: 0, y: 0 },
};

// [claude-code 2026-04-19] S25-T6: Category colors now reference CSS tokens (--narrative-*) so themes can repaint the map without touching JS. Consumers keep the same hex-string API via getCategoryColor(); the fallback hex values below are read only when the CSS var resolves to empty (pre-boot or theme not yet loaded).
const NARRATIVE_TOKEN_FALLBACK: Record<NarrativeCategory, string> = {
  geopolitical: "#F59E0B",
  monetary: "#8B5CF6",
  macroeconomic: "#3B82F6",
  "market-structure": "#EC4899",
  earnings: "#34D399",
  "supply-chain": "#14B8A6",
  "black-swan": "#EF4444",
};

const NARRATIVE_TOKEN_VAR: Record<NarrativeCategory, string> = {
  geopolitical: "--narrative-geopolitical",
  monetary: "--narrative-monetary",
  macroeconomic: "--narrative-macroeconomic",
  "market-structure": "--narrative-market-structure",
  earnings: "--narrative-earnings",
  "supply-chain": "--narrative-supply-chain",
  "black-swan": "--narrative-black-swan",
};

export function getCategoryColor(cat: NarrativeCategory): string {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return NARRATIVE_TOKEN_FALLBACK[cat];
  }
  const resolved = getComputedStyle(document.documentElement)
    .getPropertyValue(NARRATIVE_TOKEN_VAR[cat])
    .trim();
  return resolved || NARRATIVE_TOKEN_FALLBACK[cat];
}

/** Back-compat object API — each access resolves via the CSS token bridge. */
export const CATEGORY_COLORS: Record<NarrativeCategory, string> = new Proxy(
  {} as Record<NarrativeCategory, string>,
  {
    get(_target, prop: string) {
      if (prop in NARRATIVE_TOKEN_FALLBACK) {
        return getCategoryColor(prop as NarrativeCategory);
      }
      return undefined;
    },
  },
);

// Severity → node radius
export function severityRadius(severity: string): number {
  if (severity === "high") return 24;
  if (severity === "medium") return 18;
  return 14;
}

// Force simulation parameters
export const FORCE_CONFIG = {
  // Charge: negative = repel, strength scales with node count
  charge: -120,
  // Link force for rope connections
  linkDistance: 100,
  linkStrength: 0.3,
  // Cluster force: pull toward category center
  clusterStrength: 0.08,
  // Collision: prevent overlap
  collisionPadding: 8,
  // Temporal: pull same-date events together on X axis
  temporalStrength: 0.02,
  // Alpha decay: how fast simulation cools
  alphaDecay: 0.015,
  velocityDecay: 0.3,
};

// Zoom thresholds for rendering modes
export const ZOOM_THRESHOLDS = {
  fullCard: 1.5, // >= 1.5x: full card with description
  miniCard: 0.7, // >= 0.7x: mini card with title
  bubble: 0.3, // >= 0.3x: colored bubble with count
  dot: 0, // < 0.3x: severity dot only
};

// Map date to x position (temporal axis)
export function dateToX(date: string, anchorDate: Date): number {
  const d = new Date(date);
  const diffDays = (d.getTime() - anchorDate.getTime()) / (1000 * 60 * 60 * 24);
  return diffDays * 8; // 8px per day
}

// ── Concentric ring layout for reset/snap ────────────────────
const RING_RADII: Record<string, number> = { high: 120, medium: 220, low: 320 };
const GOLDEN_ANGLE = 0.618 * Math.PI;
const SIBLING_STACK_OFFSET = 60;

export interface RingCard {
  id: string;
  severity: "high" | "medium" | "low";
  siblingIndex?: number;
  siblingCount?: number;
  siblingGroupId?: string;
}

export function computeConcentricPositions(
  hubCenter: { x: number; y: number },
  cards: RingCard[],
): Map<string, { x: number; y: number }> {
  const result = new Map<string, { x: number; y: number }>();

  // Partition by severity
  const buckets: Record<string, RingCard[]> = { high: [], medium: [], low: [] };
  for (const card of cards) {
    buckets[card.severity].push(card);
  }

  // Deduplicate sibling groups — treat each group as one slot
  const ringEntries: [string, RingCard[]][] = Object.entries(buckets);

  for (let ringIdx = 0; ringIdx < ringEntries.length; ringIdx++) {
    const [severity, ringCards] = ringEntries[ringIdx];
    const radius = RING_RADII[severity];

    // Group siblings together
    const slots: RingCard[][] = [];
    const siblingGroups = new Map<string, RingCard[]>();

    for (const card of ringCards) {
      if (card.siblingGroupId) {
        const group = siblingGroups.get(card.siblingGroupId) ?? [];
        group.push(card);
        siblingGroups.set(card.siblingGroupId, group);
      } else {
        slots.push([card]);
      }
    }
    for (const group of siblingGroups.values()) {
      slots.push(
        group.sort((a, b) => (a.siblingIndex ?? 0) - (b.siblingIndex ?? 0)),
      );
    }

    const n = slots.length;
    if (n === 0) continue;

    const angleStep = (2 * Math.PI) / n;
    const baseAngle = ringIdx * GOLDEN_ANGLE;

    for (let i = 0; i < n; i++) {
      const angle = baseAngle + i * angleStep;
      const slotX = hubCenter.x + radius * Math.cos(angle);
      const slotY = hubCenter.y + radius * Math.sin(angle);

      for (let s = 0; s < slots[i].length; s++) {
        result.set(slots[i][s].id, {
          x: slotX,
          y: slotY + s * SIBLING_STACK_OFFSET,
        });
      }
    }
  }

  return result;
}
