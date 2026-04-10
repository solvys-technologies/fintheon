// [claude-code 2026-03-28] Narrative-aware aggregation — groups by narrative theme at month/quarter/year zoom
// [claude-code 2026-03-27] Semantic zoom aggregation — merges cards into narrative summaries at month/quarter/year zoom

import type {
  CatalystCard,
  NarrativeAggregateCard,
  NarrativeCategory,
  CatalystSeverity,
  CatalystSentiment,
  ZoomLevel,
} from "./narrative-types";
import type { GridColumn } from "./narrative-grid-layout";

const SEVERITY_RANK: Record<CatalystSeverity, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

/**
 * Aggregate cards into summary cards per lane x time bucket.
 *
 * Semantic zoom model:
 * - Week: Individual cards ("Liberation Day", "CPI Hot Print")
 * - Month: Narrative groups ("Trump Tariff War ×4", "Fed Rate Cycle ×2")
 * - Quarter: Narrative themes merge further ("Trade War ×12")
 * - Year: Category-level aggregates ("Geopolitical ×30")
 *
 * Rules:
 * 1. Group cards by riskCategory + column key
 * 2. Within each bucket, sub-group by narrative theme (if cards have `narrative` field)
 * 3. Title = narrative name if available, else highest-severity card's title
 * 4. Severity = max severity in group
 * 5. Sentiment = dominant sentiment (majority wins, tie -> bearish)
 * 6. Only aggregate root cards (drillDepth === 0)
 */
export function aggregateCards(
  catalysts: CatalystCard[],
  columns: GridColumn[],
  riskCategory: NarrativeCategory,
  zoomLevel: ZoomLevel,
): NarrativeAggregateCard[] {
  // Only root cards for the given category
  const rootCards = catalysts.filter(
    (c) => c.drillDepth === 0 && c.category === riskCategory,
  );

  const aggregates: NarrativeAggregateCard[] = [];

  for (const col of columns) {
    const inBucket = rootCards.filter((c) => {
      const d = new Date(c.date);
      return d >= col.startDate && d <= col.endDate;
    });

    if (inBucket.length === 0) continue;

    // At month/quarter/year zoom: sub-group by narrative theme for richer aggregates
    if (zoomLevel !== "week" && inBucket.some((c) => c.narrative)) {
      const byNarrative = new Map<string, CatalystCard[]>();
      for (const card of inBucket) {
        const key = card.narrative ?? "_ungrouped";
        if (!byNarrative.has(key)) byNarrative.set(key, []);
        byNarrative.get(key)!.push(card);
      }

      for (const [narrative, cards] of byNarrative) {
        const sorted = [...cards].sort(
          (a, b) =>
            (SEVERITY_RANK[b.severity] ?? 0) - (SEVERITY_RANK[a.severity] ?? 0),
        );
        // Use narrative name as title, fall back to highest-severity card's title
        const title =
          narrative !== "_ungrouped"
            ? `${narrative} (×${cards.length})`
            : sorted[0].title;

        aggregates.push({
          id: `agg-${riskCategory}-${col.key}-${narrative.slice(0, 20)}`,
          title,
          riskCategory,
          timeBucket: col.key,
          constituentCardIds: cards.map((c) => c.id),
          severity: maxSeverity(cards),
          sentiment: dominantSentiment(cards),
          cardCount: cards.length,
        });
      }
    } else {
      // Week zoom or no narratives: single aggregate per bucket
      const sorted = [...inBucket].sort(
        (a, b) =>
          (SEVERITY_RANK[b.severity] ?? 0) - (SEVERITY_RANK[a.severity] ?? 0),
      );

      aggregates.push({
        id: `agg-${riskCategory}-${col.key}`,
        title: sorted[0].title,
        riskCategory,
        timeBucket: col.key,
        constituentCardIds: inBucket.map((c) => c.id),
        severity: maxSeverity(inBucket),
        sentiment: dominantSentiment(inBucket),
        cardCount: inBucket.length,
      });
    }
  }

  return splitOversizedAggregates(aggregates);
}

const MAX_ITEMS_PER_CARD = 25;

function splitOversizedAggregates(
  aggregates: NarrativeAggregateCard[],
): NarrativeAggregateCard[] {
  const result: NarrativeAggregateCard[] = [];

  for (const agg of aggregates) {
    if (agg.constituentCardIds.length <= MAX_ITEMS_PER_CARD) {
      result.push(agg);
      continue;
    }

    const ids = agg.constituentCardIds;
    const pageCount = Math.ceil(ids.length / MAX_ITEMS_PER_CARD);

    for (let i = 0; i < pageCount; i++) {
      const chunk = ids.slice(
        i * MAX_ITEMS_PER_CARD,
        (i + 1) * MAX_ITEMS_PER_CARD,
      );
      result.push({
        ...agg,
        id: `${agg.id}-p${i}`,
        title: `${agg.title} ${i + 1}/${pageCount}`,
        constituentCardIds: chunk,
        cardCount: chunk.length,
        siblingIndex: i,
        siblingCount: pageCount,
        siblingGroupId: agg.id,
      });
    }
  }

  return result;
}

function dominantSentiment(cards: CatalystCard[]): CatalystSentiment {
  let bullish = 0;
  let bearish = 0;
  for (const c of cards) {
    if (c.sentiment === "bullish") bullish++;
    else bearish++;
  }
  // Tie goes bearish (conservative)
  return bullish > bearish ? "bullish" : "bearish";
}

function maxSeverity(cards: CatalystCard[]): CatalystSeverity {
  let max: CatalystSeverity = "low";
  for (const c of cards) {
    if (SEVERITY_RANK[c.severity] > SEVERITY_RANK[max]) {
      max = c.severity;
    }
  }
  return max;
}
