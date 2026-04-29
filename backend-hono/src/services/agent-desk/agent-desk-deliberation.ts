// [claude-code 2026-04-17] S23-T2: Merge Harper's post-synthesis scoring into prediction cache so GET /api/agent-desk/latest returns refined numbers
// [claude-code 2026-04-10] S8-T3: Deliberation refactored to DAG execution via dag-scheduler
// [claude-code 2026-04-03] Deliberation v2 — 4-phase pipeline with anti-groupthink + consensus scoring
// Phase 1→Wave 0: Market analysts (parallel DAG tasks)
// Phase 1.5→Wave 0: Gov officials (optional task, geopolitical lanes)
// Phase 2→Wave 1: Hermes deliberation tasks (parallel)
// Phase 3→Wave 2: Harper synthesis task

import type { HermesAgentRole } from "../hermes-service.js";
import type {
  AgentDeskReport,
  AgentDeskAgentResponse,
  GovOfficialAssessment,
  MarketAnalystAssessment,
  HermesDeliberation,
  HarperScoring,
  DeliberationState,
  DeliberationPhase,
} from "./agent-desk-types.js";
import {
  createAgentDeskDAG,
  postProcessDeliberation,
  ANALYST_META,
  type CollectedTaskOutput,
  type NarrativeLane,
} from "../agent-bus/templates/agent-desk-template.js";
import { executeDag } from "../agent-bus/dag-scheduler.js";
import { agentBus } from "../agent-bus/bus.js";
import type { DAGProgressEvent, HermesAgentId } from "../agent-bus/types.js";
import { getSupabaseClient } from "../../config/supabase.js";
import { captureDeliberation } from "../agent-memory/outcome-tracker.js";

// ── In-memory deliberation tracking ─────────────────────────────────────────

const activeDeliberations = new Map<string, DeliberationState>();

export function getDeliberationState(simId: string): DeliberationState | null {
  return activeDeliberations.get(simId) ?? null;
}

/** Rehydrate deliberation from Supabase if not in memory (survives restart). */
export async function getDeliberationStateAsync(
  simId: string,
): Promise<DeliberationState | null> {
  const cached = activeDeliberations.get(simId);
  if (cached) return cached;

  const sb = getSupabaseClient();
  if (!sb) return null;

  const { data, error } = await sb
    .from("miroshark_deliberations")
    .select("*")
    .eq("simulation_id", simId)
    .maybeSingle();

  if (error || !data) return null;

  const state: DeliberationState = {
    simulationId: data.simulation_id,
    phase: data.phase as DeliberationPhase,
    phaseStartedAt: data.created_at,
    analystResults: data.analyst_results ?? undefined,
    govOfficialsSkipped: data.gov_officials_skipped ?? undefined,
    hermesResults: data.hermes_results ?? undefined,
    harperScoring: data.harper_scoring ?? undefined,
    userInjection: data.user_injection ?? undefined,
    error: data.error ?? undefined,
  };

  // Re-cache so subsequent sync calls find it
  activeDeliberations.set(simId, state);
  return state;
}

function updatePhase(
  simId: string,
  phase: DeliberationPhase,
  updates?: Partial<DeliberationState>,
): void {
  const current = activeDeliberations.get(simId);
  if (current) {
    Object.assign(current, {
      phase,
      phaseStartedAt: new Date().toISOString(),
      ...updates,
    });
  }
}

// ── Phase 1: Extract FULL analyst assessments from report ───────────────────
// Preserved for backward compatibility — used by external routes.

export function extractAnalystAssessments(
  report: AgentDeskReport,
  agentResponses?: AgentDeskAgentResponse[],
): MarketAnalystAssessment[] {
  return report.agentVotes.map((vote) => {
    const analyst = ANALYST_META[vote.agentId];
    const fullResponse = agentResponses?.find(
      (r) => r.agentId === vote.agentId,
    );

    return {
      agentId: vote.agentId,
      name: analyst?.name ?? vote.agentId,
      title: analyst?.title ?? vote.agentId,
      role: analyst?.role ?? "analyst",
      subjects: analyst?.subjects ?? [],
      assessment:
        fullResponse?.reasoning ??
        `Position: ${vote.position}, Confidence: ${(vote.confidence * 100).toFixed(0)}%`,
      confidence: vote.confidence,
      keyConcern: fullResponse
        ? extractKeyConcern(fullResponse)
        : vote.position === "high-vol"
          ? "Elevated volatility risk"
          : "Mixed signals",
      projectedIVScore:
        fullResponse?.projectedIVScore ?? report.nextSessionProjection,
      regimeShiftProbability:
        fullResponse?.regimeShiftProbability ?? report.regimeShiftProbability,
      categoryScores: fullResponse?.categoryScores ?? report.categoryScores,
      headlineCount: 0,
    };
  });
}

