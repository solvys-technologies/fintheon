import { Hono } from "hono";
import { z } from "zod";
import { identifyMemoworthyDrift } from "../../services/agentic-memos/drift-detector.js";
import { composeMemo } from "../../services/agentic-memos/memo-composer.js";

const querySchema = z.object({
  deskId: z.string().trim().max(120).optional(),
});

export function createAgenticMemosRoutes(): Hono {
  const app = new Hono();

  app.post("/run", async (c) => {
    const parsed = querySchema.safeParse({
      deskId: c.req.query("deskId") || undefined,
    });
    if (!parsed.success)
      return c.json({ ok: false, error: "Invalid query" }, 400);
    const deskId = parsed.data.deskId ?? "priced-in-capital";

    const { events, explained, inspectedCount } =
      await identifyMemoworthyDrift(deskId);
    const drafts = [];
    const skipped: string[] = [];

    for (const event of events) {
      const draft = await composeMemo(event, deskId);
      if (draft) {
        drafts.push(draft);
      } else {
        skipped.push(event.title);
      }
    }

    return c.json({
      ok: true,
      created: drafts.length,
      skipped: skipped.length,
      inspected: inspectedCount,
      proposed: explained.filter((e) => e.proposed).length,
      drafts,
    });
  });

  app.get("/explain", async (c) => {
    const parsed = querySchema.safeParse({
      deskId: c.req.query("deskId") || undefined,
    });
    if (!parsed.success)
      return c.json({ ok: false, error: "Invalid query" }, 400);
    const deskId = parsed.data.deskId ?? "priced-in-capital";

    const { explained, inspectedCount } =
      await identifyMemoworthyDrift(deskId);
    return c.json({ ok: true, inspected: inspectedCount, explained });
  });

  return app;
}
