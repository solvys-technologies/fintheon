// [claude-code 2026-04-25] S35-cleanup: rerouted puller from OpenRouter free-tier
// (which has been throttled to 402 insufficient-credits across llama-3.3-70b /
// mistral-large free models) to Hermes seatChat → DashScope Qwen3-235B-A22B,
// the same free Qwen path the Arbitrum Lead Analyst seat uses. Groq fallback
// inside seatChat handles DashScope rate-limits. US slices still enriched with
// FRED series if FRED_API_KEY is set.
// [claude-code 2026-04-24] S34-T10: free-tier LLM puller for historical econ events.

import { createLogger } from "../../lib/logger.js";
import { seatChat } from "../arbitrum/adapters.js";
import type {
  BackfillSlice,
  RawBackfillEvent,
  RawSlicePayload,
} from "../../types/econ-backfill.js";

const log = createLogger("EconBackfillPuller");

const PRIMARY_QWEN_MODEL = "qwen3-235b-a22b";
const FALLBACK_QWEN_MODEL = "qwen2.5-72b-instruct";
const QWEN_TIMEOUT_MS = 30_000;

const PULLER_SYSTEM_PROMPT =
  "You are a data extraction tool. Return ONLY valid JSON matching the schema requested. No prose, no markdown fences.";

// FRED series that map cleanly to our 4 categories for US slices.
const US_FRED_SERIES: Array<{ id: string; name: string }> = [
  { id: "CPIAUCSL", name: "CPI All Urban Consumers" },
  { id: "PAYEMS", name: "Nonfarm Payrolls" },
  { id: "UNRATE", name: "Unemployment Rate" },
  { id: "FEDFUNDS", name: "Federal Funds Rate" },
  { id: "GDP", name: "Gross Domestic Product" },
];

async function callHermesQwen(
  modelId: string,
  prompt: string,
): Promise<string | null> {
  try {
    const res = await seatChat({
      modelId,
      system: PULLER_SYSTEM_PROMPT,
      user: prompt,
      temperature: 0,
      timeoutMs: QWEN_TIMEOUT_MS,
    });
    return res.content && res.content.trim().length > 0 ? res.content : null;
  } catch (err) {
    log.warn("Hermes Qwen call failed", {
      model: modelId,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

function parseJsonArray(raw: string | null): unknown[] {
  if (!raw) return [];
  const trimmed = raw.trim();
  const stripped = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "");
  try {
    const parsed = JSON.parse(stripped);
    if (Array.isArray(parsed)) return parsed;
    if (
      parsed &&
      typeof parsed === "object" &&
      Array.isArray((parsed as { events?: unknown }).events)
    ) {
      return (parsed as { events: unknown[] }).events;
    }
    return [];
  } catch {
    return [];
  }
}

function coerceEvent(raw: unknown): RawBackfillEvent | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const name = typeof r.name === "string" ? r.name : null;
  const date = typeof r.date === "string" ? r.date : null;
  if (!name || !date) return null;

  const impactRaw =
    typeof r.impact === "string" ? r.impact.toLowerCase() : null;
  const impact =
    impactRaw === "low" || impactRaw === "medium" || impactRaw === "high"
      ? (impactRaw as "low" | "medium" | "high")
      : null;

  return {
    name,
    date,
    time: typeof r.time === "string" ? r.time : null,
    forecast: typeof r.forecast === "string" ? r.forecast : null,
    actual: typeof r.actual === "string" ? r.actual : null,
    previous: typeof r.previous === "string" ? r.previous : null,
    detail: typeof r.detail === "string" ? r.detail : null,
    impact,
    source_hint: typeof r.source_hint === "string" ? r.source_hint : undefined,
  };
}

async function fetchFredSeries(
  seriesId: string,
  apiKey: string,
  sliceStart: string,
  sliceEnd: string,
): Promise<Array<{ date: string; value: string }>> {
  const url = new URL("https://api.stlouisfed.org/fred/series/observations");
  url.searchParams.set("series_id", seriesId);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("file_type", "json");
  url.searchParams.set("observation_start", sliceStart);
  url.searchParams.set("observation_end", sliceEnd);
  try {
    const res = await fetch(url.toString());
    if (!res.ok) return [];
    const json = (await res.json()) as {
      observations?: Array<{ date: string; value: string }>;
    };
    return (json.observations ?? []).filter((o) => o.value && o.value !== ".");
  } catch (err) {
    log.warn("FRED fetch failed", { seriesId, error: String(err) });
    return [];
  }
}

async function pullFromFred(slice: BackfillSlice): Promise<RawBackfillEvent[]> {
  const key = process.env.FRED_API_KEY;
  if (!key || slice.country !== "US") return [];

  const events: RawBackfillEvent[] = [];
  for (const series of US_FRED_SERIES) {
    const observations = await fetchFredSeries(
      series.id,
      key,
      slice.slice_start,
      slice.slice_end,
    );
    for (const obs of observations) {
      events.push({
        name: series.name,
        date: obs.date,
        time: null,
        forecast: null,
        actual: obs.value,
        previous: null,
        detail: `FRED series ${series.id}`,
        impact: null,
        source_hint: "fred",
      });
    }
  }
  return events;
}

function buildPrompt(slice: BackfillSlice): string {
  return [
    `Return a JSON array of ALL scheduled economic events for ${slice.country}`,
    `between ${slice.slice_start} and ${slice.slice_end} inclusive.`,
    `Each object must have keys: name, date (YYYY-MM-DD), time (HH:MM 24h ET or null),`,
    `forecast (string or null), actual (string or null), previous (string or null),`,
    `detail (string or null), impact ("low"|"medium"|"high" or null).`,
    `Cover CPI, PPI, PCE, NFP, jobless claims, GDP, PMI, retail sales, trade balance,`,
    `central bank rate decisions, speaker events. Be exhaustive within the date range.`,
    `Return ONLY the JSON array — no prose, no markdown fences.`,
  ].join(" ");
}

export async function pullSliceViaFreeTierLLM(
  slice: BackfillSlice,
): Promise<RawSlicePayload | null> {
  const prompt = buildPrompt(slice);

  let raw = await callHermesQwen(PRIMARY_QWEN_MODEL, prompt);
  let source: RawSlicePayload["source"] = "hermes-qwen";
  if (!raw) {
    raw = await callHermesQwen(FALLBACK_QWEN_MODEL, prompt);
    source = "hermes-qwen-fallback";
  }

  const llmEvents = parseJsonArray(raw)
    .map(coerceEvent)
    .filter((e): e is RawBackfillEvent => e !== null);

  const fredEvents = await pullFromFred(slice);
  const allEvents = [...llmEvents, ...fredEvents];

  if (fredEvents.length > 0 && llmEvents.length > 0) {
    source = "mixed";
  } else if (fredEvents.length > 0 && llmEvents.length === 0) {
    source = "fred";
  }

  if (allEvents.length === 0) {
    log.warn("Slice pull returned zero events", {
      sliceId: slice.id,
      country: slice.country,
      range: `${slice.slice_start}..${slice.slice_end}`,
    });
    return null;
  }

  log.info("Slice pull complete", {
    sliceId: slice.id,
    country: slice.country,
    llm: llmEvents.length,
    fred: fredEvents.length,
    source,
  });

  return {
    source,
    slice_id: slice.id,
    country: slice.country,
    slice_start: slice.slice_start,
    slice_end: slice.slice_end,
    fetched_at: new Date().toISOString(),
    events: allEvents,
  };
}
