// [codex 2026-05-23] Weekly desk-plan approval from TradingView calendar queue.
import type { Context } from "hono";
import { z } from "zod";
import { getSupabaseClient } from "../../config/supabase.js";
import {
  addCustomDeskPlanEvent,
  type CustomDeskPlanInput,
} from "../../services/day-plan/custom-desk-plan.js";

const TABLE = "desk_calendar_events";

const approveInput = z.object({
  eventIds: z.array(z.string().uuid()).max(80).optional(),
});

interface QueueRow {
  id: string;
  starts_at: string;
  ends_at: string | null;
  title: string;
  description: string | null;
  source_url: string | null;
  severity: number | null;
}

export async function handleApproveWeek(c: Context): Promise<Response> {
  const parsed = approveInput.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) {
    return c.json({ ok: false, error: "invalid_payload" }, 400);
  }
  const supabase = getSupabaseClient();
  if (!supabase) return c.json({ ok: false, error: "supabase_unavailable" }, 503);

  let q = supabase
    .from(TABLE)
    .select("id, starts_at, ends_at, title, description, source_url, severity")
    .gte("starts_at", new Date().toISOString())
    .order("starts_at", { ascending: true })
    .limit(80);
  if (parsed.data.eventIds?.length) q = q.in("id", parsed.data.eventIds);

  const { data, error } = await q;
  if (error) return c.json({ ok: false, error: error.message }, 500);

  const rows = (data ?? []) as QueueRow[];
  const results = await Promise.allSettled(
    rows.map((row) => addCustomDeskPlanEvent(rowToDeskPlan(row))),
  );
  const failed = results
    .map((result, index) =>
      result.status === "rejected"
        ? { id: rows[index]?.id, error: String(result.reason) }
        : null,
    )
    .filter(Boolean);

  return c.json({
    ok: failed.length === 0,
    approved: results.length - failed.length,
    failed,
  });
}

function rowToDeskPlan(row: QueueRow): CustomDeskPlanInput {
  const start = new Date(row.starts_at);
  const end = row.ends_at
    ? new Date(row.ends_at)
    : new Date(start.getTime() + 90 * 60_000);
  const country = inferCountry(row.title, row.description);
  return {
    date: formatInNewYork(start, "date"),
    eventName: cleanTitle(resolveTitle(row.title, row.description)),
    country,
    currency: currencyForCountry(country),
    category: inferCategory(row.title, row.description),
    impact: severityToImpact(row.severity),
    time: formatInNewYork(start, "time"),
    startTime: formatInNewYork(new Date(start.getTime() - 45 * 60_000), "time"),
    endTime: formatInNewYork(end, "time"),
    forecast: extractField(row.description, "forecast"),
    previous:
      extractField(row.description, "previous") ??
      extractField(row.description, "prior"),
    detail: row.description ?? row.source_url ?? undefined,
  };
}

function resolveTitle(title: string, description: string | null): string {
  const cleaned = cleanTitle(title);
  if (cleaned && !/^(US|USA|NZ|AU|JP|GB|UK|EU|CA|CN|CH)$/i.test(cleaned)) {
    return cleaned;
  }
  return (
    (description ?? "")
      .split(/\r?\n/)
      .map(cleanTitle)
      .find((line) => line && !/^(country|symbol)\s*:/i.test(line)) ??
    cleaned ??
    title
  );
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
  return kind === "date"
    ? `${get("year")}-${get("month")}-${get("day")}`
    : `${get("hour")}:${get("minute")}`;
}

function cleanTitle(value: string): string {
  return value.replace(/\s*\|\s*TradingView.*$/i, "").trim();
}

function extractField(text: string | null, label: string): string | undefined {
  const match = (text ?? "").match(new RegExp(`${label}\\s*:?\\s*([^\\n\\r]+)`, "i"));
  return match?.[1]?.trim().slice(0, 80) || undefined;
}

function inferCountry(title: string, description: string | null): string {
  const text = `${title} ${description ?? ""}`.toUpperCase();
  if (/\b(JAPAN|JPY|BOJ)\b/.test(text)) return "JP";
  if (/\b(UK|GBP|BOE|BRITAIN)\b/.test(text)) return "UK";
  if (/\b(EU|EUR|ECB|GERMANY|FRANCE)\b/.test(text)) return "EU";
  if (/\b(CANADA|CAD|BOC)\b/.test(text)) return "CA";
  if (/\b(AUSTRALIA|AUD|RBA)\b/.test(text)) return "AU";
  if (/\b(NEW ZEALAND|NZD|RBNZ)\b/.test(text)) return "NZ";
  if (/\b(CHINA|CNY|PBOC)\b/.test(text)) return "CN";
  return "US";
}

function currencyForCountry(country: string): string {
  return (
    {
      US: "USD",
      JP: "JPY",
      UK: "GBP",
      EU: "EUR",
      CA: "CAD",
      AU: "AUD",
      NZ: "NZD",
      CN: "CNY",
    } as Record<string, string>
  )[country] ?? "USD";
}

function inferCategory(title: string, description: string | null): string {
  const text = `${title} ${description ?? ""}`.toLowerCase();
  if (/\b(speech|speaks|testimony|press conference)\b/.test(text)) return "Speech";
  if (/\b(cpi|inflation|ppi|pce)\b/.test(text)) return "Inflation";
  if (/\b(payroll|employment|jobless|unemployment|nfp)\b/.test(text)) return "Employment";
  if (/\b(pmi|ism|retail|gdp)\b/.test(text)) return "Growth";
  return "Economic";
}

function severityToImpact(severity: number | null): "low" | "medium" | "high" {
  if ((severity ?? 0) >= 3) return "high";
  if ((severity ?? 0) >= 2) return "medium";
  return "low";
}
