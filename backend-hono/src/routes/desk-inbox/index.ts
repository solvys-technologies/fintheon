import { Hono, type Context } from "hono";
import { z } from "zod";
import {
  approveInboxItem,
  createMemoDraft,
  dismissInboxItem,
  listInboxItems,
  requestInboxChanges,
} from "../../services/desk-inbox/index.js";
import { runAgenticAnalysisBlock } from "../../services/agentic-analysis-block/index.js";

const querySchema = z.object({
  deskId: z.string().trim().max(120).optional(),
});

const memoDraftSchema = z.object({
  deskId: z.string().trim().max(120).optional(),
  title: z.string().trim().min(1).max(160),
  summary: z.string().trim().max(400).optional(),
  body: z.string().trim().min(1).max(6000),
  confidence: z.number().min(0).max(1).optional(),
  tickers: z.array(z.string().trim().max(16)).max(20).optional(),
  sourceRefs: z.array(z.string().trim().max(180)).max(30).optional(),
  catalystDriftSessions: z.number().min(0).max(10).optional(),
});

const decisionSchema = z.object({
  deskId: z.string().trim().max(120).optional(),
  note: z.string().trim().max(1000).optional(),
});

export function createDeskInboxRoutes(): Hono {
  const app = new Hono();

  app.get("/", async (c) => {
    const parsed = querySchema.safeParse({
      deskId: c.req.query("deskId") || undefined,
    });
    if (!parsed.success)
      return c.json({ ok: false, error: "Invalid inbox query" }, 400);
    const items = await listInboxItems(parsed.data.deskId);
    return c.json({ ok: true, items, count: items.length });
  });

  app.post("/memo-drafts", async (c) => {
    const parsed = memoDraftSchema.safeParse(
      await c.req.json().catch(() => ({})),
    );
    if (!parsed.success) {
      return c.json(
        {
          ok: false,
          error: "Invalid memo draft",
          details: parsed.error.flatten(),
        },
        400,
      );
    }
    const item = await createMemoDraft(parsed.data);
    return c.json({ ok: true, item }, 201);
  });

  app.post("/analysis-block/run", async (c) => {
    const parsed = querySchema.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success)
      return c.json({ ok: false, error: "Invalid analysis request" }, 400);
    const result = await runAgenticAnalysisBlock(parsed.data.deskId);
    return c.json({ ok: true, result });
  });

  app.post("/:id/approve", async (c) => {
    const decision = await parseDecision(c);
    const item = await approveInboxItem(
      { id: c.req.param("id"), note: decision.note },
      decision.deskId,
    );
    if (!item) return c.json({ ok: false, error: "Inbox item not found" }, 404);
    return c.json({ ok: true, item });
  });

  app.post("/:id/request-changes", async (c) => {
    const decision = await parseDecision(c);
    const item = await requestInboxChanges(
      { id: c.req.param("id"), note: decision.note },
      decision.deskId,
    );
    if (!item) return c.json({ ok: false, error: "Inbox item not found" }, 404);
    return c.json({ ok: true, item });
  });

  app.post("/:id/dismiss", async (c) => {
    const decision = await parseDecision(c);
    const item = await dismissInboxItem(
      { id: c.req.param("id"), note: decision.note },
      decision.deskId,
    );
    if (!item) return c.json({ ok: false, error: "Inbox item not found" }, 404);
    return c.json({ ok: true, item });
  });

  return app;
}

async function parseDecision(c: Context) {
  const parsed = decisionSchema.safeParse(await c.req.json().catch(() => ({})));
  if (parsed.success) return parsed.data;
  return {};
}
