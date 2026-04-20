// [claude-code 2026-04-20] S21-T5: PsychAssist fork editor endpoints.
// Gated by requireFeature('psych_assist_fork.edit') — only users with that
// override row (seed: reasoning@pricedinresearch.io) can read/write.

import { Hono } from "hono";
import type { Context } from "hono";
import { requireAuth } from "../../middleware/auth.js";
import { requireFeature } from "../../middleware/require-feature.js";
import { getSupabaseClient } from "../../config/supabase.js";
import { createLogger } from "../../lib/logger.js";

const log = createLogger("PsychAssistForkAdmin");

export function createPsychAssistForkRoutes() {
  const router = new Hono();

  router.use("*", requireAuth, requireFeature("psych_assist_fork.edit"));

  // GET current fork configuration for the calling user.
  router.get("/", async (c: Context) => {
    const userId = c.get("userId") as string;
    const sb = getSupabaseClient();
    if (!sb) return c.json({ error: "database unavailable" }, 503);

    const { data, error } = await sb
      .from("psych_assist_forks")
      .select("system_prompt, er_weights, tilt_thresholds, notes, updated_at")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      log.error("fork read failed", { error: error.message });
      return c.json({ error: "read failed" }, 500);
    }

    return c.json({ fork: data ?? null });
  });

  // PUT upserts the fork for the calling user.
  router.put("/", async (c: Context) => {
    const userId = c.get("userId") as string;
    const sb = getSupabaseClient();
    if (!sb) return c.json({ error: "database unavailable" }, 503);

    const body = (await c.req.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const systemPrompt =
      typeof body.system_prompt === "string" ? body.system_prompt : null;
    const erWeights =
      body.er_weights && typeof body.er_weights === "object"
        ? body.er_weights
        : {};
    const tiltThresholds =
      body.tilt_thresholds && typeof body.tilt_thresholds === "object"
        ? body.tilt_thresholds
        : {};
    const notes = typeof body.notes === "string" ? body.notes : null;

    const { error } = await sb.from("psych_assist_forks").upsert({
      user_id: userId,
      system_prompt: systemPrompt,
      er_weights: erWeights,
      tilt_thresholds: tiltThresholds,
      notes,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      log.error("fork write failed", { error: error.message });
      return c.json({ error: "write failed" }, 500);
    }

    return c.json({ ok: true });
  });

  // GET flag-toggle status for the fork feature surface (what the fork editor
  // UI renders in the flag-toggle panel). Only returns entries the user has
  // an override row for.
  router.get("/flags", async (c: Context) => {
    const userId = c.get("userId") as string;
    const { listUserOverrides } =
      await import("../../services/user-feature-overrides.js");
    const rows = await listUserOverrides(userId);
    return c.json({ overrides: rows });
  });

  // PUT toggles a flag override for the calling user. Gated additionally by
  // `psych_assist_fork.flag_toggle` so not every fork editor can flip flags.
  router.put(
    "/flags/:feature",
    requireFeature("psych_assist_fork.flag_toggle"),
    async (c: Context) => {
      const userId = c.get("userId") as string;
      const feature = c.req.param("feature");
      const body = (await c.req.json().catch(() => ({}))) as {
        enabled?: boolean;
      };
      const enabled = body.enabled !== false;
      const { setUserOverride } =
        await import("../../services/user-feature-overrides.js");
      const ok = await setUserOverride(userId, feature, enabled, {}, userId);
      if (!ok) return c.json({ error: "write failed" }, 500);
      return c.json({ ok: true, feature, enabled });
    },
  );

  return router;
}
