// [claude-code 2026-04-26] S35-cleanup: routed puller through OpenRouter Qwen
// (qwen/qwen-2.5-72b-instruct primary, qwen/qwen3-235b-a22b fallback) — same
// OPENROUTER_API_KEY that already fronts every Hermes call on prod. Free-tier
// :free variants 402 with $0 balance, so we use paid model IDs. FRED date
// window padded -60 days backward so monthly series whose observation_date
// falls in the prior reporting month still land inside the slice window.
// [claude-code 2026-04-24] S34-T10: free-tier LLM puller for historical econ events.

import { createLogger } from "../../lib/logger.js";
import type {
  BackfillSlice,
  RawBackfillEvent,
  RawSlicePayload,
} from "../../types/econ-backfill.js";

const log = createLogger("EconBackfillPuller");

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const PRIMARY_MODEL = "qwen/qwen-2.5-72b-instruct";
const FALLBACK_MODEL = "qwen/qwen3-235b-a22b";

const PULLER_SYSTEM_PROMPT =
  "You are a data extraction tool. Return ONLY valid JSON matching the schema requested. No prose, no markdown fences.";

const FRED_BACKWARD_PAD_DAYS = 60;

// FRED series that map cleanly to our 4 categories for US slices.
const US_FRED_SERIES: Array<{ id: string; name: string }> = [
  { id: "CPIAUCSL", name: "CPI All Urban Consumers" },
  { id: "PAYEMS", name: "Nonfarm Payrolls" },
  { id: "UNRATE", name: "Unemployment Rate" },
  { id: "FEDFUNDS", name: "Federal Funds Rate" },
  { id: "GDP", name: "Gross Domestic Product" },
];

interface OpenRouterResponse {
  choices?: Array<{ message?: { content?: string } }>;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function callOpenRouterQwen(
  model: string,
  prompt: string,
): Promise<string | null> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return null;

  const backoffs = [250, 1000, 4000];
  for (let attempt = 0; attempt <= backoffs.length; attempt++) {
    try {
      const res = await fetch(OPENROUTER_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: PULLER_SYSTEM_PROMPT },
            { role: "user", content: prompt },
          ],
          temperature: 0,
          max_tokens: 4000,
        }),
      });

      if (res.status === 429 || res.status === 503) {
        if (attempt < backoffs.length) {
          await sleep(backoffs[attempt]);
          continue;
        }
        return null;
      }

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        log.warn(`OpenRouter ${model} HTTP ${res.status}`, {
          body: text.slice(0, 200),
        });
        return null;
      }

      const json = (await res.json()) as OpenRouterResponse;
      const content = json.choices?.[0]?.message?.content ?? null;
      return content && content.trim().length > 0 ? content : null;
    } catch (err) {
      if (attempt < backoffs.length) {
        await sleep(backoffs[attempt]);
        continue;
      }
      log.warn("OpenRouter fetch failed", { model, error: String(err) });
      return null;
    }
  }
  return null;
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

  // FRED dates monthly series at the FIRST of the reporting month, but the
  // release prints ~3 weeks later. Pad backward so a slice starting 2026-04-01
  // still picks up CPI/Payrolls dated 2026-03-01 (March data, released April).
  const paddedStart = new Date(slice.slice_start);
  paddedStart.setUTCDate(paddedStart.getUTCDate() - FRED_BACKWARD_PAD_DAYS);
  const observation_start = paddedStart.toISOString().slice(0, 10);

  const events: RawBackfillEvent[] = [];
  for (const series of US_FRED_SERIES) {
    const observations = await fetchFredSeries(
      series.id,
      key,
      observation_start,
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

  let raw = await callOpenRouterQwen(PRIMARY_MODEL, prompt);
  let source: RawSlicePayload["source"] = "hermes-qwen";
  if (!raw) {
    raw = await callOpenRouterQwen(FALLBACK_MODEL, prompt);
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
