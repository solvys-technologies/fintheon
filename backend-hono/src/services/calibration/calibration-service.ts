// [claude-code 2026-03-27] S2-T4: Calibration service — weight management, annotations, observations
import type { CalibrationEntry, RefinementAnnotation, CalibrationObservation } from '../../types/calibration.js';
import type { MarketRegime } from '../../types/regime.js';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  readCalibrationEntries,
  upsertCalibrationWeight,
  writeAnnotation,
  readAnnotationsForItem,
  writeObservation,
  readObservations,
  writeObservationsBatch,
} from '../supabase-service.js';

const __calDir = dirname(fileURLToPath(import.meta.url));

function loadScoringWeights(): Record<string, Record<string, number>> {
  // Try multiple paths — bun dev runs from project root, not from the file's directory
  const candidates = [
    resolve(__calDir, '../../config/scoring-weights.json'),
    resolve(__calDir, '../../../src/config/scoring-weights.json'),
    resolve(process.cwd(), 'src/config/scoring-weights.json'),
  ];
  for (const p of candidates) {
    if (existsSync(p)) return JSON.parse(readFileSync(p, 'utf-8'));
  }
  return { eventWeights: { default: 2 } };
}

// ─── In-memory cache ────────────────────────────────────────────

let calibrationCache: CalibrationEntry[] = [];
let cacheLoadedAt = 0;
const CACHE_TTL = 60_000; // 1 min

function isCacheStale(): boolean {
  return Date.now() - cacheLoadedAt > CACHE_TTL || calibrationCache.length === 0;
}

// ─── Calibration Weights ────────────────────────────────────────

export async function getCalibrationWeights(): Promise<CalibrationEntry[]> {
  if (!isCacheStale()) return calibrationCache;

  const entries = await readCalibrationEntries();
  if (entries.length === 0) {
    // Table empty — seed from defaults
    await seedCalibrationFromDefaults();
    calibrationCache = await readCalibrationEntries();
  } else {
    calibrationCache = entries;
  }
  cacheLoadedAt = Date.now();
  return calibrationCache;
}

export async function getWeightForEvent(eventType: string): Promise<number> {
  const entries = await getCalibrationWeights();
  const entry = entries.find(w => w.eventType === eventType);
  if (entry) return entry.baseWeight;

  // Fallback to scoring-weights.json
  const cfg = loadScoringWeights();
  const defaults = (cfg.eventWeights ?? {}) as Record<string, number>;
  return defaults[eventType] ?? defaults.default ?? 2;
}

export async function updateCalibrationWeight(
  eventType: string,
  baseWeight: number,
  regimeOverrides?: Partial<Record<MarketRegime, number>>,
  updatedBy?: string
): Promise<void> {
  await upsertCalibrationWeight(
    eventType,
    baseWeight,
    regimeOverrides as Record<string, number>,
    updatedBy
  );
  // Invalidate cache
  cacheLoadedAt = 0;
}

export async function seedCalibrationFromDefaults(): Promise<number> {
  // Only seed if table is empty (idempotent)
  const existing = await readCalibrationEntries();
  if (existing.length > 0) return 0;

  const cfg = loadScoringWeights();
  const defaults = (cfg.eventWeights ?? {}) as Record<string, number>;
  let seeded = 0;
  for (const [eventType, weight] of Object.entries(defaults)) {
    await upsertCalibrationWeight(eventType, weight, {}, 'seed');
    seeded++;
  }
  cacheLoadedAt = 0;
  return seeded;
}

// ─── Annotations ────────────────────────────────────────────────

export async function addAnnotation(
  annotation: Omit<RefinementAnnotation, 'id' | 'createdAt'>
): Promise<string | null> {
  return writeAnnotation(annotation);
}

export async function getAnnotationsForItem(riskflowItemId: string): Promise<RefinementAnnotation[]> {
  return readAnnotationsForItem(riskflowItemId);
}

// ─── Observations ───────────────────────────────────────────────

export async function addObservation(
  obs: Omit<CalibrationObservation, 'id' | 'createdAt'>
): Promise<string | null> {
  return writeObservation(obs);
}

export async function getObservations(limit?: number): Promise<CalibrationObservation[]> {
  return readObservations(limit);
}

export async function addObservationsBatch(
  observations: Omit<CalibrationObservation, 'id' | 'createdAt'>[]
): Promise<number> {
  return writeObservationsBatch(observations);
}
