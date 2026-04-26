// [claude-code 2026-04-26] S46: Desk Calendar handlers. Ingests TV .ics
// downloads intercepted by Electron and surfaces the queue for Desk Theme agents.

import type { Context } from "hono";
import { getSupabaseClient } from "../../config/supabase.js";
import { createLogger } from "../../lib/logger.js";
import { parseIcsEvents, inferSeverity } from "./ics-parser.js";

const log = createLogger("DeskCalendar");
const TABLE = "desk_calendar_events";

export async function handleIngestIcs(c: Context): Promise<Response> {
  const raw = await c.req.text();
  if (!raw || raw.length < 32) {
    return c.json({ error: "empty_ics" }, 400);
  }
  if (raw.length > 200_000) {
    return c.json({ error: "ics_too_large" }, 413);
  }
  let events;
  try {
    events = parseIcsEvents(raw);
  } catch (err) {
    log.warn("ics_parse_failed", { err: String(err) });
    return c.json({ error: "ics_parse_failed" }, 422);
  }
  if (events.length === 0) {
    return c.json({ ingested: 0, events: [] });
  }
  const supabase = getSupabaseClient();
  if (!supabase) {
    return c.json({ error: "supabase_unavailable" }, 503);
  }
  const ingestedBy =
    (c.get("userId") as string | undefined) === "anonymous"
      ? null
      : ((c.get("userId") as string | undefined) ?? null);
  const rows = events.map((evt) => ({
    ics_uid: evt.uid,
    starts_at: evt.startsAt,
    ends_at: evt.endsAt,
    title: evt.title,
    description: evt.description,
    source_url: evt.url,
    severity: inferSeverity(evt.title, evt.description),
    raw_ics: raw,
    ingested_by: ingestedBy,
  }));
  const { data, error } = await supabase
    .from(TABLE)
    .upsert(rows, { onConflict: "ics_uid" })
    .select("id, ics_uid, starts_at, title, severity");
  if (error) {
    log.warn("upsert_failed", { err: error.message });
    return c.json({ error: "persist_failed", detail: error.message }, 500);
  }
  return c.json({ ingested: data?.length ?? 0, events: data ?? [] });
}

export async function handleGetQueue(c: Context): Promise<Response> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return c.json({ events: [], status: { last_ingest_at: null, count: 0 } });
  }
  const date = c.req.query("date");
  const horizonDays = Math.max(
    1,
    Math.min(Number(c.req.query("days") ?? "1") || 1, 14),
  );
  let q = supabase
    .from(TABLE)
    .select(
      "id, ics_uid, starts_at, ends_at, title, description, source_url, severity, ingested_at",
    )
    .order("starts_at", { ascending: true });
  if (date) {
    const start = new Date(`${date}T00:00:00Z`).toISOString();
    const end = new Date(
      Date.parse(`${date}T00:00:00Z`) + horizonDays * 86_400_000,
    ).toISOString();
    q = q.gte("starts_at", start).lt("starts_at", end);
  } else {
    const now = new Date().toISOString();
    q = q.gte("starts_at", now);
  }
  const { data, error } = await q;
  if (error) {
    return c.json({ error: "read_failed", detail: error.message }, 500);
  }
  return c.json({ events: data ?? [] });
}

export async function handleGetStatus(c: Context): Promise<Response> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return c.json({ count: 0, last_ingest_at: null });
  }
  const now = new Date().toISOString();
  const horizon = new Date(Date.now() + 14 * 86_400_000).toISOString();
  const { count } = await supabase
    .from(TABLE)
    .select("id", { count: "exact", head: true })
    .gte("starts_at", now)
    .lt("starts_at", horizon);
  const { data: latest } = await supabase
    .from(TABLE)
    .select("ingested_at")
    .order("ingested_at", { ascending: false })
    .limit(1);
  return c.json({
    count: count ?? 0,
    last_ingest_at: latest?.[0]?.ingested_at ?? null,
  });
}
