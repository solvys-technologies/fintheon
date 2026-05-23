import { Hono } from "hono";
import { z } from "zod";
import {
  resolveNarrativeDesk,
  updateNarrativeDeskMap,
} from "../../services/narrative-sessions/default-desk.js";

const updateDeskMapSchema = z.object({
  deskId: z.string().trim().min(1).optional(),
  mapImageUrl: z.string().trim().max(8_000_000).nullable().optional(),
  mapImagePrompt: z.string().trim().max(1200).nullable().optional(),
});

export function createDeskMapRoutes(): Hono {
  const app = new Hono();

  app.get("/", async (c) => {
    try {
      const desk = await resolveNarrativeDesk(c.req.query("deskId") ?? null, actorId(c));
      return c.json({ desk });
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : "DeskMap unavailable" }, 500);
    }
  });

  app.patch("/", async (c) => {
    const parsed = updateDeskMapSchema.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) return c.json({ error: "Invalid DeskMap payload", issues: parsed.error.issues }, 400);

    try {
      const desk = await updateNarrativeDeskMap({
        ...parsed.data,
        actorId: actorId(c),
      });
      return c.json({ desk });
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : "DeskMap update failed" }, 500);
    }
  });

  return app;
}

function actorId(c: { get: (key: string) => unknown }): string | null {
  const userId = c.get("userId");
  if (typeof userId !== "string" || userId === "anon" || userId === "anonymous") return null;
  return userId;
}
