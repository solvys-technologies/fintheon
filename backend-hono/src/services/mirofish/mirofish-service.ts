// [claude-code 2026-03-24] Added getRollingWindowData, shouldAutoRun, running state init hook
// [claude-code 2026-03-23] MiroFish simulation lifecycle orchestrator
// [claude-code 2026-03-23] Auto-enriches with VIX/FRED/RiskFlow context, generates briefing, persists to Supabase

import type { MiroFishPrediction, MiroFishReport, MiroFishSimulation, MiroFishInjection, AuditoriumPreset, SimulationContext, RollingWindowQuery, AggregatedRollingData, MiroFishRunSummary } from './mirofish-types.js';
// @ts-ignore — T1 creates this file
import { resetRunningState } from './mirofish-reactive.js';
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

    // Initialize running analysis state from fresh debate result
    // Convert MiroFishCategoryScore[] → Record<MiroFishRiskCategory, number>
    const categoryRecord = report.categoryScores.reduce((acc, cs) => {
      acc[cs.category] = cs.ivScore;
      return acc;
    }, {} as Record<string, number>);
    resetRunningState(simId, categoryRecord as Record<import('./mirofish-types.js').MiroFishRiskCategory, number>, report.nextSessionProjection);

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

// ── Rolling Window Query ──

export async function getRollingWindowData(query: RollingWindowQuery): Promise<AggregatedRollingData> {
  const sb = getSupabaseClient();
  if (!sb) return emptyAggregation(query.days);

  const cutoff = new Date(Date.now() - query.days * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await sb
    .from('mirofish_runs')
    .select('simulation_id, preset, composite_iv, confidence, regime_shift_probability, briefing_text, category_scores, scenarios, created_at')
    .gte('created_at', cutoff)
    .order('created_at', { ascending: false })
    .limit(query.limit ?? 50);

  if (error || !data?.length) return emptyAggregation(query.days);

  const runs: MiroFishRunSummary[] = data.map(row => ({
    simulationId: row.simulation_id,
    preset: row.preset,
    compositeIV: row.composite_iv,
    confidence: row.confidence,
    regimeShiftProbability: row.regime_shift_probability,
    briefingText: row.briefing_text,
    categoryScores: row.category_scores,
    scenarios: row.scenarios,
    createdAt: row.created_at,
  }));

  const avgCompositeIV = runs.reduce((s, r) => s + r.compositeIV, 0) / runs.length;
  const avgConfidence = runs.reduce((s, r) => s + r.confidence, 0) / runs.length;
  const avgRegimeShift = runs.reduce((s, r) => s + r.regimeShiftProbability, 0) / runs.length;

  // Trend: compare first-half avg vs second-half avg
  const mid = Math.floor(runs.length / 2);
  const recentAvg = runs.slice(0, mid).reduce((s, r) => s + r.compositeIV, 0) / Math.max(mid, 1);
  const olderAvg = runs.slice(mid).reduce((s, r) => s + r.compositeIV, 0) / Math.max(runs.length - mid, 1);
  const trendDirection = recentAvg > olderAvg + 0.3 ? 'rising' : recentAvg < olderAvg - 0.3 ? 'falling' : 'stable';

  return { runs, avgCompositeIV, avgConfidence, avgRegimeShift, trendDirection, periodStart: cutoff, periodEnd: new Date().toISOString() };
}

// ── Auto-run Detection ──

export async function shouldAutoRun(): Promise<{ shouldRun: boolean; lastRunAt: string | null; staleness: number }> {
  const sb = getSupabaseClient();
  if (!sb) return { shouldRun: true, lastRunAt: null, staleness: Infinity };

  const { data } = await sb
    .from('mirofish_runs')
    .select('created_at')
    .order('created_at', { ascending: false })
    .limit(1);

  if (!data?.length) return { shouldRun: true, lastRunAt: null, staleness: Infinity };

  const lastRunAt = data[0].created_at;
  const staleness = (Date.now() - new Date(lastRunAt).getTime()) / (60 * 60 * 1000); // hours
  return { shouldRun: staleness > 1, lastRunAt, staleness };
}

function emptyAggregation(days: number): AggregatedRollingData {
  return {
    runs: [],
    avgCompositeIV: 0,
    avgConfidence: 0,
    avgRegimeShift: 0,
    trendDirection: 'stable',
    periodStart: new Date(Date.now() - days * 86400000).toISOString(),
    periodEnd: new Date().toISOString(),
  };
}