function extractKeyConcern(response: AgentDeskAgentResponse): string {
  const sorted = [...response.categoryScores].sort(
    (a, b) => b.ivScore - a.ivScore,
  );
  if (sorted.length > 0 && sorted[0].ivScore >= 6) {
    return `Elevated ${sorted[0].category} risk (${sorted[0].ivScore.toFixed(1)}/10)`;
  }
  return response.reasoning?.slice(0, 100) ?? "Mixed signals";
}

export function extractGovAssessments(
  report: AgentDeskReport,
): GovOfficialAssessment[] {
  const GOV_NAMES: Record<string, string> = {
    "fed-chair": "Fed Chair",
    trump: "Trump",
    bessent: "Bessent",
    rubio: "Rubio",
    lutnick: "Lutnick",
    witkoff: "Witkoff",
    greer: "Greer",
    navarro: "Navarro",
  };

  return report.agentVotes.map((vote) => ({
    agentId: vote.agentId,
    name: GOV_NAMES[vote.agentId] ?? vote.agentId,
    role: vote.agentId,
    assessment: `Position: ${vote.position}, Confidence: ${(vote.confidence * 100).toFixed(0)}%`,
    confidence: vote.confidence,
    keyConcern:
      vote.position === "high-vol"
        ? "Elevated volatility risk"
        : vote.position === "low-vol"
          ? "Markets underpricing calm"
          : "Mixed signals",
    recommendedAction:
      vote.position === "high-vol"
        ? "Reduce exposure, widen stops"
        : vote.position === "low-vol"
          ? "Trend continuation, standard sizing"
          : "Wait for clarity",
    projectedIVScore: report.nextSessionProjection,
    regimeShiftProbability: report.regimeShiftProbability,
    categoryScores: report.categoryScores,
  }));
}

// ── Convert AgentDeskReport → AgentDeskParams ────────────────────────────────

function reportToParams(
  report: AgentDeskReport,
  userInjection?: string,
): {
  lanes: NarrativeLane[];
  userInjection?: string;
} {
  const lanes: NarrativeLane[] = report.categoryScores.map((cs) => ({
    id: cs.category,
    name: cs.category
      .replace(/-/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase()),
    sentiment: Math.max(0, Math.min(1, cs.ivScore / 10)),
    category: cs.category,
  }));

  return { lanes, userInjection };
}

// ── Full Deliberation Pipeline (DAG-based) ───────────────────────────────────

