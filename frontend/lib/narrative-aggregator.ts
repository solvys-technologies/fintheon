// [claude-code 2026-03-27] Semantic zoom aggregation — merges cards into narrative summaries at month/quarter/year zoom

import type {
  CatalystCard, NarrativeAggregateCard, NarrativeCategory,
  CatalystSeverity, CatalystSentiment, ZoomLevel,
} from './narrative-types';
import type { GridColumn } from './narrative-grid-layout';

const SEVERITY_RANK: Record<CatalystSeverity, number> = { high: 3, medium: 2, low: 1 };

/**
 * Aggregate cards into summary cards per lane x time bucket.
 *
 * Semantic zoom model:
 * - Week: "Liberation Day" (individual card)
 * - Month: "Trade Tensions Flare" (aggregates Liberation Day + China retaliates + EU responds)
 * - Quarter: "Trump Trade War" (aggregates all trade-tension month cards)
 * - Year: "2026 Geopolitical Realignment" (aggregates quarter themes)
 *
 * Rules:
 * 1. Group cards by riskCategory + column key
 * 2. Title = highest-severity card's title (user can edit later)
 * 3. Severity = max severity in group
 * 4. Sentiment = dominant sentiment (majority wins, tie -> bearish)
 * 5. Only aggregate root cards (drillDepth === 0)
 */
export function aggregateCards(
  catalysts: CatalystCard[],
  columns: GridColumn[],
  riskCategory: NarrativeCategory,
  _zoomLevel: ZoomLevel,
): NarrativeAggregateCard[] {
  // Only root cards for the given category
  const rootCards = catalysts.filter(
    c => c.drillDepth === 0 && c.category === riskCategory,
  );

  const aggregates: NarrativeAggregateCard[] = [];

  for (const col of columns) {
    const inBucket = rootCards.filter(c => {
      const d = new Date(c.date);
      return d >= col.startDate && d <= col.endDate;
    });

    if (inBucket.length === 0) continue;

    // Pick title from highest-severity card
    const sorted = [...inBucket].sort(
      (a, b) => (SEVERITY_RANK[b.severity] ?? 0) - (SEVERITY_RANK[a.severity] ?? 0),
    );

    aggregates.push({
      id: `agg-${riskCategory}-${col.key}`,
      title: sorted[0].title,
      riskCategory,
      timeBucket: col.key,
      constituentCardIds: inBucket.map(c => c.id),
      severity: maxSeverity(inBucket),
      sentiment: dominantSentiment(inBucket),
      cardCount: inBucket.length,
    });
  }

  return aggregates;
}

function dominantSentiment(cards: CatalystCard[]): CatalystSentiment {
  let bullish = 0;
  let bearish = 0;
  for (const c of cards) {
    if (c.sentiment === 'bullish') bullish++;
    else bearish++;
  }
  // Tie goes bearish (conservative)
  return bullish > bearish ? 'bullish' : 'bearish';
}

function maxSeverity(cards: CatalystCard[]): CatalystSeverity {
  let max: CatalystSeverity = 'low';
  for (const c of cards) {
    if (SEVERITY_RANK[c.severity] > SEVERITY_RANK[max]) {
      max = c.severity;
    }
  }
  return max;
}
