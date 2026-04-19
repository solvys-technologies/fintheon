// [claude-code 2026-04-16] Boot-time restore of AgentDesk running state from latest Aquarium simulation.
// Without this, agentDeskComponent in the IV score is always 0 after backend restart.

import { getSupabaseClient } from "../../config/supabase.js";
import {
  resetRunningState,
  type AgentDeskRiskCategory,
} from "./agent-desk-reactive.js";

const ALL_CATEGORIES: AgentDeskRiskCategory[] = [
  "geopolitical",
  "political",
  "monetary-policy",
  "earnings-corporate",
  "market-structure",
  "black-swan",
];

/**
 * Restore AgentDesk running state from the latest Aquarium simulation in DB.
 * Called once at boot — if no recent simulation exists, running state stays null (score 0).
 */
export async function restoreAgentDeskRunningState(): Promise<void> {
  const sb = getSupabaseClient();
  if (!sb) return;

  const { data, error } = await sb
    .from("mirofish_runs")
    .select("simulation_id, composite_iv, category_scores, created_at")
    .order("created_at", { ascending: false })
    .limit(1);

  if (error || !data?.length) {
    if (error)
      console.warn(
        "[AgentDesk Boot] Failed to fetch latest run:",
        error.message,
      );
    return;
  }

  const row = data[0];
  const compositeIV =
    typeof row.composite_iv === "number" ? row.composite_iv : 0;

  // Only restore if the simulation is less than 24h old
  const ageMs = Date.now() - new Date(row.created_at).getTime();
  if (ageMs > 24 * 60 * 60 * 1000) {
    console.log(
      `[AgentDesk Boot] Latest simulation too old (${Math.round(ageMs / 3600000)}h), skipping restore`,
    );
    return;
  }

  // Reconstruct category scores from DB (may be stored as array or object)
  const categoryScores: Record<AgentDeskRiskCategory, number> = {} as Record<
    AgentDeskRiskCategory,
    number
  >;
  for (const cat of ALL_CATEGORIES) {
    categoryScores[cat] = 0;
  }

  if (row.category_scores) {
    if (Array.isArray(row.category_scores)) {
      for (const entry of row.category_scores) {
        const cat = entry.category as AgentDeskRiskCategory;
        if (ALL_CATEGORIES.includes(cat)) {
          categoryScores[cat] = entry.score ?? entry.value ?? 0;
        }
      }
    } else if (typeof row.category_scores === "object") {
      for (const [cat, score] of Object.entries(row.category_scores)) {
        if (ALL_CATEGORIES.includes(cat as AgentDeskRiskCategory)) {
          categoryScores[cat as AgentDeskRiskCategory] =
            typeof score === "number" ? score : 0;
        }
      }
    }
  }

  resetRunningState(row.simulation_id, categoryScores, compositeIV);
  console.log(
    `[AgentDesk Boot] Restored running state from simulation ${row.simulation_id} ` +
      `(compositeIV: ${compositeIV.toFixed(1)}, age: ${Math.round(ageMs / 60000)}m)`,
  );
}
