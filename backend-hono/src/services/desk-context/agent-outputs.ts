import { getSupabaseClient } from "../../config/supabase.js";
import { createLogger } from "../../lib/logger.js";

const log = createLogger("desk-context");

/**
 * Fetch recent agent outputs from the context bank (artifact + observation entries).
 * Returns formatted text blocks suitable for prompt injection.
 * Gracefully returns [] on any DB failure.
 */
export async function getRecentOutputs(
  agentId: string,
  hoursBack = 24,
): Promise<string[]> {
  try {
    const sb = getSupabaseClient();
    if (!sb) return [];

    const cutoff = new Date(
      Date.now() - hoursBack * 60 * 60 * 1000,
    ).toISOString();

    const { data, error } = await sb
      .from("agent_context_bank")
      .select("content, updated_at, agent_id")
      .eq("agent_id", agentId)
      .in("memory_type", ["artifact", "observation"])
      .gte("updated_at", cutoff)
      .order("updated_at", { ascending: false })
      .limit(10);

    if (error) {
      log.warn("getRecentOutputs: query failed", {
        agentId,
        error: error.message,
      });
      return [];
    }

    if (!data?.length) return [];

    return data.map((row) => {
      const ts = row.updated_at
        ? new Date(row.updated_at).toISOString().slice(0, 16).replace("T", " ")
        : "unknown";
      const summary = (row.content ?? "").slice(0, 200);
      return `[${ts}] ${agentId}: ${summary}`;
    });
  } catch (err) {
    log.warn("getRecentOutputs: unexpected error", {
      agentId,
      error: String(err),
    });
    return [];
  }
}
