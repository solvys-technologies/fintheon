// [claude-code 2026-04-28] S48-T1: Admin pipeline toggle routes.
//   GET  /api/admin/pipelines       → return all pipeline states
//   PATCH /api/admin/pipelines/:id  → toggle enabled, track updated_by
// Gate: super-admin (applied in routes/index.ts).

import { Hono } from "hono";
import { getSupabaseClient } from "../../config/supabase.js";
import { clearPipelineCache } from "../../services/riskflow/pipeline-gate.js";
import type { PipelineState } from "../../types/pipeline.js";

const app = new Hono();

// GET /api/admin/pipelines
app.get("/", async (c) => {
  const sb = getSupabaseClient();
  if (!sb) {
    return c.json({ error: "No database connection" }, 503);
  }

  const { data, error } = await sb
    .from("ingest_pipeline_state")
    .select("pipeline_id, enabled, updated_at, updated_by")
    .order("pipeline_id");

  if (error) {
    return c.json({ error: error.message }, 500);
  }

  return c.json({ pipelines: (data ?? []) as PipelineState[] });
});

// PATCH /api/admin/pipelines/:id
app.patch("/:id", async (c) => {
  const pipelineId = c.req.param("id");
  if (!pipelineId) {
    return c.json({ error: "Missing pipeline id" }, 400);
  }

  const body = await c.req.json().catch(() => ({}));
  if (typeof body.enabled !== "boolean") {
    return c.json({ error: "Missing required field: enabled (boolean)" }, 400);
  }

  const sb = getSupabaseClient();
  if (!sb) {
    return c.json({ error: "No database connection" }, 503);
  }

  const updatedBy = c.get("userId" as never) as string | undefined;
  const now = new Date().toISOString();

  const { data, error } = await sb
    .from("ingest_pipeline_state")
    .upsert(
      {
        pipeline_id: pipelineId,
        enabled: body.enabled,
        updated_at: now,
        updated_by: updatedBy,
      },
      { onConflict: "pipeline_id" },
    )
    .select("pipeline_id, enabled, updated_at, updated_by")
    .single();

  if (error) {
    return c.json({ error: error.message }, 500);
  }

  clearPipelineCache();

  return c.json({ pipeline: data as PipelineState });
});

export function createPipelineRoutes(): Hono {
  return app;
}
