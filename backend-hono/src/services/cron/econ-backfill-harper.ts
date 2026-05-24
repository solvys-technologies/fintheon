// [claude-code 2026-04-26] S35-cleanup: rerouted Harper normalize from raw
// OpenRouter (Anthropic Opus, key returns 401 on prod) to invokeAgent which
// flows through the DeepSeek/Hermes provider chain.
// [claude-code 2026-04-24] S34-T10: Harper batch categorization pass for backfilled econ events.

import { createHash } from "node:crypto";
import { createLogger } from "../../lib/logger.js";
import { getSupabaseClient } from "../../config/supabase.js";
import { invokeAgent } from "../strands/invoke-helper.js";
import type {
  NormalizedBackfillEvent,
  RawBackfillEvent,
  RawSlicePayload,
} from "../../types/econ-backfill.js";

const log = createLogger("EconBackfillHarper");

const WEEKLY_TOKEN_CAP = 500_000;

let tokensSpentThisWeek = 0;
let weekStartMs = Date.now();

function rolloverWeek(): void {
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  if (Date.now() - weekStartMs >= weekMs) {
    tokensSpentThisWeek = 0;
    weekStartMs = Date.now();
  }
}

export function getHarperTokensThisWeek(): number {
  rolloverWeek();
  return tokensSpentThisWeek;
}

function computeEventKey(e: {
  name: string;
  date: string;
  time: string | null;
  country: string;
}): string {
  const h = createHash("sha256");
  h.update(`${e.name}|${e.date}|${e.time ?? ""}|${e.country}`);
  return h.digest("hex");
}

function parseJsonArray(raw: string | null): unknown[] {
  if (!raw) return [];
  const stripped = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "");
  try {
    const parsed = JSON.parse(stripped);
    if (Array.isArray(parsed)) return parsed;
    if (parsed && typeof parsed === "object") {
      const inner = (parsed as { events?: unknown }).events;
      if (Array.isArray(inner)) return inner;
    }
    return [];
  } catch {
    return [];
  }
}

function coerceNormalized(raw: unknown): NormalizedBackfillEvent | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const name = typeof r.name === "string" ? r.name : null;
  const date = typeof r.date === "string" ? r.date : null;
  const country = typeof r.country === "string" ? r.country : null;
  const category = typeof r.category === "string" ? r.category : null;
  if (!name || !date || !country || !category) return null;
  if (
    category !== "Fiscal" &&
    category !== "Supply Chain" &&
    category !== "Inflation" &&
    category !== "Job Market" &&
    category !== "Speaker"
  ) {
    return null;
  }

  const impactRaw =
    typeof r.impact === "string" ? r.impact.toLowerCase() : null;
  const impact =
    impactRaw === "low" || impactRaw === "medium" || impactRaw === "high"
      ? (impactRaw as "low" | "medium" | "high")
      : null;

  const time = typeof r.time === "string" ? r.time : null;
  const event_key =
    typeof r.event_key === "string" && r.event_key.length >= 32
      ? r.event_key
      : computeEventKey({ name, date, time, country });

  return {
    country,
    category,
    name,
    date,
    time,
    forecast: typeof r.forecast === "string" ? r.forecast : null,
    actual: typeof r.actual === "string" ? r.actual : null,
    previous: typeof r.previous === "string" ? r.previous : null,
    detail: typeof r.detail === "string" ? r.detail : null,
    impact,
    event_key,
  };
}

