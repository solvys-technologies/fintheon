import type { Context } from "hono";
import { z } from "zod";
import { getNarrativeProjection } from "../../services/narrative-orchestra/projector.js";
import {
  applyReviewAction,
  type NarrativeReviewAction,
} from "../../services/narrative-orchestra/review-actions.js";

const reviewBodySchema = z.object({
  reason: z.string().trim().min(2).max(500).optional(),
  note: z.string().trim().max(1000).optional(),
});

export async function getNarrativeOrchestra(c: Context) {
  try {
    const projection = await getNarrativeProjection();
    return c.json(projection);
  } catch (err) {
    console.error("[NarrativeOrchestra] Projection failed", err);
    return c.json(
      {
        hypotheses: [],
        generatedAt: new Date().toISOString(),
        source: "fallback",
        fallbackReason:
          "Projection failed before fallback data could be assembled.",
      },
      500,
    );
  }
}

export async function acceptNarrativeHypothesis(c: Context) {
  return reviewHypothesis(c, "accept");
}

export async function researchNarrativeHypothesis(c: Context) {
  return reviewHypothesis(c, "research");
}

export async function rejectNarrativeHypothesis(c: Context) {
  return reviewHypothesis(c, "reject");
}

export async function pinNarrativeHypothesis(c: Context) {
  return reviewHypothesis(c, "pin");
}

export async function createNarrativeResearchTask(c: Context) {
  return reviewHypothesis(c, "task");
}

async function reviewHypothesis(c: Context, action: NarrativeReviewAction) {
  const hypothesisId = c.req.param("hypothesisId");
  const actorId = getActorId(c);
  const body = await readReviewBody(c);
  if (!body.success) return c.json(body.error, 400);

  const projection = await getNarrativeProjection();
  const hypothesis = projection.hypotheses.find(
    (item) => item.id === hypothesisId,
  );
  if (!hypothesis) return c.json({ error: "Hypothesis not found" }, 404);

  if (action === "reject" && !body.data.reason) {
    return c.json({ error: "reason is required for rejection" }, 400);
  }

  const result = await applyReviewAction({
    action,
    hypothesis,
    reason: body.data.reason ?? defaultReason(action),
    note: body.data.note ?? null,
    actorId,
  });
  const updatedProjection = await getNarrativeProjection();
  const selectedHypothesis =
    updatedProjection.hypotheses.find((item) => item.id === hypothesisId) ??
    hypothesis;

  return c.json({
    ok: true,
    review: result.review,
    task: result.task,
    selectedHypothesis,
    projection: updatedProjection,
  });
}

async function readReviewBody(c: Context) {
  try {
    const raw = await c.req.json().catch(() => ({}));
    const parsed = reviewBodySchema.safeParse(raw);
    if (!parsed.success) {
      return {
        success: false as const,
        error: { error: "validation failed", issues: parsed.error.issues },
      };
    }
    return { success: true as const, data: parsed.data };
  } catch {
    return { success: false as const, error: { error: "invalid JSON body" } };
  }
}

function getActorId(c: Context): string {
  const userId = c.get("userId") as string | undefined;
  return userId && userId !== "anon" ? userId : "human";
}

function defaultReason(action: NarrativeReviewAction): string {
  if (action === "accept") return "Accepted by human review.";
  if (action === "research") return "Needs more research before promotion.";
  if (action === "pin") return "Pinned to Sanctum by human review.";
  return "Research task created from human review.";
}
