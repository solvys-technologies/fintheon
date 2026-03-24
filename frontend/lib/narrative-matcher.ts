// [claude-code 2026-03-06] Auto-assign catalyst candidates to narrative lanes by ticker/theme

import type { NarrativeLane } from './narrative-types';
import type { ScoredCandidate } from './services';

export interface MatchedCandidate extends ScoredCandidate {
  matchedLaneIds: string[];
  matchReason: string;
}

export function matchCandidatesToLanes(
  candidates: ScoredCandidate[],
  lanes: NarrativeLane[]
): MatchedCandidate[] {
  return candidates.map(candidate => {
    const matchedLaneIds: string[] = [];
    const reasons: string[] = [];

    for (const lane of lanes) {
      // Skip archived/decayed lanes
      if (lane.status === 'archived' || lane.status === 'decayed') continue;

      // Match by ticker/instrument
      const tickerMatch = candidate.tickers.some(t =>
        lane.instruments.some(inst =>
          inst.toLowerCase() === t.toLowerCase()
        )
      );
      if (tickerMatch) {
        matchedLaneIds.push(lane.id);
        const matched = candidate.tickers.filter(t =>
          lane.instruments.some(inst => inst.toLowerCase() === t.toLowerCase())
        );
        reasons.push(`Ticker ${matched.join(', ')} matches "${lane.title}"`);
        continue; // Don't double-count
      }

      // Match by theme (fuzzy substring on lane title)
      const themeMatch = candidate.themes.some(theme =>
        lane.title.toLowerCase().includes(theme.toLowerCase()) ||
        theme.toLowerCase().includes(lane.title.toLowerCase())
      );
      if (themeMatch) {
        matchedLaneIds.push(lane.id);
        reasons.push(`Theme matches "${lane.title}"`);
      }
    }

    return {
      ...candidate,
      matchedLaneIds,
      matchReason: reasons.length > 0 ? reasons.join('; ') : 'No lane match',
    };
  });
}
