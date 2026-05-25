// [claude-code 2026-04-28] S47-T2: Desk Calendar handlers. Ingests TV .ics
// downloads intercepted by Electron and surfaces the queue for Desk Theme agents.
// Added statusMessage, latest_error diagnostics, and user-scoped RLS insert policy.

import type { Context } from "hono";
import { getSupabaseClient } from "../../config/supabase.js";
import { createLogger } from "../../lib/logger.js";
import { addCustomDeskPlanEvent } from "../../services/day-plan/custom-desk-plan.js";
import { parseIcsEvents, inferSeverity } from "./ics-parser.js";

const log = createLogger("DeskCalendar");
const TABLE = "desk_calendar_events";

let lastIngestError: string | null = null;

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
    lastIngestError = error.message;
    log.warn("upsert_failed", { err: error.message });
    return c.json(
      {
        error: "persist_failed",
        detail: error.message,
        statusMessage: "Failed to save events",
      },
      500,
    );
  }
  lastIngestError = null;
  const deskPlanResults = await Promise.allSettled(
    events.map((evt) => addCustomDeskPlanEvent(icsEventToDeskPlan(evt))),
  );
  const deskPlanFailures = deskPlanResults.filter(
    (result) => result.status === "rejected",
  );
  if (deskPlanFailures.length > 0) {
    lastIngestError = `${deskPlanFailures.length} desk-plan conversion failed`;
    log.warn("desk_plan_conversion_failed", {
      failures: deskPlanFailures.length,
    });
  }
  const queueCount = await readUpcomingQueueCount(supabase);
  const statusMessage =
    (data?.length ?? 0) > 0
      ? `Saved ${data!.length} event${data!.length === 1 ? "" : "s"} to Desk Plan`
      : "No new events to save";
  return c.json({
    ingested: data?.length ?? 0,
    events: data ?? [],
    queueCount,
    deskPlanWindows: deskPlanResults.length - deskPlanFailures.length,
    statusMessage,
  });
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
    return c.json({ count: 0, last_ingest_at: null, latest_error: null });
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
    latest_error: lastIngestError,
  });
}

export function getDeskCalendarDiagnostics(): {
  last_ingest_error: string | null;
} {
  return { last_ingest_error: lastIngestError };
}

async function readUpcomingQueueCount(
  supabase: NonNullable<ReturnType<typeof getSupabaseClient>>,
): Promise<number> {
  const now = new Date().toISOString();
  const horizon = new Date(Date.now() + 14 * 86_400_000).toISOString();
  const { count } = await supabase
    .from(TABLE)
    .select("id", { count: "exact", head: true })
    .gte("starts_at", now)
    .lt("starts_at", horizon);
  return count ?? 0;
}

function icsEventToDeskPlan(evt: ReturnType<typeof parseIcsEvents>[number]) {
  const start = new Date(evt.startsAt);
  const end = evt.endsAt
    ? new Date(evt.endsAt)
    : new Date(start.getTime() + 90 * 60_000);
  const country = inferCountry(evt.title, evt.description);
  return {
    date: formatInNewYork(start, "date"),
    eventName: cleanEventTitle(resolveDeskEventTitle(evt.title, evt.description)),
    country,
    currency: currencyForCountry(country),
    category: inferCategory(evt.title, evt.description),
    impact: severityToImpact(inferSeverity(evt.title, evt.description)),
    time: formatInNewYork(start, "time"),
    startTime: formatInNewYork(new Date(start.getTime() - 45 * 60_000), "time"),
    endTime: formatInNewYork(end, "time"),
    forecast: extractField(evt.description, "forecast"),
    previous:
      extractField(evt.description, "previous") ??
      extractField(evt.description, "prior"),
    detail: evt.description ?? evt.url ?? undefined,
  };
}

function resolveDeskEventTitle(title: string, description: string | null): string {
  const cleaned = cleanEventTitle(title);
  if (cleaned && !isCountryOnly(cleaned)) return cleaned;
  const lines = (description ?? "")
    .split(/\r?\n/)
    .map((line) => cleanEventTitle(line))
    .filter(Boolean);
  return (
    lines.find((line) => !isCountryOnly(line) && !isMetadataLine(line)) ??
    cleaned ??
    title
  );
}

function isCountryOnly(value: string): boolean {
  return /^(US|USA|NZ|AU|JP|GB|UK|EU|CA|CN|CH)$/i.test(value.trim());
}

function isMetadataLine(value: string): boolean {
  return /^(country|symbol)\s*:/i.test(value.trim());
}

function formatInNewYork(date: Date, kind: "date" | "time"): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "00";
  if (kind === "date") return `${get("year")}-${get("month")}-${get("day")}`;
  return `${get("hour")}:${get("minute")}`;
}

function cleanEventTitle(title: string): string {
  return title
    .replace(/^\s*([A-Z]{2,3}|USA|United States)\s*[-:]\s*/i, "")
    .trim();
}

function inferCountry(title: string, description: string | null): string {
  const blob = `${title} ${description ?? ""}`.toUpperCase();
  const direct = blob.match(/\b(USA|US|NZ|AU|JP|GB|UK|CA|EU|CN|CH)\b/);
  if (direct?.[1] === "USA") return "US";
  if (direct?.[1] === "UK") return "GB";
  return direct?.[1] ?? "US";
}

function currencyForCountry(country: string): string {
  const map: Record<string, string> = {
    US: "USD",
    NZ: "NZD",
    AU: "AUD",
    JP: "JPY",
    GB: "GBP",
    CA: "CAD",
    EU: "EUR",
    CN: "CNY",
    CH: "CHF",
  };
  return map[country] ?? country;
}

function inferCategory(title: string, description: string | null): string {
  const blob = `${title} ${description ?? ""}`.toLowerCase();
  if (
    /\b(speech|speaks?|remarks|testimony|statement|press conference)\b/.test(
      blob,
    )
  )
    return "Speaker";
  return "Economic";
}

function severityToImpact(severity: number | null): "low" | "medium" | "high" {
  if (severity == null || severity <= 1) return "low";
  if (severity === 2) return "medium";
  return "high";
}

function extractField(
  description: string | null,
  label: string,
): string | undefined {
  if (!description) return undefined;
  const match = description.match(
    new RegExp(`${label}\\s*[:：]\\s*([^\\n|]+)`, "i"),
  );
  return match?.[1]?.trim() || undefined;
}
