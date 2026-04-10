// [claude-code 2026-03-11] Track 7A: Journal route handlers — human psych + agent performance
import type { Context } from "hono";
import {
  listJournalEntries,
  saveJournalEntry,
  getJournalSummary,
  type CreateJournalEntryInput,
} from "../../services/journal-service.js";

function getUserId(c: Context): string {
  const userId = c.get("userId") as string | undefined;
  return userId ?? "local-user";
}

export async function handleListEntries(c: Context) {
  const userId = getUserId(c);
  // userId always has a fallback, no auth check needed

  const type = c.req.query("type") as "human" | "agent" | undefined;
  const limit = c.req.query("limit");
  const offset = c.req.query("offset");
  const from = c.req.query("from");
  const to = c.req.query("to");

  try {
    const result = await listJournalEntries(userId, {
      type: type === "human" || type === "agent" ? type : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
      from: from || undefined,
      to: to || undefined,
    });
    return c.json(result);
  } catch (error) {
    console.error("[Journal] Failed to list entries:", error);
    const message =
      error instanceof Error ? error.message : "Failed to list journal entries";
    return c.json({ error: message }, 500);
  }
}

export async function handleSaveEntry(c: Context) {
  const userId = getUserId(c);
  // userId always has a fallback, no auth check needed

  const body = await c.req.json<CreateJournalEntryInput>().catch(() => null);
  if (!body || !body.type || !body.date) {
    return c.json({ error: "type and date are required" }, 400);
  }

  if (body.type !== "human" && body.type !== "agent") {
    return c.json({ error: 'type must be "human" or "agent"' }, 400);
  }

  try {
    const result = await saveJournalEntry(userId, body);
    return c.json(result);
  } catch (error) {
    console.error("[Journal] Failed to save entry:", error);
    const message =
      error instanceof Error ? error.message : "Failed to save journal entry";
    return c.json({ error: message }, 500);
  }
}

export async function handleGetSummary(c: Context) {
  const userId = getUserId(c);
  // userId always has a fallback, no auth check needed

  const daysRaw = c.req.query("days");
  const days = daysRaw ? parseInt(daysRaw, 10) : undefined;

  try {
    const summary = await getJournalSummary(userId, {
      days: Number.isFinite(days) ? days : undefined,
    });
    return c.json(summary);
  } catch (error) {
    console.error("[Journal] Failed to get summary:", error);
    const message =
      error instanceof Error ? error.message : "Failed to get journal summary";
    return c.json({ error: message }, 500);
  }
}
