import type { Context } from "hono";
import { z } from "zod";
import {
  assignCatalystsToBankAndSession,
  searchCatalystBank,
} from "../../services/narrative-sessions/catalyst-bank.js";

const assignSchema = z.object({
  catalystIds: z.array(z.string().trim().min(1)).min(1).max(48),
  role: z.string().trim().min(1).max(40).default("supporting"),
  tags: z.array(z.string().trim().min(1).max(80)).max(24).default([]),
  deskFit: z.string().trim().max(240).nullable().optional(),
  notes: z.string().trim().max(1200).nullable().optional(),
});

export async function handleSearchCatalystBank(c: Context): Promise<Response> {
  const minIv = parseNumber(c.req.query("minIv"));
  const days = parseNumber(c.req.query("days"));
  const limit = parseNumber(c.req.query("limit"));

  try {
    const catalysts = await searchCatalystBank({
      q: c.req.query("q") ?? null,
      deskId: c.req.query("deskId") ?? null,
      sessionId: c.req.query("sessionId") ?? null,
      tag: c.req.query("tag") ?? null,
      minIv,
      days,
      limit,
      actorId: getActorId(c),
    });
    return c.json({ catalysts });
  } catch (err) {
    return handleCatalystBankError(c, err);
  }
}

export async function handleAssignCatalystBank(c: Context): Promise<Response> {
  const parsed = assignSchema.safeParse(await readJson(c));
  if (!parsed.success) {
    return c.json({ error: "validation failed", issues: parsed.error.issues }, 400);
  }

  try {
    const result = await assignCatalystsToBankAndSession({
      sessionId: c.req.param("id"),
      ...parsed.data,
      actorId: getActorId(c),
    });
    return c.json(result);
  } catch (err) {
    return handleCatalystBankError(c, err);
  }
}

async function readJson(c: Context): Promise<unknown> {
  return c.req.json().catch(() => ({}));
}

function parseNumber(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getActorId(c: Context): string | null {
  const userId = c.get("userId") as string | undefined;
  if (!userId || userId === "anon" || userId === "anonymous") return null;
  return userId;
}

function handleCatalystBankError(c: Context, err: unknown): Response {
  const message = err instanceof Error ? err.message : "Catalyst bank failed";
  const status = message.includes("not configured") ? 503 : 500;
  console.error("[CatalystBank]", message);
  return c.json({ error: message }, status);
}
