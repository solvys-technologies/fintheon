// [claude-code 2026-05-06] S59-T4: revision-check endpoint for Sanctum refresh button.
//   Checks recent IV≥7 RiskFlow items since last briefing, triggers quick deliberation
//   if anything notable, regenerates the desk plan, and updates the frontend briefing.

import { Hono } from "hono";
import { createLogger } from "../../lib/logger.js";
import { requireAuth, requireSuperadmin } from "../../middleware/auth.js";
import {
  getLatest,
  getLatestByTrigger,
  getVerdict,
  getSeatOverrides,
  saveSeatOverrides,
  resetSeatOverrides,
  runChamber,
  type ArbitrumTriggerType,
} from "../../services/arbitrum/index.js";
import { checkDeepSeekDirectHealth } from "../../services/strands/provider.js";

const log = createLogger("ArbitrumRoutes");

const VALID_TRIGGERS: ReadonlySet<ArbitrumTriggerType> = new Set([
  "event",
  "session",
  "manual",
]);

export function createArbitrumRoutes(): Hono {
  const app = new Hono();

  // ── health endpoint (must be defined before /:id) ──
  app.get("/health", async (c) => {
    const deepseekKeySet = Boolean(process.env.DEEPSEEK_API_KEY);
    let deepseekReachable = false;
    let lastLatencyMs: number | null = null;
    let lastError: string | null = null;

    if (deepseekKeySet) {
      try {
        const health = await checkDeepSeekDirectHealth();
        deepseekReachable = health.available;
        lastError = health.error;
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
      }
    }

    // Load latest verdict for confidence context + latency
    const latest = await getLatest();
    if (latest?.latency_ms) lastLatencyMs = latest.latency_ms;

    const lastConfidence = latest
      ? {
          verdict_id: latest.verdict_id,
          created_at: latest.created_at,
          seats: (latest.seats ?? []).slice(0, 5).map((s) => ({
            seat_id: s.id,
            probability: s.rounds?.[s.rounds.length - 1]?.probability ?? 0,
            confidence: s.rounds?.[s.rounds.length - 1]?.confidence ?? 0,
          })),
          chamber_confidence: latest.confidence,
        }
      : null;

    // Context injection state (best-effort from env / static signals)
    const econLoaded = Boolean(process.env.ECON_CALENDAR_ENABLED !== "false");
    const commentaryLoaded = Boolean(
      process.env.COMMENTARY_WATCH_ENABLED !== "false",
    );

    return c.json({
      timestamp: new Date().toISOString(),
      api_status: {
        deepseek_reachable: deepseekReachable,
        deepseek_api_key_set: deepseekKeySet,
        last_latency_ms: lastLatencyMs,
        last_error: lastError,
      },
      context_injection: {
        econ_context_loaded: econLoaded,
        econ_prints_count: 0,
        commentary_loaded: commentaryLoaded,
        commentary_entries_count: 0,
        iv_simulation_present: Boolean(latest?.iv_simulation),
        riskflow_feed_injected: false,
      },
      last_confidence: lastConfidence,
      chamber_state: latest ? "complete" : "idle",
    });
  });

  // ── seat overrides (separate sub-router for method-specific auth) ──
  const overridesRouter = new Hono();
  overridesRouter.get("/", async (c) => {
    try {
      const overrides = await getSeatOverrides();
      return c.json({ overrides });
    } catch (err) {
      log.error("Failed to load seat overrides", {
        error: err instanceof Error ? err.message : String(err),
      });
      return c.json({ error: "failed to load overrides" }, 500);
    }
  });
  overridesRouter.put("/", requireAuth, requireSuperadmin, async (c) => {
    let body: Record<string, unknown>;
    try {
      body = (await c.req.json()) as Record<string, unknown>;
    } catch {
      return c.json({ error: "invalid JSON body" }, 400);
    }
    const overrides = body.overrides as Array<{
      seat_id: string;
      override_prompt?: string;
      context_sources?: string[];
      category_filter?: string;
    }> | null;
    if (!Array.isArray(overrides)) {
      return c.json({ error: "overrides array required" }, 400);
    }
    try {
      const result = await saveSeatOverrides(overrides);
      return c.json({ ok: true, updated: result.updated });
    } catch (err) {
      log.error("Failed to save seat overrides", {
        error: err instanceof Error ? err.message : String(err),
      });
      return c.json({ error: "failed to save overrides" }, 500);
    }
  });
  app.route("/seats/overrides", overridesRouter);

  app.get("/latest", async (c) => {
    const rawTrigger = c.req.query("trigger");
    if (rawTrigger && VALID_TRIGGERS.has(rawTrigger as ArbitrumTriggerType)) {
      const v = await getLatestByTrigger(rawTrigger as ArbitrumTriggerType);
      return c.json({ verdict: v });
    }
    const v = await getLatest();
    return c.json({ verdict: v });
  });

  app.get("/:id", async (c) => {
    const id = c.req.param("id");
    if (!id) return c.json({ error: "id required" }, 400);
    const v = await getVerdict(id);
    if (!v) return c.json({ error: "not found" }, 404);
    return c.json({ verdict: v });
  });

  app.post("/deliberate", async (c) => {
    let body: Record<string, unknown>;
    try {
      body = (await c.req.json()) as Record<string, unknown>;
    } catch {
      return c.json({ error: "invalid JSON body" }, 400);
    }

    const question = typeof body.question === "string" ? body.question : "";
    const category =
      typeof body.category === "string" ? body.category : "custom";
    const context = typeof body.context === "string" ? body.context : undefined;
    const rounds = typeof body.rounds === "number" ? body.rounds : undefined;

    if (question.trim().length === 0) {
      return c.json({ error: "question is required" }, 400);
    }

    try {
      const result = await runChamber(
        { question, category, context },
        "manual",
        { rounds },
      );
      return c.json({
        verdict_id: result.verdict.verdict_id,
        persisted: result.persisted,
        consensus_probability: result.verdict.consensus_probability,
        confidence: result.verdict.confidence,
        dissent: result.verdict.dissent,
        digest_text: result.verdict.digest_text,
      });
    } catch (err) {
      log.error("runChamber failed on /deliberate", {
        error: err instanceof Error ? err.message : String(err),
      });
      return c.json({ error: "chamber invocation failed" }, 500);
    }
  });

  // ── revision-check: light check if new material warrants refresh ──
  app.post("/revision-check", async (c) => {
    try {
      const { getSupabaseClient } = await import("../../config/supabase.js");
      const sb = getSupabaseClient();
      if (!sb) return c.json({ error: "DB unavailable" }, 503);

      // Get latest brief timestamp
      const { data: latestBrief } = await sb
        .from("briefs")
        .select("generated_at")
        .order("generated_at", { ascending: false })
        .limit(1);
      const sinceIso =
        latestBrief?.[0]?.generated_at ??
        new Date(Date.now() - 6 * 3_600_000).toISOString();

      // Check for high-scored RiskFlow items since last brief
      const { data: recentItems, error: itemsErr } = await sb
        .from("scored_riskflow_items")
        .select("id, headline, iv_score, published_at")
        .gte("published_at", sinceIso)
        .gte("iv_score", 7)
        .order("iv_score", { ascending: false })
        .limit(10);

      if (itemsErr) {
        log.warn("revision-check item fetch failed", {
          error: itemsErr.message,
        });
        return c.json({
          hasChanges: false,
          statusMessage: "Unable to scan recent items.",
        });
      }

      const notable = (recentItems ?? []).filter((item: any) => {
        const score = Number(item.iv_score);
        const minsAgo =
          (Date.now() - new Date(item.published_at).getTime()) / 60_000;
        return score >= 8 || (score >= 7 && minsAgo < 60);
      });

      if (notable.length === 0) {
        return c.json({
          hasChanges: false,
          statusMessage: "There is nothing new to report at this time.",
          scanned: (recentItems ?? []).length,
          since: sinceIso,
        });
      }

      // Notable items found — trigger a quick 1-round deliberation
      const headlines = notable
        .map((n: any) => n.headline)
        .filter(Boolean)
        .slice(0, 5)
        .join(" | ");
      const result = await runChamber(
        {
          question:
            "Review these recent developments — does anything warrant revising the active desk plan or briefing?",
          category: "revision-check",
          context: `Recent high-impact items: ${headlines}`,
        },
        "manual",
        { rounds: 1 },
      );

      // Regenerate the desk plan if chamber suggests revision
      let planUpdated = false;
      const digest = result.verdict.digest_text?.toLowerCase() ?? "";
      if (
        digest.includes("revise") ||
        digest.includes("revision") ||
        digest.includes("update") ||
        digest.includes("change")
      ) {
        try {
          const { regenerateDayPlan } =
            await import("../../services/day-plan/day-plan-service.js");
          await regenerateDayPlan({ overrideReason: "chamber-revision" });
          planUpdated = true;
        } catch (planErr) {
          log.warn("Desk plan regeneration failed during revision check", {
            error: String(planErr),
          });
        }
      }

      const latest = await getLatest();

      return c.json({
        hasChanges: true,
        statusMessage: `${notable.length} notable item(s) found. Chamber has deliberated.${planUpdated ? " Desk plan updated." : ""}`,
        scanned: (recentItems ?? []).length,
        notable: notable.length,
        since: sinceIso,
        verdict: latest ?? null,
        planUpdated,
      });
    } catch (err) {
      log.error("revision-check failed", { error: String(err) });
      return c.json({ error: "revision check failed" }, 500);
    }
  });

  return app;
}
