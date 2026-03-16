// [claude-code 2026-03-16] MiroFish simulation lifecycle orchestrator
// [claude-code 2026-03-16] Rewired to use local debate engine instead of external HTTP

import type { MiroFishPrediction, MiroFishReport, MiroFishSimulation, MiroFishInjection } from './mirofish-types.js';
import { isMiroFishEnabled, runDebate } from './mirofish-client.js';
import { convertNarrativeToSeed } from './mirofish-seed.js';

/** In-memory prediction cache (simId → prediction) */
const predictionCache = new Map<string, MiroFishPrediction>();

/** In-memory simulation tracking */
const activeSimulations = new Map<string, MiroFishSimulation>();

/** Track seeds for re-running with injections */
const seedCache = new Map<string, ReturnType<typeof convertNarrativeToSeed>>();

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
 * Runs the local debate engine and returns immediately with results.
 */
export async function startPrediction(
  narrativeState: NarrativeState,
  contextBank?: ContextBank,
): Promise<{ simulationId: string } | { error: string }> {
  if (!isMiroFishEnabled()) {
    return { error: 'MiroFish is not enabled' };
  }

  const simId = crypto.randomUUID();

  // Mark as running
  activeSimulations.set(simId, {
    id: simId, status: 'running', progress: 0,
    startedAt: new Date().toISOString(),
  });

  try {
    const seed = convertNarrativeToSeed(
      narrativeState.lanes,
      narrativeState.catalysts,
      narrativeState.ropes,
      contextBank,
    );

    seedCache.set(simId, seed);

    const report = await runDebate(seed);
    report.simulationId = simId;

    const prediction = reportToPrediction(simId, report);
    predictionCache.set(simId, prediction);

    activeSimulations.set(simId, {
      id: simId, status: 'complete', progress: 100,
      startedAt: activeSimulations.get(simId)!.startedAt,
      completedAt: new Date().toISOString(),
    });

    return { simulationId: simId };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error starting simulation';
    console.error('[MiroFish] startPrediction failed:', msg);

    activeSimulations.set(simId, {
      id: simId, status: 'error', progress: 0,
      startedAt: activeSimulations.get(simId)!.startedAt,
      error: msg,
    });

    return { error: msg };
  }
}

/** Get simulation status (always complete or error for local engine) */
export function pollStatus(simId: string): MiroFishSimulation | null {
  return activeSimulations.get(simId) ?? null;
}

/** Extract structured predictions from a completed simulation */
export function getPredictions(simId: string): MiroFishPrediction | null {
  return predictionCache.get(simId) ?? null;
}

/** Inject a "God's Eye View" variable and re-run the debate */
export async function injectScenarioVariable(
  simId: string,
  injection: MiroFishInjection,
): Promise<MiroFishSimulation | null> {
  if (!isMiroFishEnabled()) return null;

  const cachedSeed = seedCache.get(simId);
  if (!cachedSeed) return null;

  try {
    // Add injection as a new entity to the seed
    const modifiedSeed = {
      ...cachedSeed,
      entities: [
        ...cachedSeed.entities,
        {
          id: `injection-${crypto.randomUUID().slice(0, 8)}`,
          type: 'event' as const,
          label: injection.variable,
          properties: {
            description: injection.description,
            targetNarrativeIds: injection.targetNarrativeIds,
            isInjection: true,
          },
        },
      ],
    };

    const report = await runDebate(modifiedSeed);
    report.simulationId = simId;

    const prediction = reportToPrediction(simId, report);
    predictionCache.set(simId, prediction);

    const sim: MiroFishSimulation = {
      id: simId, status: 'complete', progress: 100,
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    };
    activeSimulations.set(simId, sim);

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

/** Get the most recent cached prediction (for IV scorer integration) */
export function getLatestCachedPrediction(): MiroFishPrediction | undefined {
  let latest: MiroFishPrediction | undefined;
  for (const pred of predictionCache.values()) {
    if (!latest || pred.generatedAt > latest.generatedAt) {
      latest = pred;
    }
  }
  return latest;
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
    categoryScores: report.categoryScores,
    timeSeries: report.timeSeries,
    generatedEvents: report.generatedEvents,
    source: 'mirofish',
    generatedAt: report.generatedAt,
  };
}
