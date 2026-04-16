// [claude-code 2026-04-12] Fix: Update button now always runs fresh simulation. Auto-run on launch if stale. Harper AI analysis.
// [claude-code 2026-04-03] Daily auto-run: 12h staleness threshold, cross-user dedup
// [claude-code 2026-03-28] S8-T5: 3-phase deliberation pipeline integration
// [claude-code 2026-03-24] Persistence refactor: getLatestReport(), full report JSONB in persistRun(), 30min staleness
// [claude-code 2026-03-24] Added getRollingWindowData, shouldAutoRun, running state init hook
// [claude-code 2026-03-23] MiroShark simulation lifecycle orchestrator

import type {
  MiroSharkPrediction,
  MiroSharkReport,
  MiroSharkSimulation,
  MiroSharkInjection,
  SanctumPreset,
  SimulationContext,
  EconPrintStat,
  RollingWindowQuery,
  AggregatedRollingData,
  MiroSharkRunSummary,
  MiroSharkBriefing,
  DeliberationState,
} from "./miroshark-types.js";
// @ts-ignore — T1 creates this file
import { resetRunningState } from "./miroshark-reactive.js";
import {
  isMiroSharkEnabled,
  runDebate,
  hasGeopoliticalContent,
} from "./miroshark-client.js";
import { convertNarrativeToSeed } from "./miroshark-seed.js";
import { assembleSimulationContext } from "./miroshark-context.js";
import { generateBriefing } from "./miroshark-briefing.js";
import {
  runDeliberationPipeline,
  getDeliberationState,
  getDeliberationStateAsync,
  injectUserTake,
} from "./miroshark-deliberation.js";
import { getSupabaseClient } from "../../config/supabase.js";
import { invokeAgent } from "../strands/index.js";

/** In-memory prediction cache (simId → prediction) */
const predictionCache = new Map<string, MiroSharkPrediction>();

/** In-memory simulation tracking */
const activeSimulations = new Map<string, MiroSharkSimulation>();

/** Track seeds for re-running with injections */
const seedCache = new Map<string, ReturnType<typeof convertNarrativeToSeed>>();

interface NarrativeState {
  lanes: Array<{
    id: string;
    title: string;
    instruments: string[];
    directionBias: string;
    category: string;
    status: string;
    healthScore: number;
    dateRange: { start: string; end: string | null };
  }>;
  catalysts: Array<{
    id: string;
    title: string;
    description: string;
    date: string;
    sentiment: string;
    severity: string;
    narrativeIds: string[];
  }>;
  ropes: Array<{
    id: string;
    fromId: string;
    toId: string;
    polarity: string;
    weight: number;
  }>;
}

interface ContextBank {
  vixLevel?: number;
  gexNet?: number;
  macroIndicators?: Record<string, number>;
}

/**
 * Start a MiroShark prediction simulation.
 * Auto-fetches live market context (VIX, FRED, RiskFlow) based on preset.
 * Generates briefing text. Persists run to Supabase.
 */
