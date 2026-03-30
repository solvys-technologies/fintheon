// [claude-code 2026-03-27] Highlight → branch utility — text selection to child card creation

import type { CatalystCard, NarrativeCategory } from './narrative-types';

/**
 * Given a parent card and highlighted text, create a child card spec.
 * Returns Omit<CatalystCard, 'id' | 'createdAt' | 'updatedAt'> for the reducer.
 */
export function createBranchCard(
  parent: CatalystCard,
  highlightedText: string,
  targetCategory?: NarrativeCategory,
): Omit<CatalystCard, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    title: highlightedText.slice(0, 60).toUpperCase(),
    description: `Branched from "${parent.title}" — exploring: ${highlightedText}`,
    date: parent.date,
    sentiment: parent.sentiment,
    severity: parent.severity === 'high' ? 'medium' : 'low',
    source: 'research',
    narrativeIds: targetCategory
      ? []  // will be assigned to target lane during MOVE_CARD_TO_LANE
      : parent.narrativeIds,
    isGhost: false,
    templateType: null,
    position: null,
    tags: ['branch', `from:${parent.id.slice(0, 8)}`],
    category: targetCategory ?? parent.category,
    researchBullets: [],
    parentHighlight: highlightedText,
    parentCardId: parent.id,
    childCardIds: [],
    drillDepth: parent.drillDepth + 1,
  };
}

/**
 * Infer if highlighted text implies a different risk category than the parent.
 * Returns the suggested category, or null if it should stay in the same lane.
 *
 * Simple keyword heuristic — can be upgraded to LLM inference later.
 */
export function inferCrossLaneCategory(
  highlightedText: string,
  parentCategory: NarrativeCategory,
): NarrativeCategory | null {
  const text = highlightedText.toLowerCase();

  const categoryKeywords: Record<NarrativeCategory, string[]> = {
    'geopolitical': ['tariff', 'sanction', 'war', 'nato', 'china', 'russia', 'trade war', 'retaliation'],
    'monetary': ['fed', 'rate cut', 'rate hike', 'fomc', 'ecb', 'boj', 'quantitative', 'tightening', 'easing', 'powell'],
    'macroeconomic': ['cpi', 'gdp', 'payrolls', 'unemployment', 'inflation', 'pce', 'retail sales', 'ism'],
    'earnings': ['earnings', 'revenue', 'guidance', 'eps', 'q1', 'q2', 'q3', 'q4', 'beat', 'miss'],
    'market-structure': ['gamma', 'options', 'vix', 'liquidity', 'opex', 'dealer', 'positioning', 'short squeeze'],
    'supply-chain': ['shipping', 'supply chain', 'semiconductor', 'chip', 'logistics', 'port'],
    'black-swan': ['pandemic', 'earthquake', 'cyber', 'default', 'collapse', 'black swan', 'crisis'],
  };

  for (const [category, keywords] of Object.entries(categoryKeywords)) {
    if (category === parentCategory) continue;
    if (keywords.some(kw => text.includes(kw))) {
      return category as NarrativeCategory;
    }
  }

  return null;
}
