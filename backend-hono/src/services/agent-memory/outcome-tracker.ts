// [claude-code 2026-04-18] T4: Captures deliberation predictions into deliberation_outcomes
// Reads agent assessments from miroshark_deliberations, stores predictions for later resolution.
// Fix: MiroShark DAG emits analyst.agentId as oracle|feucht|consul|herald directly, so
// mapAnalystToAgent is now a passthrough validator (was a stale legacy-role mapping that
// silently dropped every per-agent row).

import { getSupabaseClient } from "../../config/supabase.js";
import { createLogger } from "../../lib/logger.js";
import { addMemory } from "./memory-store.js";
import type { AgentId } from "./types.js";
import type {
  HarperOpusScoring,
  MarketAnalystAssessment,
  HermesDeliberation,
} from "../miroshark/miroshark-types.js";

const log = createLogger("OutcomeTracker");

/** Agent IDs that participate in deliberations */
const DELIBERATION_AGENTS: AgentId[] = ["oracle", "feucht", "consul", "herald"];

/**
 * Capture predictions from a completed deliberation.
 * Called after deliberation completes — reads from miroshark_deliberations,
 * creates rows in deliberation_outcomes for each agent + Harper synthesis.
 */
export async function captureDeliberation(
  simulationId: string,
): Promise<number> {
  const sb = getSupabaseClient();
  if (!sb) {
    log.warn("Supabase unavailable — skipping outcome capture");
    return 0;
  }

  // Fetch the deliberation record
  const { data: delib, error } = await sb
    .from("miroshark_deliberations")
    .select(
      "id, simulation_id, analyst_results, hermes_results, harper_scoring, created_at",
    )
    .eq("simulation_id", simulationId)
    .maybeSingle();

  if (error || !delib) {
    log.warn("Deliberation not found for outcome capture", {
      simulationId,
      error: error?.message,
    });
    return 0;
  }

  const deliberationId = delib.id;
  const analysts = (delib.analyst_results ?? []) as MarketAnalystAssessment[];
  const hermes = (delib.hermes_results ?? []) as HermesDeliberation[];
  const harper = delib.harper_scoring as HarperOpusScoring | null;

  const rows: Array<Record<string, unknown>> = [];

  // Capture Harper synthesis (the main composite prediction)
  if (harper) {
    rows.push({
      deliberation_id: deliberationId,
      agent_id: "harper",
      predicted_iv_score: harper.compositeIV,
      predicted_regime_shift: harper.regimeShiftProbability,
      predicted_category_scores: harper.categoryScores,
    });

    // Store deliberation output in agent memory
    await addMemory({
      agentId: "harper",
      memoryType: "deliberation_output",
      content: buildDelibSummary(
        "harper",
        harper.compositeIV,
        harper.regimeShiftProbability,
      ),
      metadata: { simulationId, compositeIV: harper.compositeIV },
      ttlHours: 7 * 24, // 7-day retention
    });
  }

  // Capture individual analyst predictions
  for (const analyst of analysts) {
    const agentId = mapAnalystToAgent(analyst.agentId);
    if (!agentId) continue;

    rows.push({
      deliberation_id: deliberationId,
      agent_id: agentId,
      predicted_iv_score: analyst.projectedIVScore,
      predicted_regime_shift: analyst.regimeShiftProbability,
      predicted_category_scores: analyst.categoryScores,
    });

    await addMemory({
      agentId,
      memoryType: "deliberation_output",
      content: buildDelibSummary(
        agentId,
        analyst.projectedIVScore,
        analyst.regimeShiftProbability,
      ),
      metadata: { simulationId, projectedIV: analyst.projectedIVScore },
      ttlHours: 7 * 24,
    });
  }

  if (rows.length === 0) {
    log.info("No predictions to capture", { simulationId });
    return 0;
  }

  const { error: insertError } = await sb
    .from("deliberation_outcomes")
    .insert(rows);

  if (insertError) {
    log.warn("Failed to insert deliberation outcomes", {
      error: insertError.message,
    });
    return 0;
  }

  log.info(`Captured ${rows.length} predictions for ${simulationId}`);
  return rows.length;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function buildDelibSummary(
  agentId: string,
  ivScore: number,
  regimeShift: number,
): string {
  return (
    `Predicted IV ${ivScore.toFixed(1)}/10, regime shift probability ` +
    `${(regimeShift * 100).toFixed(0)}%`
  );
}

/**
 * Validate MiroShark analyst ID. The DAG emits one of the four core Hermes agent
 * IDs directly (see miroshark-template WAVE0_AGENTS + ANALYST_META), so the
 * analyst ID is already the target agent ID — we just need to guard against
 * anything outside the expected set. Legacy analyst role keys (flow-trader,
 * vol-strategist, etc.) are no longer produced and deliberately fall through
 * to null.
 */
function mapAnalystToAgent(analystId: string): AgentId | null {
  return DELIBERATION_AGENTS.includes(analystId as AgentId)
    ? (analystId as AgentId)
    : null;
}
