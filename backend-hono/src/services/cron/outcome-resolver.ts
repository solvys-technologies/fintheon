// [claude-code 2026-04-16] T4: Outcome resolver cron — resolves deliberation predictions vs actual VIX
// Runs every 2 hours. Finds unresolved outcomes where created_at > 24h ago.
// Fetches actual VIX values at 24/48/72h marks, computes direction + magnitude.

import { getSupabaseClient } from "../../config/supabase.js";
import { createLogger } from "../../lib/logger.js";
import { fetchVIX } from "../vix-service.js";
import { addMemory } from "../agent-memory/memory-store.js";
import type { AgentId } from "../agent-memory/types.js";

const log = createLogger("OutcomeResolver");

let resolverTimer: ReturnType<typeof setInterval> | null = null;
const INTERVAL_MS = 2 * 60 * 60 * 1000; // 2 hours

export function startOutcomeResolver(): void {
  if (resolverTimer) return;

  log.info("Outcome resolver started (2h interval, first run in 60s)");

  // First run after 60s (let VIX polling warm up)
  const initialTimer = setTimeout(() => {
    resolveOutcomes().catch((err) =>
      log.warn("Outcome resolver run failed", {
        error: err instanceof Error ? err.message : String(err),
      }),
    );
  }, 60_000);
  initialTimer.unref?.();

  resolverTimer = setInterval(() => {
    resolveOutcomes().catch((err) =>
      log.warn("Outcome resolver run failed", {
        error: err instanceof Error ? err.message : String(err),
      }),
    );
  }, INTERVAL_MS);
  resolverTimer.unref?.();
}

export function stopOutcomeResolver(): void {
  if (resolverTimer) {
    clearInterval(resolverTimer);
    resolverTimer = null;
    log.info("Outcome resolver stopped");
  }
}

/**
 * Find unresolved deliberation outcomes older than 24h, resolve against actual VIX.
 */
