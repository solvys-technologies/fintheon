// [claude-code 2026-04-16] T4: Composes accuracy feedback from resolved outcomes
// "Your last 3 predictions: [date] predicted IV 6.2, actual VIX moved +1.3 (direction correct, magnitude overshot by 40%)"

import { getSupabaseClient } from "../../config/supabase.js";
import { createLogger } from "../../lib/logger.js";
import type { AccuracyFeedback, AgentId, PredictionResult } from "./types.js";

const log = createLogger("FeedbackComposer");

/**
 * Compose accuracy feedback for an agent from resolved deliberation outcomes.
 * Returns null if no resolved outcomes exist.
 */
export async function composeFeedback(
  agentId: AgentId,
): Promise<AccuracyFeedback | null> {
  const sb = getSupabaseClient();
  if (!sb) return null;

  const { data, error } = await sb
    .from("deliberation_outcomes")
    .select("*")
    .eq("agent_id", agentId)
    .not("resolved_at", "is", null)
    .order("created_at", { ascending: false })
    .limit(5);

  if (error || !data?.length) return null;

  const predictions: PredictionResult[] = [];

  for (const row of data) {
    const predicted = row.predicted_iv_score as number | null;
    if (predicted === null) continue;

    // Use 24h actual as primary comparison (most reliable)
    const actual24h = row.actual_vix_24h as number | null;
    const dirCorrect = row.direction_correct_24h as boolean | null;
    const magError = row.magnitude_error_24h as number | null;

    if (actual24h === null) continue;

    predictions.push({
      date: new Date(row.created_at as string).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      predictedIV: predicted,
      actualVixChange: actual24h,
      directionCorrect: dirCorrect ?? false,
      magnitudeError: magError ?? 0,
    });
  }

  if (predictions.length === 0) return null;

  const correctCount = predictions.filter((p) => p.directionCorrect).length;
  const overallDirection = (correctCount / predictions.length) * 100;
  const overallMagnitude =
    predictions.reduce((s, p) => s + Math.abs(p.magnitudeError), 0) /
    predictions.length;

  const summary = buildFeedbackSummary(agentId, predictions);

  return {
    agentId,
    predictions,
    overallDirectionAccuracy: overallDirection,
    overallMagnitudeError: overallMagnitude,
    summary,
  };
}

function buildFeedbackSummary(
  agentId: AgentId,
  predictions: PredictionResult[],
): string {
  const lines: string[] = [`Your last ${predictions.length} predictions:`];

  for (const p of predictions) {
    const dir = p.directionCorrect ? "direction correct" : "direction wrong";
    const mag =
      Math.abs(p.magnitudeError) < 0.5
        ? "magnitude accurate"
        : p.magnitudeError > 0
          ? `magnitude overshot by ${p.magnitudeError.toFixed(1)} pts`
          : `magnitude undershot by ${Math.abs(p.magnitudeError).toFixed(1)} pts`;

    lines.push(
      `[${p.date}] predicted IV ${p.predictedIV.toFixed(1)}, ` +
        `actual VIX moved ${p.actualVixChange > 0 ? "+" : ""}${p.actualVixChange.toFixed(1)} (${dir}, ${mag})`,
    );
  }

  const correctCount = predictions.filter((p) => p.directionCorrect).length;
  lines.push(
    `Overall: ${correctCount}/${predictions.length} direction correct ` +
      `(${((correctCount / predictions.length) * 100).toFixed(0)}%)`,
  );

  return lines.join("\n");
}
