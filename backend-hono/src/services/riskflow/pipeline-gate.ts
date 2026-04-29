// [claude-code 2026-04-28] S48-T1: Pipeline gate — per-pipeline toggle with
// in-memory cache, 30s TTL, Supabase-backed. Every ingest path calls
// isPipelineEnabled() at entry to respect the killswitch.

import { createLogger } from "../../lib/logger.js";
import { getSupabaseClient } from "../../config/supabase.js";
import type { IngestPipeline } from "../../types/pipeline.js";

const log = createLogger("PipelineGate");

const stateCache = new Map<string, boolean>();
let lastRefresh = 0;
const CACHE_TTL_MS = 30_000;

export async function isPipelineEnabled(
  pipelineId: IngestPipeline,
): Promise<boolean> {
  const cached = stateCache.get(pipelineId);
  if (cached !== undefined && Date.now() - lastRefresh < CACHE_TTL_MS) {
    return cached;
  }
  await refreshPipelineState();
  return stateCache.get(pipelineId) ?? true;
}

export async function refreshPipelineState(): Promise<void> {
  const sb = getSupabaseClient();
  if (!sb) {
    // No Supabase — default all enabled
    for (const id of [...stateCache.keys()]) stateCache.set(id, true);
    lastRefresh = Date.now();
    return;
  }
  try {
    const { data, error } = await sb
      .from("ingest_pipeline_state")
      .select("pipeline_id, enabled");
    if (error) {
      log.warn("Failed to load pipeline state, defaulting all enabled", {
        error: error.message,
      });
      lastRefresh = Date.now();
      return;
    }
    stateCache.clear();
    for (const row of (data ?? []) as Array<{
      pipeline_id: string;
      enabled: boolean;
    }>) {
      stateCache.set(row.pipeline_id, row.enabled);
    }
    lastRefresh = Date.now();
  } catch (err) {
    log.warn("Pipeline gate refresh failed, keeping stale state", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export function clearPipelineCache(): void {
  stateCache.clear();
  lastRefresh = 0;
}
