// [claude-code 2026-03-06] NarrativeFlow health score calculation — pure function
import type { NarrativeLane, CatalystCard, Rope, NarrativeConflict } from './narrative-types';

export function calculateHealthScore(
  lane: NarrativeLane,
  catalysts: CatalystCard[],
  ropes: Rope[],
  conflicts: NarrativeConflict[]
): number {
  const twoWeeksAgo = new Date();
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

  // Recent catalyst activity (last 2 weeks) — 40%
  const laneCatalysts = catalysts.filter((c) => c.narrativeIds.includes(lane.id));
  const recentCount = laneCatalysts.filter((c) => new Date(c.date) >= twoWeeksAgo).length;
  const activityScore = Math.min(recentCount / 3, 1) * 40;

  // Supporting ropes — 25%
  const laneRopes = ropes.filter(
    (r) => (r.fromId === lane.id || r.toId === lane.id) && r.approved
  );
  const reinforcing = laneRopes.filter((r) => r.polarity === 'reinforcing').length;
  const ropeScore = Math.min(reinforcing / 4, 1) * 25;

  // Contradicting ropes penalty — -15%
  const contradicting = laneRopes.filter((r) => r.polarity === 'contradicting').length;
  const contradictPenalty = Math.min(contradicting / 3, 1) * 15;

  // Active conflicts penalty — -10%
  const activeConflicts = conflicts.filter(
    (c) => !c.resolved && (c.laneAId === lane.id || c.laneBId === lane.id)
  ).length;
  const conflictPenalty = Math.min(activeConflicts / 2, 1) * 10;

  // Decay weeks penalty — -10% per week after 2
  const decayPenalty = Math.max(0, lane.decayWeeks - 2) * 10;

  const raw = activityScore + ropeScore - contradictPenalty - conflictPenalty - decayPenalty;
  return Math.max(0, Math.min(100, Math.round(raw)));
}