export async function runDeliberationPipeline(
  simId: string,
  report: AgentDeskReport,
): Promise<DeliberationState> {
  const state: DeliberationState = {
    simulationId: simId,
    phase: "market-analysts",
    phaseStartedAt: new Date().toISOString(),
  };
  activeDeliberations.set(simId, state);

  try {
    // Build DAG params from the AgentDesk report
    const currentState = activeDeliberations.get(simId)!;
    const params = reportToParams(report, currentState.userInjection);

    const dagDef = await createAgentDeskDAG({
      ...params,
      // No conversationId/userId at this layer — this is the simulation pipeline
    });

    // Collect task outputs via bus subscriptions (must be set up before executeDag)
    const taskWaveMap = new Map<string, number>(); // taskId → wave
    const taskResultMap = new Map<
      string,
      { agentId: HermesAgentId; text: string }
    >(); // taskId → result

    const unsubDispatch = agentBus.subscribe<{
      taskId: string;
      agentId: HermesAgentId;
      wave: number;
    }>("dag.task.dispatch", (msg) => {
      const wave = (msg.payload as { wave: number }).wave;
      if (typeof wave === "number") {
        taskWaveMap.set(msg.taskId!, wave);
      }
    });

    const unsubResult = agentBus.subscribe<{
      taskId: string;
      agentId: HermesAgentId;
      output: string;
      durationMs: number;
    }>("dag.task.result", (msg) => {
      taskResultMap.set(msg.taskId!, {
        agentId: msg.agentId!,
        text: (msg.payload as { output: string }).output ?? "",
      });
    });

    // Track phase transitions via dag-status events
    const unsubStatus = agentBus.subscribe<DAGProgressEvent>(
      "dag.status",
      (msg) => {
        if (!activeDeliberations.has(simId)) return;
        const ev = msg.payload;
        if (ev.type === "dag-wave") {
          const wavePhases: Record<number, DeliberationPhase> = {
            0: "market-analysts",
            1: "hermes-deliberation",
            2: "harper-scoring",
          };
          const phase = wavePhases[ev.wave];
          if (phase) updatePhase(simId, phase);
        }
      },
    );

    try {
      const dagRecord = await executeDag(dagDef);

      // Build CollectedTaskOutput from captured events
      const collectedOutputs: CollectedTaskOutput[] = [];
      for (const [taskId, result] of taskResultMap) {
        const wave = taskWaveMap.get(taskId);
        if (wave !== undefined) {
          collectedOutputs.push({
            agentId: result.agentId,
            wave,
            text: result.text,
          });
        }
      }

      // Post-process: convergence, consensus scoring, Harper synthesis extraction
      const result = postProcessDeliberation(
        dagRecord,
        collectedOutputs,
        simId,
        currentState.userInjection,
      );

      // Persist result to activeDeliberations map (backward compat with polling)
      Object.assign(activeDeliberations.get(simId)!, result);
      updatePhase(simId, "complete", result);

      // [S23-T2] Merge Harper's refined scoring into the prediction cache so GET /api/agent-desk/latest
      // returns post-synthesis numbers — fixes the Aquarium "Updating…" hang.
      const finalState = activeDeliberations.get(simId)!;
      if (finalState.harperScoring) {
        const { mergeHarperScoringIntoCache } =
          await import("./agent-desk-service.js");
        mergeHarperScoringIntoCache(simId, finalState.harperScoring);
      }

      // Persist deliberation to Supabase (fire-and-forget)
      persistDeliberation(activeDeliberations.get(simId)!).catch((err) => {
        console.warn("[AgentDesk Deliberation] Failed to persist:", err);
      });

      // T4: Capture predictions for outcome tracking (fire-and-forget)
      captureDeliberation(simId).catch((err) => {
        console.warn("[AgentDesk Deliberation] Outcome capture failed:", err);
      });

      return activeDeliberations.get(simId)!;
    } finally {
      unsubDispatch();
      unsubResult();
      unsubStatus();
    }
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : "Deliberation pipeline failed";
    console.error("[AgentDesk Deliberation]", msg);
    updatePhase(simId, "complete", { error: msg });
    return activeDeliberations.get(simId)!;
  }
}

/** Inject a user take into an active deliberation.
 *
 * If Wave 1 (hermes-deliberation) has not yet started: sets the injection so
 * the pending wave 1 tasks can include it via prompt context.
 * If Wave 1 is already running: publishes to bus for synthesis to pick up,
 * and logs it (agents cannot be mid-stream modified).
 */
export function injectUserTake(simId: string, take: string): boolean {
  const state = activeDeliberations.get(simId);
  if (!state || state.phase === "complete" || state.phase === "idle")
    return false;

  state.userInjection = take;

  // If deliberation is mid-stream, publish so downstream synthesis can note it
  if (
    state.phase === "hermes-deliberation" ||
    state.phase === "harper-scoring"
  ) {
    console.log(
      `[AgentDesk Deliberation] User injection mid-stream (${state.phase}) — logged for synthesis: ${take.slice(0, 80)}`,
    );
    agentBus.publish("dag.status", {
      dagId: simId,
      payload: {
        type: "dag-wave",
        dagId: simId,
        wave: -1, // sentinel: user injection mid-run
        tasks: [],
        userInjection: take,
      } as DAGProgressEvent & { userInjection: string },
    });
  }

  return true;
}

// ── Supabase Persistence ────────────────────────────────────────────────────

async function persistDeliberation(state: DeliberationState): Promise<void> {
  const sb = getSupabaseClient();
  if (!sb) return;

  const { error } = await sb.from("miroshark_deliberations").upsert(
    {
      simulation_id: state.simulationId,
      phase: state.phase,
      analyst_results: state.analystResults ?? null,
      gov_officials_skipped: state.govOfficialsSkipped ?? false,
      hermes_results: state.hermesResults ?? null,
      harper_scoring: state.harperScoring ?? null,
      user_injection: state.userInjection ?? null,
      error: state.error ?? null,
    },
    { onConflict: "simulation_id" },
  );

  if (error) {
    console.warn("[AgentDesk Deliberation] Persist failed:", error.message);
  } else {
    console.log(
      `[AgentDesk Deliberation] Persisted deliberation for ${state.simulationId}`,
    );
  }
}

// ── Re-export types for backward compatibility ───────────────────────────────
// Other modules import these type names from this file
export type { HermesAgentRole };
