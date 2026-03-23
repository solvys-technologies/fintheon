// [claude-code 2026-03-23] Scoring observer — captures ScoringObservations when news items are scored
// Hooks into the news cache pipeline to record predictions for later fitness evaluation.

import type { ScoringObservation } from './types.js';
import { storeObservation, updateObservationOutcome } from './observation-store.js';
import { resolveOutcome } from './price-resolver.js';
import { getCurrentSession } from '../iv-scoring-v2.js';
import { calculateImpliedPoints } from '../iv-scoring-v2.js';

/** Default delay before checking outcome (minutes) */
const DEFAULT_OUTCOME_DELAY = 30;

/**
 * Record a scoring observation when a news item is scored.
 * Called from the news analysis pipeline after IV score is assigned.
 */
export async function recordObservation(params: {
  id: string;
  headline: string;
  eventType: string;
  ivScore: number;
  vixLevel: number;
  instrument: string;
  currentPrice: number;
  publishedAt: string;
  source?: string;
  tags?: string[];
}): Promise<void> {
  const session = getCurrentSession();
  const implied = calculateImpliedPoints(params.vixLevel, params.currentPrice, params.instrument);

  const obs: ScoringObservation = {
    id: params.id,
    headline: params.headline,
    eventType: params.eventType,
    ivScore: params.ivScore,
    vixAtObservation: params.vixLevel,
    instrument: params.instrument,
    priceAtObservation: params.currentPrice,
    predictedMove: implied.adjustedPoints,
    publishedAt: params.publishedAt,
    observedAt: new Date().toISOString(),
    session: session.name,
    source: params.source,
    tags: params.tags,
  };

  await storeObservation(obs);

  // Schedule outcome resolution (non-blocking)
  scheduleOutcomeResolution(obs, DEFAULT_OUTCOME_DELAY);
}

/**
 * Schedule a delayed price check to fill in the actual outcome.
 * Uses setTimeout for simplicity — in production this would be a proper job queue.
 */
function scheduleOutcomeResolution(obs: ScoringObservation, delayMinutes: number): void {
  const delayMs = delayMinutes * 60 * 1000;

  setTimeout(async () => {
    try {
      const outcome = await resolveOutcome(obs, delayMinutes);
      if (outcome) {
        await updateObservationOutcome(
          obs.id,
          outcome.priceAfter,
          delayMinutes,
          outcome.actualMove,
        );
      }
    } catch (error) {
      console.error(`[ScoringObserver] Outcome resolution failed for ${obs.id}:`, error);
    }
  }, delayMs);
}

/**
 * Manually trigger outcome resolution for an observation.
 * Useful for backfilling or testing.
 */
export async function resolveObservationOutcome(
  obs: ScoringObservation,
  afterMinutes: number = DEFAULT_OUTCOME_DELAY,
): Promise<boolean> {
  const outcome = await resolveOutcome(obs, afterMinutes);
  if (!outcome) return false;

  await updateObservationOutcome(
    obs.id,
    outcome.priceAfter,
    afterMinutes,
    outcome.actualMove,
  );
  return true;
}
