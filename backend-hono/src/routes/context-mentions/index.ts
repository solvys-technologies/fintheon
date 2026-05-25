// [codex 2026-05-23] Searchable safe context mentions for chat inputs.
import { Hono } from "hono";
import { z } from "zod";
import {
  listMentions,
  type MentionType,
} from "../../services/context-mentions/mention-sources.js";

const mentionTypes = [
  "document",
  "skill",
  "connector",
  "narrative",
  "theme",
  "riskflow",
  "instrument",
  "vault",
  "memo",
  "chart",
  "agent",
  "all",
] as const;

const querySchema = z.object({
  q: z.string().trim().max(80).optional(),
  type: z.enum(mentionTypes).optional(),
  deskId: z.string().trim().max(120).optional(),
  limit: z.coerce.number().int().min(1).max(80).default(30),
});

export function createContextMentionRoutes(): Hono {
  const app = new Hono();

  app.get("/mentions", async (c) => {
    const parsed = querySchema.safeParse({
      q: c.req.query("q") || undefined,
      type: c.req.query("type") || "all",
      deskId: c.req.query("deskId") || undefined,
      limit: c.req.query("limit") || undefined,
    });

    if (!parsed.success) {
      return c.json(
        {
          ok: false,
          error: "Invalid mention query",
          details: parsed.error.flatten(),
        },
        400,
      );
    }

    const mentions = await listMentions({
      q: parsed.data.q,
      type: parsed.data.type as MentionType | "all",
      deskId: parsed.data.deskId,
      limit: parsed.data.limit,
    });

    return c.json({ mentions, count: mentions.length });
  });

  return app;
}