function buildPrompt(
  country: string,
  events: RawBackfillEvent[],
  knownKeys: string[],
): string {
  return [
    `You are Harper (CAO) running a weekly econ backfill normalization pass.`,
    `For each event below, assign a category from:`,
    `"Fiscal" (Treasury auctions, budget, debt ceiling, rate decisions, speakers),`,
    `"Supply Chain" (ISM, PMI manufacturing, durable goods, factory orders, trade balance, inventories),`,
    `"Inflation" (CPI, PPI, PCE, HICP, import/export prices),`,
    `"Job Market" (NFP, claims, ADP, unemployment, JOLTS, ECI, wages),`,
    `"Speaker" (named fiscal/central-bank speaker appearances).`,
    `\nCountry for all events: ${country}.`,
    `\nDedup against these existing event_keys (already in economic_events) — DROP any event whose computed event_key matches:\n${knownKeys.slice(0, 400).join(",")}`,
    `\nReturn ONLY a JSON array. Each object must have:`,
    `country, category, name, date (YYYY-MM-DD), time (HH:MM 24h ET or null),`,
    `forecast, actual, previous, detail, impact ("low"|"medium"|"high"|null), event_key.`,
    `\nevent_key = sha256(name + "|" + date + "|" + (time||"") + "|" + country) as lowercase hex.`,
    `\nEvents to normalize (${events.length} total):`,
    JSON.stringify(events),
  ].join("\n");
}

async function loadKnownKeys(country: string): Promise<string[]> {
  const sb = getSupabaseClient();
  if (!sb) return [];
  const { data, error } = await sb
    .from("economic_events")
    .select("event_key")
    .eq("country", country)
    .not("event_key", "is", null)
    .limit(5000);
  if (error || !data) return [];
  return (data as Array<{ event_key: string | null }>)
    .map((r) => r.event_key)
    .filter((k): k is string => typeof k === "string");
}

async function callHarper(prompt: string): Promise<{
  text: string | null;
  tokens: number;
}> {
  try {
    const { text } = await invokeAgent({
      systemPrompt:
        "You are a strict JSON-only categorizer. Return only the requested JSON array — no prose, no markdown.",
      userPrompt: prompt,
      model: { temperature: 0, maxTokens: 8000 },
    });
    if (!text || text.trim().length === 0) return { text: null, tokens: 0 };
    // invokeAgent doesn't surface usage; estimate ~4 chars/token for cap accounting.
    const approxTokens = Math.ceil((prompt.length + text.length) / 4);
    return { text, tokens: approxTokens };
  } catch (err) {
    log.warn("Harper invokeAgent failed", { error: String(err) });
    return { text: null, tokens: 0 };
  }
}

/**
 * Pull all unnormalized queue rows for this progress slice, send to Harper,
 * return normalized events. Respects a soft weekly token cap — short-circuits
 * and defers remaining queue if we'd blow past WEEKLY_TOKEN_CAP.
 */
export async function harperCategorizeBacklog(
  progressId: string,
): Promise<NormalizedBackfillEvent[]> {
  rolloverWeek();
  if (tokensSpentThisWeek >= WEEKLY_TOKEN_CAP) {
    log.warn("Harper weekly token cap hit — deferring backlog", {
      progressId,
      tokensSpentThisWeek,
    });
    return [];
  }

  const sb = getSupabaseClient();
  if (!sb) return [];

  const { data: queueRows, error } = await sb
    .from("econ_backfill_queue")
    .select("id, progress_id, raw_payload, normalized")
    .eq("progress_id", progressId)
    .eq("normalized", false);

  if (error || !queueRows || queueRows.length === 0) return [];

  const allRaw: RawBackfillEvent[] = [];
  let country = "US";
  for (const row of queueRows as Array<{ raw_payload: RawSlicePayload }>) {
    country = row.raw_payload?.country ?? country;
    if (Array.isArray(row.raw_payload?.events)) {
      allRaw.push(...row.raw_payload.events);
    }
  }
  if (allRaw.length === 0) return [];

  const knownKeys = await loadKnownKeys(country);
  const prompt = buildPrompt(country, allRaw, knownKeys);

  const { text, tokens } = await callHarper(prompt);
  tokensSpentThisWeek += tokens;

  const normalized = parseJsonArray(text)
    .map(coerceNormalized)
    .filter((e): e is NormalizedBackfillEvent => e !== null);

  const queueIds = (queueRows as Array<{ id: string }>).map((r) => r.id);
  if (queueIds.length > 0) {
    await sb
      .from("econ_backfill_queue")
      .update({ normalized: true })
      .in("id", queueIds);
  }

  log.info("Harper categorization complete", {
    progressId,
    input: allRaw.length,
    output: normalized.length,
    tokens,
    tokensWeek: tokensSpentThisWeek,
  });

  return normalized;
}
