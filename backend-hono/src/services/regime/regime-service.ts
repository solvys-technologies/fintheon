// [claude-code 2026-03-26] S2-T2: Regime state management — get/set/history with in-memory cache
import type { MarketRegime, RegimeState, RegimeMultiplierProfile } from '../../types/regime.js';
import { MARKET_REGIMES, DEFAULT_REGIME_MULTIPLIERS } from '../../types/regime.js';
import {
  writeRegimeState,
  readActiveRegime,
  deactivateCurrentRegime,
  readRegimeHistory as dbReadHistory,
  type MarketRegimeRecord,
} from '../supabase-service.js';

// ── In-memory cache (60s TTL) ──────────────────────────────────

let cachedRegime: RegimeState | null = null;
let cacheSetAt = 0;
const CACHE_TTL_MS = 60_000;

function toRegimeState(row: MarketRegimeRecord): RegimeState {
  return {
    id: row.id ?? '',
    regime: row.regime_type as MarketRegime,
    detectedBy: row.detected_by as RegimeState['detectedBy'],
    confidence: Number(row.confidence ?? 0),
    notes: row.notes ?? undefined,
    active: row.active ?? false,
    createdAt: row.created_at ?? new Date().toISOString(),
  };
}

// ── Public API ─────────────────────────────────────────────────

export async function getCurrentRegime(): Promise<RegimeState> {
  // Check cache
  if (cachedRegime && Date.now() - cacheSetAt < CACHE_TTL_MS) {
    return cachedRegime;
  }

  const row = await readActiveRegime();
  if (row) {
    cachedRegime = toRegimeState(row);
    cacheSetAt = Date.now();
    return cachedRegime;
  }

  // No active regime — default to CONSOLIDATION
  const defaultState: RegimeState = {
    id: 'default',
    regime: 'CONSOLIDATION',
    detectedBy: 'manual',
    confidence: 0,
    notes: 'Default — no regime set',
    active: true,
    createdAt: new Date().toISOString(),
  };
  cachedRegime = defaultState;
  cacheSetAt = Date.now();
  return defaultState;
}

export async function setRegime(
  regime: MarketRegime,
  detectedBy: RegimeState['detectedBy'],
  confidence: number,
  notes?: string
): Promise<RegimeState> {
  // Deactivate previous
  await deactivateCurrentRegime();

  // Insert new
  const row = await writeRegimeState({
    regime_type: regime,
    detected_by: detectedBy,
    confidence,
    notes: notes ?? undefined,
    active: true,
  });

  // Clear cache
  cachedRegime = null;
  cacheSetAt = 0;

  if (row) {
    const state = toRegimeState(row);
    cachedRegime = state;
    cacheSetAt = Date.now();
    return state;
  }

  // Fallback if DB write failed — return in-memory only
  return {
    id: 'mem-' + Date.now(),
    regime,
    detectedBy,
    confidence,
    notes,
    active: true,
    createdAt: new Date().toISOString(),
  };
}

export async function getRegimeHistory(limit = 20): Promise<RegimeState[]> {
  const rows = await dbReadHistory(limit);
  return rows.map(toRegimeState);
}

export function getRegimeMultipliers(regime: MarketRegime): RegimeMultiplierProfile {
  return DEFAULT_REGIME_MULTIPLIERS[regime];
}
