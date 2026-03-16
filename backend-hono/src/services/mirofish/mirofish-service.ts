// [claude-code 2026-03-16] MiroFish simulation lifecycle orchestrator

import type { MiroFishPrediction, MiroFishReport, MiroFishSimulation, MiroFishInjection } from './mirofish-types.js';
import {
  isMiroFishEnabled,
  startSimulation,
  getSimulationStatus,
  getSimulationReport,
  injectVariable,
} from './mirofish-client.js';
import { convertNarrativeToSeed } from './mirofish-seed.js';

/** In-memory prediction cache (simId → prediction) */
const predictionCache = new Map<string, MiroFishPrediction>();

/** In-memory simulation tracking */
const activeSimulations = new Map<string, MiroFishSimulation>();

interface NarrativeState {
  lanes: Array<{
    id: string; title: string; instruments: string[];
    directionBias: string; category: string; status: string;
    healthScore: number; dateRange: { start: string; end: string | null };
  }>;
  catalysts: Array<{
    id: string; title: string; description: string; date: string;
    sentiment: string; severity: string; narrativeIds: string[];
  }>;
  ropes: Array<{
    id: string; fromId: string; toId: string;
    polarity: string; weight: number;
  }>;
}

interface ContextBank {
  vixLevel?: number;
  gexNet?: number;
  macroIndicators?: Record<string, number>;
}

/**
 * Start a MiroFish prediction simulation from narrative state.
 * Returns the simulation ID for polling.
 */
export async function startPrediction(
  narrativeState: NarrativeState,
  contextBank?: ContextBank,
): Promise<{ simulationId: string } | { error: string }> {
  if (!isMiroFishEnabled()) {
    return { error: 'MiroFish is not enabled' };
  }

  try {
    const seed = convertNarrativeToSeed(
      narrativeState.lanes,
      narrativeState.catalysts,
      narrativeState.ropes,
      contextBank,
    );

    const sim = await startSimulation(seed);
    activeSimulations.set(sim.id, sim);
    return { simulationId: sim.id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error starting simulation';
    console.error('[MiroFish] startPrediction failed:', msg);
    return { error: msg };
  }
}

/** Poll simulation status */
export async function pollStatus(simId: string): Promise<MiroFishSimulation | null> {
  if (!isMiroFishEnabled()) return null;

  try {
    const sim = await getSimulationStatus(simId);
    activeSimulations.set(simId, sim);
    return sim;
  } catch (err) {
    console.error('[MiroFish] pollStatus failed:', err);
    return activeSimulations.get(simId) ?? null;
  }
}

/** Extract structured predictions from a completed simulation report */
export async function getPredictions(simId: string): Promise<MiroFishPrediction | null> {
  // Check cache first
  const cached = predictionCache.get(simId);
  if (cached) return cached;

  if (!isMiroFishEnabled()) return null;

  try {
    const report = await getSimulationReport(simId);
    const prediction = reportToPrediction(simId, report);
    predictionCache.set(simId, prediction);
    return prediction;
  } catch (err) {
    console.error('[MiroFish] getPredictions failed:', err);
    return null;
  }
}

/** Inject a "God's Eye View" variable into a running simulation */
export async function injectScenarioVariable(
  simId: string,
  injection: MiroFishInjection,
): Promise<MiroFishSimulation | null> {
  if (!isMiroFishEnabled()) return null;

  try {
    const sim = await injectVariable(simId, injection);
    activeSimulations.set(simId, sim);
    // Clear cached prediction since injection changes outcomes
    predictionCache.delete(simId);
    return sim;
  } catch (err) {
    console.error('[MiroFish] injectScenarioVariable failed:', err);
    return null;
  }
}

/** Get cached simulation status */
export function getCachedSimulation(simId: string): MiroFishSimulation | undefined {
  return activeSimulations.get(simId);
}

/** Get cached prediction */
export function getCachedPrediction(simId: string): MiroFishPrediction | undefined {
  return predictionCache.get(simId);
}

function reportToPrediction(simId: string, report: MiroFishReport): MiroFishPrediction {
  return {
    simulationId: simId,
    nextSessionScore: report.nextSessionProjection,
    confidence: report.confidence,
    regimeShiftProbability: report.regimeShiftProbability,
    scenarios: report.scenarios.map(s => ({
      label: s.label,
      probability: s.probability,
      projectedScore: s.projectedIVScore,
    })),
    source: 'mirofish',
    generatedAt: report.generatedAt,
  };
}
