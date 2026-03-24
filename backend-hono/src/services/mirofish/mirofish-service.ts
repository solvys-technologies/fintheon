// [claude-code 2026-03-23] MiroFish simulation lifecycle orchestrator
// [claude-code 2026-03-23] Auto-enriches with VIX/FRED/RiskFlow context, generates briefing, persists to Supabase

import type { MiroFishPrediction, MiroFishReport, MiroFishSimulation, MiroFishInjection, AuditoriumPreset, SimulationContext } from './mirofish-types.js';
import { isMiroFishEnabled, runDebate } from './mirofish-client.js';
import { convertNarrativeToSeed } from './mirofish-seed.js';
import { assembleSimulationContext } from './mirofish-context.js';
import { generateBriefing } from './mirofish-briefing.js';
import { getSupabaseClient } from '../../config/supabase.js';

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
 * Start a MiroFish prediction simulation.
 * Auto-fetches live market context (VIX, FRED, RiskFlow) based on preset.
 * Generates briefing text. Persists run to Supabase.
 */
export async function startPrediction(
  narrativeState: NarrativeState,
  contextBank?: ContextBank,
  preset: AuditoriumPreset = 'full-brief',
): Promise<{ simulationId: string } | { error: string }> {
  if (!isMiroFishEnabled()) {
    return { error: 'MiroFish is not enabled' };
  }

  const simId = crypto.randomUUID();

  activeSimulations.set(simId, {
    id: simId, status: 'running', progress: 0,
    startedAt: new Date().toISOString(),
  });

  try {
    // Auto-fetch live context
    const context = await assembleSimulationContext(preset);

    // Merge auto-fetched context with any explicit contextBank
    const mergedContext: ContextBank = {
      vixLevel: contextBank?.vixLevel ?? context.vixLevel ?? undefined,
      gexNet: contextBank?.gexNet,
      macroIndicators: {
        ...(contextBank?.macroIndicators ?? {}),
        ...context.fredIndicators,
      },
    };

    // Convert RiskFlow headlines into catalyst entities
    const enrichedCatalysts = [
      ...narrativeState.catalysts,
      ...context.riskflowHeadlines.map(h => ({
        id: h.id,
        title: h.title,
        description: h.summary || h.title,
        date: h.created_at.slice(0, 10),
        sentiment: h.sentiment || 'neutral',
        severity: h.macro_level >= 4 ? 'critical' : h.macro_level >= 3 ? 'high' : 'medium',
        narrativeIds: [] as string[],
      })),
    ];

    const seed = convertNarrativeToSeed(
      narrativeState.lanes,
      enrichedCatalysts,
      narrativeState.ropes,
      mergedContext,
    );

    seedCache.set(simId, seed);

    const report = await runDebate(seed);
    report.simulationId = simId;

    // Generate briefing
    const briefing = generateBriefing(report, context);
    report.briefing = briefing;
    report.contextSnapshot = context;

    const prediction = reportToPrediction(simId, report);
    predictionCache.set(simId, prediction);

    activeSimulations.set(simId, {
      id: simId, status: 'complete', progress: 100,
      startedAt: activeSimulations.get(simId)!.startedAt,
      completedAt: new Date().toISOString(),
    });

    // Persist to Supabase (fire-and-forget)
    persistRun(simId, preset, report, context, briefing).catch(err => {
      console.warn('[MiroFish] Failed to persist run:', err);
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

/** Get simulation status */
export function pollStatus(simId: string): MiroFishSimulation | null {
  return activeSimulations.get(simId) ?? null;
}

/** Extract structured predictions from a completed simulation */
export function getPredictions(simId: string): MiroFishPrediction | null {
  return predictionCache.get(simId) ?? null;
}

/** Inject a scenario variable and re-run the debate */
export async function injectScenarioVariable(
  simId: string,
  injection: MiroFishInjection,
): Promise<MiroFishSimulation | null> {
  if (!isMiroFishEnabled()) return null;

  const cachedSeed = seedCache.get(simId);
  if (!cachedSeed) return null;

  try {
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

export function getCachedSimulation(simId: string): MiroFishSimulation | undefined {
  return activeSimulations.get(simId);
}

export function getCachedPrediction(simId: string): MiroFishPrediction | undefined {
  return predictionCache.get(simId);
}

export function getLatestCachedPrediction(): MiroFishPrediction | undefined {
  let latest: MiroFishPrediction | undefined;
  for (const pred of predictionCache.values()) {
    if (!latest || pred.generatedAt > latest.generatedAt) {
      latest = pred;
    }
  }
  return latest;
}

/** Get history of past runs from Supabase */
export async function getRunHistory(limit = 20): Promise<unknown[]> {
  const sb = getSupabaseClient();
  if (!sb) return [];

  const { data, error } = await sb
    .from('mirofish_runs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.warn('[MiroFish] History fetch failed:', error.message);
    return [];
  }
  return data ?? [];
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
    briefing: report.briefing,
    contextSnapshot: report.contextSnapshot,
    source: 'mirofish',
    generatedAt: report.generatedAt,
  };
}

async function persistRun(
  simId: string,
  preset: AuditoriumPreset,
  report: MiroFishReport,
  context: SimulationContext,
  briefing: { summary: string },
): Promise<void> {
  const sb = getSupabaseClient();
  if (!sb) return;

  await sb.from('mirofish_runs').insert({
    simulation_id: simId,
    preset,
    composite_iv: report.nextSessionProjection,
    regime_shift_probability: report.regimeShiftProbability,
    confidence: report.confidence,
    briefing_text: briefing.summary,
    category_scores: report.categoryScores,
    scenarios: report.scenarios,
    context_snapshot: context,
  });
}
