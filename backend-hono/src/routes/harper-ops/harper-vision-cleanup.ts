// [claude-code 2026-04-23] S32-T2 — Routine-gated POST /api/harper-ops/harper-vision-cleanup
// Invokes the existing SQL cleanup functions defined in 030_harper_vision.sql:
//   cleanup_harper_vision_frames()      — deletes frames older than 24h
//   cleanup_harper_vision_transcripts() — deletes transcripts older than 7d
// Gated by x-routine-secret so only the scheduled Routine can fire it.

import { Hono } from "hono";
import { createClient } from "@supabase/supabase-js";

function gateRoutine(secretHeader: string | undefined): boolean {
  const expected = process.env.ROUTINE_SECRET;
  if (!expected) return false;
  return typeof secretHeader === "string" && secretHeader === expected;
}

export function createHarperVisionCleanupRoute() {
  const app = new Hono();

  app.post("/", async (c) => {
    const secret = c.req.header("x-routine-secret");
    if (!gateRoutine(secret)) return c.json({ error: "unauthorized" }, 401);

    const supabase = createClient(
      process.env.SUPABASE_URL || "",
      process.env.SUPABASE_SERVICE_ROLE_KEY || "",
    );

    const [framesResult, transcriptsResult] = await Promise.all([
      supabase.rpc("cleanup_harper_vision_frames"),
      supabase.rpc("cleanup_harper_vision_transcripts"),
    ]);

    const errors: string[] = [];
    if (framesResult.error)
      errors.push(`frames: ${framesResult.error.message}`);
    if (transcriptsResult.error)
      errors.push(`transcripts: ${transcriptsResult.error.message}`);

    if (errors.length) {
      return c.json({ ok: false, errors }, 500);
    }

    return c.json({
      ok: true,
      ranAt: new Date().toISOString(),
      functions: [
        "cleanup_harper_vision_frames",
        "cleanup_harper_vision_transcripts",
      ],
    });
  });

  return app;
}
