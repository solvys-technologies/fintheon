// [claude-code 2026-03-23] Observation store — persists ScoringObservations to DB + in-memory fallback
// Part of the autoresearch system for tracking IV score predictions vs actual outcomes.

import type { ScoringObservation } from './types.js';

// In-memory fallback when DB is unavailable
let memoryStore: ScoringObservation[] = [];
const MEMORY_STORE_MAX = 500;

/**
 * Store a scoring observation. Uses PostgreSQL when available, falls back to memory.
 */
export async function storeObservation(obs: ScoringObservation): Promise<void> {
  try {
    const { sql, isDatabaseAvailable } = await import('../../config/database.js');
    if (!isDatabaseAvailable() || !sql) {
      storeInMemory(obs);
      return;
    }

    await sql`
      INSERT INTO scoring_observations (
        id, headline, event_type, iv_score, vix_at_observation,
        instrument, price_at_observation, price_after, price_after_minutes,
        actual_move, predicted_move, published_at, observed_at, session, source, tags
      )
      VALUES (
        ${obs.id}, ${obs.headline}, ${obs.eventType}, ${obs.ivScore},
        ${obs.vixAtObservation}, ${obs.instrument}, ${obs.priceAtObservation},
        ${obs.priceAfter ?? null}, ${obs.priceAfterMinutes ?? null},
        ${obs.actualMove ?? null}, ${obs.predictedMove ?? null},
        ${obs.publishedAt}, ${obs.observedAt}, ${obs.session},
        ${obs.source ?? null}, ${obs.tags ?? []}
      )
      ON CONFLICT (id) DO UPDATE SET
        price_after = COALESCE(EXCLUDED.price_after, scoring_observations.price_after),
        price_after_minutes = COALESCE(EXCLUDED.price_after_minutes, scoring_observations.price_after_minutes),
        actual_move = COALESCE(EXCLUDED.actual_move, scoring_observations.actual_move)
    `;
  } catch (error) {
    console.error('[ObservationStore] DB store failed, using memory fallback:', error);
    storeInMemory(obs);
  }
}

/**
 * Update an observation with outcome data (price after event).
 */
export async function updateObservationOutcome(
  id: string,
  priceAfter: number,
  priceAfterMinutes: number,
  actualMove: number,
): Promise<void> {
  try {
    const { sql, isDatabaseAvailable } = await import('../../config/database.js');
    if (!isDatabaseAvailable() || !sql) {
      const existing = memoryStore.find(o => o.id === id);
      if (existing) {
        existing.priceAfter = priceAfter;
        existing.priceAfterMinutes = priceAfterMinutes;
        existing.actualMove = actualMove;
      }
      return;
    }

    await sql`
      UPDATE scoring_observations
      SET price_after = ${priceAfter},
          price_after_minutes = ${priceAfterMinutes},
          actual_move = ${actualMove}
      WHERE id = ${id}
    `;
  } catch (error) {
    console.error('[ObservationStore] Update outcome failed:', error);
  }
}

/**
 * Fetch observations for backtesting / fitness evaluation.
 */
export async function getObservations(options: {
  instrument?: string;
  hoursBack?: number;
  minIVScore?: number;
  limit?: number;
  withOutcomesOnly?: boolean;
}): Promise<ScoringObservation[]> {
  const {
    instrument,
    hoursBack = 168,
    minIVScore = 0,
    limit = 500,
    withOutcomesOnly = false,
  } = options;

  try {
    const { sql, isDatabaseAvailable } = await import('../../config/database.js');
    if (!isDatabaseAvailable() || !sql) {
      return getFromMemory(options);
    }

    const cutoff = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString();

    let rows: any[];
    if (instrument) {
      rows = await sql`
        SELECT * FROM scoring_observations
        WHERE observed_at >= ${cutoff}
          AND iv_score >= ${minIVScore}
          AND instrument = ${instrument}
          ${withOutcomesOnly ? sql`AND actual_move IS NOT NULL` : sql``}
        ORDER BY observed_at DESC
        LIMIT ${limit}
      `;
    } else {
      rows = await sql`
        SELECT * FROM scoring_observations
        WHERE observed_at >= ${cutoff}
          AND iv_score >= ${minIVScore}
          ${withOutcomesOnly ? sql`AND actual_move IS NOT NULL` : sql``}
        ORDER BY observed_at DESC
        LIMIT ${limit}
      `;
    }

    return rows.map(mapRowToObservation);
  } catch (error) {
    console.error('[ObservationStore] Fetch failed:', error);
    return getFromMemory(options);
  }
}

/**
 * Count observations in the store.
 */
export async function countObservations(): Promise<number> {
  try {
    const { sql, isDatabaseAvailable } = await import('../../config/database.js');
    if (!isDatabaseAvailable() || !sql) return memoryStore.length;

    const result = await sql`SELECT COUNT(*) as count FROM scoring_observations`;
    return Number(result[0]?.count ?? 0);
  } catch {
    return memoryStore.length;
  }
}

// ── Internal helpers ─────────────────────────────────────────────────────────

function storeInMemory(obs: ScoringObservation): void {
  const idx = memoryStore.findIndex(o => o.id === obs.id);
  if (idx >= 0) {
    memoryStore[idx] = { ...memoryStore[idx], ...obs };
  } else {
    memoryStore.unshift(obs);
    if (memoryStore.length > MEMORY_STORE_MAX) {
      memoryStore = memoryStore.slice(0, MEMORY_STORE_MAX);
    }
  }
}

function getFromMemory(options: {
  instrument?: string;
  hoursBack?: number;
  minIVScore?: number;
  limit?: number;
  withOutcomesOnly?: boolean;
}): ScoringObservation[] {
  const cutoff = new Date(Date.now() - (options.hoursBack ?? 168) * 60 * 60 * 1000);
  return memoryStore
    .filter(o => {
      if (new Date(o.observedAt) < cutoff) return false;
      if (o.ivScore < (options.minIVScore ?? 0)) return false;
      if (options.instrument && o.instrument !== options.instrument) return false;
      if (options.withOutcomesOnly && o.actualMove == null) return false;
      return true;
    })
    .slice(0, options.limit ?? 500);
}

function mapRowToObservation(row: any): ScoringObservation {
  return {
    id: row.id,
    headline: row.headline,
    eventType: row.event_type,
    ivScore: Number(row.iv_score),
    vixAtObservation: Number(row.vix_at_observation),
    instrument: row.instrument,
    priceAtObservation: Number(row.price_at_observation),
    priceAfter: row.price_after != null ? Number(row.price_after) : undefined,
    priceAfterMinutes: row.price_after_minutes != null ? Number(row.price_after_minutes) : undefined,
    actualMove: row.actual_move != null ? Number(row.actual_move) : undefined,
    predictedMove: row.predicted_move != null ? Number(row.predicted_move) : undefined,
    publishedAt: row.published_at,
    observedAt: row.observed_at,
    session: row.session,
    source: row.source ?? undefined,
    tags: row.tags ?? [],
  };
}
