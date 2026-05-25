import { Hono, type Context } from "hono";
import { z } from "zod";
import { addWorkEvent } from "../../services/narrative-sessions/history-store.js";
import { classifyNarrativeSession } from "../../services/narrative-classification/tag-classifier.js";
import { buildSituationMap } from "../../services/narrative-classification/situation-map.js";

const workEventSchema = z.object({
  agentName: z.string().trim().min(1).max(80).default("NarrativeFlow"),
  eventType: z.string().trim().min(1).max(80),
  summary: z.string().trim().min(1).max(480),
  payload: z.record(z.string(), z.unknown()).default({}),
});

export function createNarrativeClassificationRoutes(): Hono {
  const app = new Hono();
  app.post("/session/:sessionId", handleClassifySession);
  app.get("/situation-map", handleSituationMap);
  app.post("/session/:sessionId/work-event", handleAddWorkEvent);
  return app;
}

async function handleClassifySession(c: Context): Promise<Response> {
  try {
    const decisions = await classifyNarrativeSession({
      sessionId: c.req.param("sessionId"),
      actorId: getActorId(c),
    });
    return c.json({ decisions, generatedAt: new Date().toISOString() });
  } catch (err) {
    return handleError(c, err, "Classification failed");
  }
}

async function handleSituationMap(c: Context): Promise<Response> {
  try {
    const map = await buildSituationMap({
      deskId: c.req.query("deskId") ?? null,
      actorId: getActorId(c),
    });
    return c.json(map);
  } catch (err) {
    return handleError(c, err, "Situation map failed");
  }
}

async function handleAddWorkEvent(c: Context): Promise<Response> {
  const parsed = workEventSchema.safeParse(await readJson(c));
  if (!parsed.success) {
    return c.json(
      { error: "validation failed", issues: parsed.error.issues },
      400,
    );
  }

  try {
    await addWorkEvent({
      sessionId: c.req.param("sessionId"),
      ...parsed.data,
    });
    return c.json({ ok: true }, 201);
  } catch (err) {
    return handleError(c, err, "Work event save failed");
  }
}

async function readJson(c: Context): Promise<unknown> {
  return c.req.json().catch(() => ({}));
}

function getActorId(c: Context): string | null {
  const userId = c.get("userId") as string | undefined;
  if (!userId || userId === "anon" || userId === "anonymous") return null;
  return userId;
}

function handleError(c: Context, err: unknown, fallback: string): Response {
  const message = err instanceof Error ? err.message : fallback;
  const status = message.includes("not configured") ? 503 : 500;
  console.error("[NarrativeClassification]", message);
  return c.json({ error: message }, status);
}
