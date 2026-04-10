// [claude-code 2026-03-28] S9-T5-T3: Hierarchical zoom — temporal clusters + category groups
import type {
  CatalystCard,
  NarrativeCategory,
  CatalystSentiment,
} from "./narrative-types";

export type MarketRegime = "risk-on" | "risk-off" | "rotation" | "neutral";

export interface TemporalCluster {
  id: string;
  narrativeSlug: string;
  weekKey: string;
  label: string;
  cards: CatalystCard[];
  dominantSentiment: CatalystSentiment;
  maxSeverity: "high" | "medium" | "low";
  center: { x: number; y: number };
}

export interface CategoryGroup {
  id: string;
  category: NarrativeCategory;
  regime: MarketRegime;
  threads: string[];
  cardCount: number;
  center: { x: number; y: number };
}

export function getWeekKey(dateStr: string): string {
  const d = new Date(dateStr);
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNum = Math.ceil(
    ((d.getTime() - yearStart.getTime()) / 86400000 + yearStart.getDay() + 1) /
      7,
  );
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

export function getWeekLabel(weekKey: string): string {
  const [, week] = weekKey.split("-W");
  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const weekNum = parseInt(week);
  const monthIndex = Math.min(11, Math.floor((weekNum - 1) / 4.33));
  const weekInMonth = Math.ceil(weekNum - monthIndex * 4.33);
  return `${monthNames[monthIndex]} W${weekInMonth}`;
}

export function computeTemporalClusters(
  cards: CatalystCard[],
  positions: Map<string, { x: number; y: number }>,
): TemporalCluster[] {
  const groups = new Map<string, CatalystCard[]>();
  for (const card of cards) {
    const narrative =
      card.narrative ?? card.narrativeThreads?.[0] ?? "unassigned";
    const weekKey = getWeekKey(card.date);
    const key = `${narrative}::${weekKey}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(card);
  }

  const clusters: TemporalCluster[] = [];
  for (const [key, groupCards] of groups) {
    const [narrativeSlug, weekKey] = key.split("::");
    let cx = 0,
      cy = 0,
      count = 0;
    for (const c of groupCards) {
      const pos = positions.get(c.id);
      if (pos) {
        cx += pos.x;
        cy += pos.y;
        count++;
      }
    }
    if (count > 0) {
      cx /= count;
      cy /= count;
    }

    const bullish = groupCards.filter((c) => c.sentiment === "bullish").length;
    const dominantSentiment: CatalystSentiment =
      bullish > groupCards.length / 2 ? "bullish" : "bearish";

    const maxSeverity = groupCards.some((c) => c.severity === "high")
      ? "high"
      : groupCards.some((c) => c.severity === "medium")
        ? "medium"
        : "low";

    const threadTitle = narrativeSlug
      .replace(/-/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());

    clusters.push({
      id: `tc-${narrativeSlug}-${weekKey}`,
      narrativeSlug,
      weekKey,
      label: `${threadTitle} — ${getWeekLabel(weekKey)} (${groupCards.length})`,
      cards: groupCards,
      dominantSentiment,
      maxSeverity,
      center: { x: cx, y: cy },
    });
  }
  return clusters;
}

export function computeRegime(cards: CatalystCard[]): MarketRegime {
  if (cards.length === 0) return "neutral";
  const bullish = cards.filter((c) => c.sentiment === "bullish").length;
  const ratio = bullish / cards.length;
  if (ratio >= 0.6) return "risk-on";
  if (ratio <= 0.4) return "risk-off";
  return "rotation";
}

export function computeCategoryGroups(
  cards: CatalystCard[],
  _clusters: TemporalCluster[],
  positions: Map<string, { x: number; y: number }>,
): CategoryGroup[] {
  const catMap = new Map<NarrativeCategory, CatalystCard[]>();
  for (const card of cards) {
    const cat = card.category ?? "macroeconomic";
    if (!catMap.has(cat)) catMap.set(cat, []);
    catMap.get(cat)!.push(card);
  }

  const groups: CategoryGroup[] = [];
  for (const [category, catCards] of catMap) {
    const threads = [
      ...new Set(
        catCards
          .map((c) => c.narrative ?? c.narrativeThreads?.[0])
          .filter(Boolean),
      ),
    ] as string[];
    let cx = 0,
      cy = 0,
      count = 0;
    for (const c of catCards) {
      const pos = positions.get(c.id);
      if (pos) {
        cx += pos.x;
        cy += pos.y;
        count++;
      }
    }
    if (count > 0) {
      cx /= count;
      cy /= count;
    }

    groups.push({
      id: `cg-${category}`,
      category,
      regime: computeRegime(catCards),
      threads,
      cardCount: catCards.length,
      center: { x: cx, y: cy },
    });
  }
  return groups;
}
