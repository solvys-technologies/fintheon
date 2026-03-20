// [claude-code 2026-03-06] NarrativeFlow agent loop stub — configurable provider
import type { Rope, CatalystCard, NarrativeFlowState } from './narrative-types';

export async function evaluateRope(
  _rope: Rope,
  context: NarrativeFlowState
): Promise<{ approved: boolean; reasoning: string }> {
  if (context.agentProvider.provider === 'manual') {
    return { approved: false, reasoning: 'Awaiting manual review' };
  }
  await new Promise((r) => setTimeout(r, 500));
  return { approved: true, reasoning: 'Auto-approved' };
}

export async function evaluatePlacement(
  _catalyst: CatalystCard,
  context: NarrativeFlowState
): Promise<{ approved: boolean; reasoning: string }> {
  if (context.agentProvider.provider === 'manual') {
    return { approved: false, reasoning: 'Awaiting manual review' };
  }
  await new Promise((r) => setTimeout(r, 500));
  return { approved: true, reasoning: 'Auto-approved' };
}