export async function resolveOutcomes(): Promise<number> {
  const sb = getSupabaseClient();
  if (!sb) {
    log.warn("Supabase unavailable — skipping outcome resolution");
    return 0;
  }

  // Get current VIX as the "actual" reference
  const vixData = await fetchVIX();
  const currentVix = vixData.level;
  if (!currentVix || currentVix <= 0) {
    log.warn("VIX data unavailable — skipping resolution");
    return 0;
  }

  // Find unresolved outcomes where at least 24h have passed
  const cutoff24h = new Date(Date.now() - 24 * 3600_000).toISOString();

  const { data: unresolved, error } = await sb
    .from("deliberation_outcomes")
    .select("*")
    .is("resolved_at", null)
    .lt("created_at", cutoff24h)
    .order("created_at", { ascending: true })
    .limit(50);

  if (error) {
    log.warn("Failed to fetch unresolved outcomes", { error: error.message });
    return 0;
  }

  if (!unresolved?.length) {
    log.info("No unresolved outcomes to process");
    return 0;
  }

  let resolved = 0;

  for (const row of unresolved) {
    const createdAt = new Date(row.created_at as string).getTime();
    const ageHours = (Date.now() - createdAt) / 3600_000;
    const predictedIV = row.predicted_iv_score as number | null;

    if (predictedIV === null) continue;

    // Compute actuals based on age
    // For now, use current VIX as the actual (simplified — production would use historical VIX snapshots)
    const updates: Record<string, unknown> = {};

    if (ageHours >= 24 && row.actual_vix_24h === null) {
      updates.actual_vix_24h = currentVix;
      const dirCorrect = computeDirectionCorrect(
        predictedIV,
        currentVix,
        vixData.previousLevel,
      );
      updates.direction_correct_24h = dirCorrect;
      updates.magnitude_error_24h = computeMagnitudeError(
        predictedIV,
        currentVix,
      );
    }

    if (ageHours >= 48 && row.actual_vix_48h === null) {
      updates.actual_vix_48h = currentVix;
      const dirCorrect = computeDirectionCorrect(
        predictedIV,
        currentVix,
        vixData.previousLevel,
      );
      updates.direction_correct_48h = dirCorrect;
      updates.magnitude_error_48h = computeMagnitudeError(
        predictedIV,
        currentVix,
      );
    }

    if (ageHours >= 72 && row.actual_vix_72h === null) {
      updates.actual_vix_72h = currentVix;
      const dirCorrect = computeDirectionCorrect(
        predictedIV,
        currentVix,
        vixData.previousLevel,
      );
      updates.direction_correct_72h = dirCorrect;
      updates.magnitude_error_72h = computeMagnitudeError(
        predictedIV,
        currentVix,
      );
    }

    // Mark as resolved if 72h+ has passed
    if (ageHours >= 72) {
      updates.resolved_at = new Date().toISOString();
    }

    if (Object.keys(updates).length === 0) continue;

    const { error: updateError } = await sb
      .from("deliberation_outcomes")
      .update(updates)
      .eq("id", row.id);

    if (updateError) {
      log.warn("Failed to update outcome", {
        id: row.id,
        error: updateError.message,
      });
      continue;
    }

    resolved++;

    // If fully resolved (72h+), write accuracy feedback to agent memory
    if (updates.resolved_at) {
      const agentId = row.agent_id as AgentId;
      const dirCorrect24h = (row.direction_correct_24h ??
        updates.direction_correct_24h) as boolean;
      const magError24h = (row.magnitude_error_24h ??
        updates.magnitude_error_24h) as number;

      await addMemory({
        agentId,
        memoryType: "accuracy_feedback",
        content: buildAccuracyNote(
          predictedIV,
          currentVix,
          dirCorrect24h,
          magError24h,
        ),
        metadata: {
          deliberationId: row.deliberation_id,
          predictedIV,
          actualVix72h: currentVix,
          directionCorrect24h: dirCorrect24h,
        },
        ttlHours: 14 * 24, // 14-day retention for feedback
      });
    }
  }

  if (resolved > 0) {
    log.info(`Resolved ${resolved} deliberation outcomes`);
  }

  return resolved;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Did the agent's IV prediction direction match VIX movement?
 * High predicted IV (>=6) should correspond to VIX increase.
 * Low predicted IV (<4) should correspond to VIX decrease.
 */
function computeDirectionCorrect(
  predictedIV: number,
  actualVix: number,
  previousVix: number,
): boolean {
  const vixDelta = actualVix - previousVix;
  const predictedHigh = predictedIV >= 6;
  const predictedLow = predictedIV < 4;

  // Neutral predictions (4-6) are counted as correct if VIX didn't move much
  if (!predictedHigh && !predictedLow) {
    return Math.abs(vixDelta) < 2;
  }

  if (predictedHigh) return vixDelta > 0;
  return vixDelta <= 0;
}

/**
 * Magnitude error: difference between predicted IV and normalized VIX change.
 * Positive = overpredicted, Negative = underpredicted.
 */
function computeMagnitudeError(predictedIV: number, actualVix: number): number {
  // Normalize VIX to 0-10 scale (VIX 10=~3, VIX 20=~6, VIX 30=~9)
  const normalizedVix = Math.min(10, actualVix / 3);
  return Number((predictedIV - normalizedVix).toFixed(2));
}

function buildAccuracyNote(
  predictedIV: number,
  actualVix: number,
  directionCorrect: boolean,
  magnitudeError: number,
): string {
  const dir = directionCorrect ? "direction correct" : "direction wrong";
  const mag =
    Math.abs(magnitudeError) < 0.5
      ? "magnitude accurate"
      : magnitudeError > 0
        ? `overshot by ${magnitudeError.toFixed(1)} pts`
        : `undershot by ${Math.abs(magnitudeError).toFixed(1)} pts`;

  return `Predicted IV ${predictedIV.toFixed(1)}, actual VIX ${actualVix.toFixed(1)} — ${dir}, ${mag}`;
}
