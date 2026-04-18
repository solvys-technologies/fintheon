// [claude-code 2026-04-19] S24-T3: /api/scoring/* — shadow stats + V4 utilities
import { Hono } from "hono";
import type { Context } from "hono";
import {
  getShadowStats,
  logShadowDecision,
  resolveShadowDecision,
  type ShadowDecisionType,
  SHADOW_DECISION_TYPES,
} from "../../services/scoring/shadow-mode.js";
import {
  isRescoreInProgress,
  getLastRescoreStats,
} from "../../services/scoring/rescore-all.js";

function isShadowType(value: unknown): value is ShadowDecisionType {
  return (
    typeof value === "string" &&
    (SHADOW_DECISION_TYPES as readonly string[]).includes(value)
  );
}

export function createScoringRoutes(): Hono {
  const router = new Hono();

  // GET /api/scoring/shadow-stats — agreement rate per decision type, 30d rolling
  router.get("/shadow-stats", async (c: Context) => {
    const userId = c.get("userId") as string | undefined;
    if (!userId) return c.json({ error: "Unauthorized" }, 401);
    const stats = await getShadowStats();
    return c.json({ stats, windowDays: 30 });
  });

  // POST /api/scoring/shadow-decisions — log a shadow decision (internal agent use)
  router.post("/shadow-decisions", async (c: Context) => {
    const userId = c.get("userId") as string | undefined;
    if (!userId) return c.json({ error: "Unauthorized" }, 401);

    const body = await c.req.json().catch(() => null);
    if (
      !body ||
      !isShadowType(body.decisionType) ||
      typeof body.wouldPropose !== "object" ||
      body.wouldPropose === null
    ) {
      return c.json(
        { error: "decisionType and wouldPropose object are required" },
        400,
      );
    }
    const id = await logShadowDecision(
      body.decisionType,
      body.wouldPropose as Record<string, unknown>,
    );
    return c.json({ id });
  });

  // POST /api/scoring/shadow-decisions/resolve — match unresolved shadow proposals
  router.post("/shadow-decisions/resolve", async (c: Context) => {
    const userId = c.get("userId") as string | undefined;
    if (!userId) return c.json({ error: "Unauthorized" }, 401);

    const body = await c.req.json().catch(() => null);
    if (
      !body ||
      !isShadowType(body.decisionType) ||
      typeof body.actualDecision !== "object" ||
      body.actualDecision === null
    ) {
      return c.json(
        { error: "decisionType and actualDecision object are required" },
        400,
      );
    }
    const result = await resolveShadowDecision(
      body.decisionType,
      body.actualDecision as Record<string, unknown>,
      userId,
    );
    return c.json(result);
  });

  // GET /api/scoring/rescore-status — current rescore-all run state
  router.get("/rescore-status", async (c: Context) => {
    const userId = c.get("userId") as string | undefined;
    if (!userId) return c.json({ error: "Unauthorized" }, 401);
    return c.json({
      inProgress: isRescoreInProgress(),
      last: getLastRescoreStats(),
    });
  });

  return router;
}