export async function startPrediction(
  narrativeState: NarrativeState,
  contextBank?: ContextBank,
  preset: SanctumPreset = "full-brief",
): Promise<{ simulationId: string } | { error: string }> {
  if (!isMiroSharkEnabled()) {
    return { error: "MiroShark is not enabled" };
  }

  const simId = crypto.randomUUID();

  activeSimulations.set(simId, {
    id: simId,
    status: "running",
    progress: 0,
    startedAt: new Date().toISOString(),
  });

  try {
    // Auto-fetch live context
    const context = await assembleSimulationContext(preset);

    // Merge auto-fetched context with any explicit contextBank
    const mergedContext: ContextBank & { econPrintHistory?: EconPrintStat[] } =
      {
        vixLevel: contextBank?.vixLevel ?? context.vixLevel ?? undefined,
        gexNet: contextBank?.gexNet,
        macroIndicators: {
          ...(contextBank?.macroIndicators ?? {}),
          ...context.fredIndicators,
        },
        econPrintHistory: context.econPrintHistory,
      };

    // Fallback: if frontend sent empty lanes, synthesize from RiskFlow headlines
    if (
      narrativeState.lanes.length === 0 &&
      context.riskflowHeadlines.length > 0
    ) {
      console.log(
        `[MiroShark] Empty lanes from frontend — synthesizing from ${context.riskflowHeadlines.length} RiskFlow headlines`,
      );
      const threadGroups = new Map<string, typeof context.riskflowHeadlines>();
      for (const h of context.riskflowHeadlines) {
        const threads = h.narrative_threads ?? [];
        const key =
          threads.length > 0
            ? threads[0]
            : (h.category ?? h.risk_type ?? "general");
        if (!threadGroups.has(key)) threadGroups.set(key, []);
        threadGroups.get(key)!.push(h);
      }
      for (const [thread, items] of threadGroups) {
        const avgIV =
          items.reduce((s, i) => s + (i.iv_score ?? 5), 0) / items.length;
        const dominant =
          items.filter((i) => i.sentiment === "bearish").length >
          items.length / 2
            ? "short"
            : items.filter((i) => i.sentiment === "bullish").length >
                items.length / 2
              ? "long"
              : "neutral";
        narrativeState.lanes.push({
          id: `synth-${thread}`,
          title: thread
            .replace(/-/g, " ")
            .replace(/\b\w/g, (c) => c.toUpperCase()),
          instruments: [],
          directionBias: dominant,
          category: items[0].category ?? "geopolitical",
          status: "active",
          healthScore: Math.min(10, Math.max(0, avgIV)),
          dateRange: {
            start: items[items.length - 1].created_at.slice(0, 10),
            end: null,
          },
        });
      }
    }

    // Validate context snapshot has VIX + headlines before running
    if (!context.vixLevel && context.riskflowHeadlines.length === 0) {
      console.warn(
        "[MiroShark] No VIX and no RiskFlow headlines — simulation will produce low-quality results",
      );
    }

    // Convert RiskFlow headlines into catalyst entities
    const enrichedCatalysts = [
      ...narrativeState.catalysts,
      ...context.riskflowHeadlines.map((h) => ({
        id: h.id,
        title: h.headline,
        description: h.summary || h.headline,
        date: h.created_at.slice(0, 10),
        sentiment: h.sentiment || "neutral",
        severity:
          h.macro_level >= 4
            ? "critical"
            : h.macro_level >= 3
              ? "high"
              : "medium",
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

    // Primary: gov-official debate (8 personas with headline augmentation)
    const report = await runDebate(seed);
    report.simulationId = simId;
    report.debateLayer = "gov-officials";

    // Conditional: gov-official debate for geopolitical content
    const geoActive = await hasGeopoliticalContent();
    if (geoActive) {
      console.log(
        "[MiroShark] Geopolitical content detected — running gov-official second layer",
      );
      const govReport = await runDebate(seed);
      govReport.debateLayer = "gov-officials";
      report.govOfficialReport = govReport;
    }

    // Generate deterministic briefing
    const briefing = generateBriefing(report, context);

    // Harper AI analysis — deeper narrative breakdown (fire-and-forget, fills in async)
    generateHarperAnalysis(report, context, briefing).catch((err) => {
      console.warn("[MiroShark] Harper analysis failed (non-fatal):", err);
    });

    report.briefing = briefing;
    report.contextSnapshot = context;

    const prediction = reportToPrediction(simId, report);
    predictionCache.set(simId, prediction);

    // Initialize running analysis state from fresh debate result
    // Convert MiroSharkCategoryScore[] → Record<MiroSharkRiskCategory, number>
    const categoryRecord = report.categoryScores.reduce(
      (acc, cs) => {
        acc[cs.category] = cs.ivScore;
        return acc;
      },
      {} as Record<string, number>,
    );
    resetRunningState(
      simId,
      categoryRecord as Record<
        import("./miroshark-types.js").MiroSharkRiskCategory,
        number
      >,
      report.nextSessionProjection,
    );

    activeSimulations.set(simId, {
      id: simId,
      status: "complete",
      progress: 100,
      startedAt: activeSimulations.get(simId)!.startedAt,
      completedAt: new Date().toISOString(),
    });

    // Persist to Supabase (fire-and-forget)
    persistRun(simId, preset, report, context, briefing).catch((err) => {
      console.warn("[MiroShark] Failed to persist run:", err);
    });

    // Start deliberation pipeline (fire-and-forget — frontend polls for state)
    runDeliberationPipeline(simId, report).catch((err) => {
      console.warn("[MiroShark] Deliberation pipeline failed:", err);
    });

    return { simulationId: simId };
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : "Unknown error starting simulation";
    console.error("[MiroShark] startPrediction failed:", msg);

    activeSimulations.set(simId, {
      id: simId,
      status: "error",
      progress: 0,
      startedAt: activeSimulations.get(simId)!.startedAt,
      error: msg,
    });

    return { error: msg };
  }
}

/** Get simulation status */
export function pollStatus(simId: string): MiroSharkSimulation | null {
  return activeSimulations.get(simId) ?? null;
}

/** Extract structured predictions from a completed simulation */
export function getPredictions(simId: string): MiroSharkPrediction | null {
  return predictionCache.get(simId) ?? null;
}

/** Inject a scenario variable and re-run the debate */
export async function injectScenarioVariable(
  simId: string,
  injection: MiroSharkInjection,
): Promise<MiroSharkSimulation | null> {
  if (!isMiroSharkEnabled()) return null;

  const cachedSeed = seedCache.get(simId);
  if (!cachedSeed) return null;

  try {
    const modifiedSeed = {
      ...cachedSeed,
      entities: [
        ...cachedSeed.entities,
        {
          id: `injection-${crypto.randomUUID().slice(0, 8)}`,
          type: "event" as const,
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
    report.debateLayer = "gov-officials";

    const prediction = reportToPrediction(simId, report);
    predictionCache.set(simId, prediction);

    const sim: MiroSharkSimulation = {
      id: simId,
      status: "complete",
      progress: 100,
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    };
    activeSimulations.set(simId, sim);
    return sim;
  } catch (err) {
    console.error("[MiroShark] injectScenarioVariable failed:", err);
    return null;
  }
}

export function getCachedSimulation(
  simId: string,
): MiroSharkSimulation | undefined {
  return activeSimulations.get(simId);
}

export function getCachedPrediction(
  simId: string,
): MiroSharkPrediction | undefined {
  return predictionCache.get(simId);
}

export function getLatestCachedPrediction(): MiroSharkPrediction | undefined {
  let latest: MiroSharkPrediction | undefined;
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
    .from("mirofish_runs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.warn("[MiroShark] History fetch failed:", error.message);
    return [];
  }
  return data ?? [];
}

/** Get the latest persisted MiroShark report (reconstructed as SanctumData-compatible shape) */
export async function getLatestReport(): Promise<Record<
  string,
  unknown
> | null> {
  // First check in-memory cache
  const cached = getLatestCachedPrediction();
  if (cached) {
    return {
      simulationId: cached.simulationId,
      status: "complete",
      compositeIV: cached.nextSessionScore,
      confidence: cached.confidence,
      regimeShiftProbability: cached.regimeShiftProbability,
      categoryScores: cached.categoryScores ?? [],
      timeSeries: cached.timeSeries ?? [],
      generatedEvents: cached.generatedEvents ?? [],
      scenarios: (cached.scenarios ?? []).map((s) => ({
        label: s.label,
        probability: s.probability,
        projectedScore: s.projectedScore,
      })),
      briefing: cached.briefing ?? null,
      contextSnapshot: cached.contextSnapshot ?? null,
      generatedAt: cached.generatedAt,
      source: "cache",
    };
  }

  // Fall back to Supabase — use select('*') to avoid failing on missing columns
  const sb = getSupabaseClient();
  if (!sb) return null;

  const { data, error } = await sb
    .from("mirofish_runs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1);

  if (error || !data?.length) {
    if (error)
      console.warn("[MiroShark] Latest report fetch failed:", error.message);
    return null;
  }

  const row = data[0] as Record<string, any>;

  // Map scenarios: Supabase stores backend shape (projectedIVScore), frontend expects projectedScore
  const rawScenarios = (row.scenarios ?? []) as Array<Record<string, any>>;
  const scenarios = rawScenarios.map((s) => ({
    label: s.label ?? "",
    probability: s.probability ?? 0,
    projectedScore: s.projectedScore ?? s.projectedIVScore ?? 0,
    description: s.description,
    agentConsensus: s.agentConsensus,
  }));

  // Reconstruct briefing — try full object first, fall back to briefing_text
  const briefing =
    row.briefing ??
    (row.briefing_text
      ? {
          summary: row.briefing_text,
          keyFindings: [],
          riskAlerts: [],
          agentConsensus: "",
          generatedAt: row.created_at,
        }
      : null);

  return {
    simulationId: row.simulation_id,
    status: "complete",
    compositeIV: row.composite_iv,
    confidence: row.confidence,
    regimeShiftProbability: row.regime_shift_probability,
    categoryScores: row.category_scores ?? [],
    timeSeries: row.time_series ?? [],
    generatedEvents: row.generated_events ?? [],
    scenarios,
    briefing,
    contextSnapshot: row.context_snapshot ?? null,
    generatedAt: row.created_at,
    source: "persisted",
  };
}

function reportToPrediction(
  simId: string,
  report: MiroSharkReport,
): MiroSharkPrediction {
  return {
    simulationId: simId,
    nextSessionScore: report.nextSessionProjection,
    confidence: report.confidence,
    regimeShiftProbability: report.regimeShiftProbability,
    scenarios: report.scenarios.map((s) => ({
      label: s.label,
      probability: s.probability,
      projectedScore: s.projectedIVScore,
    })),
    categoryScores: report.categoryScores,
    timeSeries: report.timeSeries,
    generatedEvents: report.generatedEvents,
    briefing: report.briefing,
    contextSnapshot: report.contextSnapshot,
    source: "miroshark",
    generatedAt: report.generatedAt,
  };
}

async function persistRun(
  simId: string,
  preset: SanctumPreset,
  report: MiroSharkReport,
  context: SimulationContext,
  briefing: MiroSharkBriefing,
): Promise<void> {
  const sb = getSupabaseClient();
  if (!sb) return;

  // Base payload (columns that always exist)
  const basePayload = {
    simulation_id: simId,
    preset,
    composite_iv: report.nextSessionProjection,
    regime_shift_probability: report.regimeShiftProbability,
    confidence: report.confidence,
    briefing_text: briefing.summary,
    category_scores: report.categoryScores,
    scenarios: report.scenarios,
    context_snapshot: context,
  };

  // Try insert with full payload (new JSONB columns). Fall back to base if columns don't exist.
  const { error } = await sb.from("mirofish_runs").insert({
    ...basePayload,
    time_series: report.timeSeries,
    generated_events: report.generatedEvents,
    briefing: briefing,
  });

  if (error) {
    console.warn(
      "[MiroShark] Full persist failed, retrying with base columns:",
      error.message,
    );
    await sb.from("mirofish_runs").insert(basePayload);
  }
}

// ── Rolling Window Query ──

export async function getRollingWindowData(
  query: RollingWindowQuery,
): Promise<AggregatedRollingData> {
  const sb = getSupabaseClient();
  if (!sb) return emptyAggregation(query.days);

  const cutoff = new Date(
    Date.now() - query.days * 24 * 60 * 60 * 1000,
  ).toISOString();
  const { data, error } = await sb
    .from("mirofish_runs")
    .select(
      "simulation_id, preset, composite_iv, confidence, regime_shift_probability, briefing_text, category_scores, scenarios, created_at",
    )
    .gte("created_at", cutoff)
    .order("created_at", { ascending: false })
    .limit(query.limit ?? 50);

  if (error || !data?.length) return emptyAggregation(query.days);

  const runs: MiroSharkRunSummary[] = data.map((row) => ({
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

  const avgCompositeIV =
    runs.reduce((s, r) => s + r.compositeIV, 0) / runs.length;
  const avgConfidence =
    runs.reduce((s, r) => s + r.confidence, 0) / runs.length;
  const avgRegimeShift =
    runs.reduce((s, r) => s + r.regimeShiftProbability, 0) / runs.length;

  // Trend: compare first-half avg vs second-half avg
  const mid = Math.floor(runs.length / 2);
  const recentAvg =
    runs.slice(0, mid).reduce((s, r) => s + r.compositeIV, 0) /
    Math.max(mid, 1);
  const olderAvg =
    runs.slice(mid).reduce((s, r) => s + r.compositeIV, 0) /
    Math.max(runs.length - mid, 1);
  const trendDirection =
    recentAvg > olderAvg + 0.3
      ? "rising"
      : recentAvg < olderAvg - 0.3
        ? "falling"
        : "stable";

  return {
    runs,
    avgCompositeIV,
    avgConfidence,
    avgRegimeShift,
    trendDirection,
    periodStart: cutoff,
    periodEnd: new Date().toISOString(),
  };
}

// ── Auto-run Detection ──

const STALENESS_THRESHOLD_HOURS = 6;

export async function shouldAutoRun(): Promise<{
  shouldRun: boolean;
  lastRunAt: string | null;
  staleness: number;
}> {
  const sb = getSupabaseClient();
  if (!sb) return { shouldRun: true, lastRunAt: null, staleness: Infinity };

  // Check runs by ANY user — prevents duplicate runs across devices
  const { data } = await sb
    .from("mirofish_runs")
    .select("created_at")
    .order("created_at", { ascending: false })
    .limit(1);

  if (!data?.length)
    return { shouldRun: true, lastRunAt: null, staleness: Infinity };

  const lastRunAt = data[0].created_at;
  const staleness =
    (Date.now() - new Date(lastRunAt).getTime()) / (60 * 60 * 1000); // hours
  // 12-hour threshold: once-daily auto-run, prevents duplicate runs across users/devices
  return {
    shouldRun: staleness > STALENESS_THRESHOLD_HOURS,
    lastRunAt,
    staleness,
  };
}

// ── Harper AI Analysis ────────────────────────────────────────────────────
// Generates a narrative market breakdown using Harper (AI), stored in briefing.harperAnalysis.
// Mutates the briefing object in-place + updates the persisted run in Supabase.

const HARPER_ANALYSIS_PROMPT = `You are Harper, the Chief Agentic Officer at Priced In Capital. Generate a concise market analysis breakdown (3-5 paragraphs) based on the data below. Write like a senior macro strategist addressing a trading desk — direct, no hedging, actionable. Cover:

1. **Macro Regime** — Where are we in the cycle? What's the dominant driver?
2. **Key Risks** — What could blow up? What's being underpriced?
3. **Positioning** — How should a futures trader be positioned right now?
4. **Catalyst Timeline** — What's coming in the next 24-72h that matters?

Be specific. Reference the actual data points, scores, and scenarios provided. No generic commentary.`;

async function generateHarperAnalysis(
  report: MiroSharkReport,
  context: SimulationContext,
  briefing: MiroSharkBriefing,
): Promise<void> {
  const categoryBreakdown = report.categoryScores
    .map(
      (cs) =>
        `${cs.category}: IV ${cs.ivScore.toFixed(1)}, confidence ${(cs.confidence * 100).toFixed(0)}%, delta ${cs.delta > 0 ? "+" : ""}${cs.delta.toFixed(1)}`,
    )
    .join("\n");

  const scenarioBreakdown = report.scenarios
    .map(
      (s) =>
        `"${s.label}" — ${(s.probability * 100).toFixed(0)}% prob, projected IV ${s.projectedIVScore.toFixed(1)}`,
    )
    .join("\n");

  const topHeadlines = context.riskflowHeadlines
    .slice(0, 10)
    .map(
      (h) => `[${h.risk_type ?? "General"}] ${h.headline} (IV: ${h.iv_score})`,
    )
    .join("\n");

  const userPrompt = `## Simulation Results
Composite IV: ${report.nextSessionProjection.toFixed(1)}/10
Regime Shift Probability: ${(report.regimeShiftProbability * 100).toFixed(0)}%
Confidence: ${(report.confidence * 100).toFixed(0)}%
VIX: ${context.vixLevel?.toFixed(1) ?? "N/A"}

## Category Scores
${categoryBreakdown}

## Scenarios
${scenarioBreakdown}

## Top Headlines (72h)
${topHeadlines || "No headlines available"}

## Agent Votes
${report.agentVotes.map((v) => `${v.agentId}: ${v.position} (conf ${(v.confidence * 100).toFixed(0)}%)`).join("\n")}

## Deterministic Summary
${briefing.summary}`;

  const { text } = await invokeAgent({
    systemPrompt: HARPER_ANALYSIS_PROMPT,
    userPrompt,
    model: { temperature: 0.4, maxTokens: 800 },
  });

  briefing.harperAnalysis = text.trim();

  // Update persisted run in Supabase with the analysis
  const sb = getSupabaseClient();
  if (sb) {
    await sb
      .from("mirofish_runs")
      .update({ briefing })
      .eq("simulation_id", report.simulationId)
      .then(({ error }) => {
        if (error)
          console.warn(
            "[MiroShark] Failed to update harper analysis in DB:",
            error.message,
          );
      });
  }

  // Also update the in-memory prediction cache
  for (const [, pred] of predictionCache) {
    if (pred.briefing && pred.simulationId === report.simulationId) {
      pred.briefing.harperAnalysis = briefing.harperAnalysis;
    }
  }
}

function emptyAggregation(days: number): AggregatedRollingData {
  return {
    runs: [],
    avgCompositeIV: 0,
    avgConfidence: 0,
    avgRegimeShift: 0,
    trendDirection: "stable",
    periodStart: new Date(Date.now() - days * 86400000).toISOString(),
    periodEnd: new Date().toISOString(),
  };
}

// ── Deliberation Pipeline Re-exports ────────────────────────────────────────

export {
  getDeliberationState,
  getDeliberationStateAsync,
  injectUserTake,
} from "./miroshark-deliberation.js";
