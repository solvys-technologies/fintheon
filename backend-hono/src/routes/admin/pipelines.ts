// [claude-code 2026-04-28] S48-T1: Admin pipeline toggle routes.
//   GET  /api/admin/pipelines       → return all pipeline states
//   PATCH /api/admin/pipelines/:id  → toggle enabled, track updated_by
// Gate: super-admin (applied in routes/index.ts).
// [claude-code 2026-04-29] S53-T4: enrich response with label/description
// fields so Refinement UI can display human-readable pipeline names.

import { Hono } from "hono";
import { getSupabaseClient } from "../../config/supabase.js";
import { clearPipelineCache } from "../../services/riskflow/pipeline-gate.js";
import type { PipelineState } from "../../types/pipeline.js";

const app = new Hono();

const PIPELINE_LABELS: Record<string, { label: string; description: string }> = {
  "x-syndication": {
    label: "X Syndication",
    description: "Ingest from tracked X accounts via Rettiwt polling",
  },
  "xactions": {
    label: "X Actions",
    description: "Ingest agent-sourced X content via browser harness",
  },
  "agent-reach-nitter": {
    label: "Agent Reach",
    description: "Ingest from agent-curated domains via nitter mirrors",
  },
  "browser-harness": {
    label: "Browser Harness",
    description: "Direct browser-based content extraction",
  },
  "rettiwt-commentary": {
    label: "Rettiwt Commentary",
    description: "Commentary feed ingestion via Rettiwt API",
  },
  "economic-calendar": {
    label: "Economic Calendar",
    description: "Economic event data from TradingView calendar",
  },
  "kalshi-whale": {
    label: "Kalshi Whale",
    description: "Large-position tracking from Kalshi markets",
  },
};

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

  const pipelines = ((data ?? []) as PipelineState[]).map((p) => {
    const meta = PIPELINE_LABELS[p.pipeline_id] ?? {
      label: p.pipeline_id,
      description: "",
    };
    return { ...p, label: meta.label, description: meta.description };
  });

  return c.json({ pipelines });
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
