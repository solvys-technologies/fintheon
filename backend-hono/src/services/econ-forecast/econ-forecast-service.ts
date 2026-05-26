// [claude-code 2026-05-15] Econ forecast service — AI-powered miss/beat prediction
//   engine for the Desk Plan. Pulls fresh econ event data at viewing time, runs
//   AI prediction (DeepSeek via invokeAgent fallback chain), and returns structured
//   EconForecast objects. Replaces the old TV-based price computation pipeline.
//
//   Handles both numerical econ prints (CPI, PMI, NFP, etc.) and speech events
//   (hawkish/dovish/none forecast). For numerical events, the AI considers historical
//   print data and current macro context to generate probability-weighted scenarios.

import { invokeAgent } from "../strands/index.js";
import { readEconEvents } from "../supabase-service.js";
import { readEconPrints } from "../supabase-service.js";
import { getFeed } from "../riskflow/feed-service.js";
import { getCurrentRegime } from "../regime/regime-service.js";
import { createLogger } from "../../lib/logger.js";
import type {
  EconForecast,
  EconForecastScenario,
} from "../../types/day-plan.js";
import { redeliberateEconForecast } from "./econ-forecast-redeliberation.js";

const log = createLogger("EconForecast");
const FORECAST_TIMEOUT_MS = 25_000;

export interface EconForecastInput {
  eventName: string;
  eventDate: string;
  eventTime?: string;
  eventCountry?: string;
  eventCategory?: string;
  forecast?: string;
  previous?: string;
  isSpeech: boolean;
}

// ── Speech-specific system prompt ────────────────────────────────────────────

const SPEECH_SYSTEM_PROMPT = `You analyze scheduled central bank and government speeches for traders at Priced In Capital.
Output strictly a JSON object with these fields:
{
  "forecast": "hawkish" | "dovish" | "none",
  "miss": { "description": "what would constitute a dovish surprise", "isBullishForEquities": true, "probability": number },
  "beat": { "description": "what would constitute a hawkish surprise", "isBullishForEquities": false, "probability": number },
  "otherNotableEvents": [],
  "aiPrediction": "1-2 sentence actionable prediction"
}

Rules:
- "dovish" = rates lower/sooner = bullish equities; "hawkish" = rates higher/later = bearish equities
- Probabilities must sum to 100. If the speaker is consistently in one camp, weight accordingly.
- aiPrediction: declarative, convicted, no hedging. Reference what the speaker has said recently.
- No emojis, no markdown. Plain JSON only.`;

// ── Econ print system prompt ─────────────────────────────────────────────────

const ECON_SYSTEM_PROMPT = `You analyze scheduled economic data releases for traders at Priced In Capital.
Output strictly a JSON object with these fields:
{
  "forecast": "the consensus forecast number as a string, e.g. '0.3%' or '215K'",
  "miss": { "description": "what print would classify as a miss and why", "isBullishForEquities": bool, "probability": number },
  "beat": { "description": "what print would classify as a beat and why", "isBullishForEquities": bool, "probability": number },
  "otherNotableEvents": ["any other events at the same time"],
  "aiPrediction": "1-3 sentence actionable prediction citing recent trends and what traders are positioned for"
}

Rules:
- forecast: use the provided consensus or previous value if no consensus exists
- If consensus is missing, infer a directional forecast from recent prints, RiskFlow headlines, and regime data. Do not answer with a generic passage.
- miss/beat isBullishForEquities depends on what's good/bad for risk assets:
  * Lower CPI/inflation = bullish (rates down). Higher = bearish.
  * Higher GDP/employment/PMI = bullish (growth). Lower = bearish.
  * Lower jobless claims = bullish (labor strong). Higher = bearish.
  * BUT: if inflation is the dominant fear (VIX elevated), strong growth data can be bearish (more rate hikes).
  * Think through the current macro regime — use the context provided.
- Probabilities must sum to 100. Base them on recent trend momentum (streak of beats/misses).
- aiPrediction: sharp, convicted, declarative. Cite the last 2-3 prints if available. Include what positioning implies.
- No emojis, no markdown. Plain JSON only.`;

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Generate an econ forecast for a single event window.
 * Pulls fresh historical print data and runs AI prediction at call time.
 */
export async function generateEconForecast(
  input: EconForecastInput,
): Promise<EconForecast | null> {
  try {
    const { prompt, systemPrompt } = await buildPrompt(input);

    const result = await withTimeout(
      invokeAgent({
        systemPrompt,
        userPrompt: prompt,
        model: {
          model: "deepseek-reasoner",
          temperature: 0.45,
          maxTokens: 600,
        },
        provider: "deepseek-direct",
      }),
      FORECAST_TIMEOUT_MS,
    );

    const parsed = parseForecastResponse(result.text, input);
    const forecast = parsed ?? buildFallbackForecast(input);
    if (!parsed) {
      log.warn("Failed to parse AI forecast response", {
        event: input.eventName,
        rawLength: result.text.length,
      });
    }
    const validated = await redeliberateEconForecast({
      input,
      forecast,
      passes: 2,
    });

    log.info("Econ forecast generated", {
      event: input.eventName,
      forecast: validated.forecast,
      missProb: validated.miss.probability,
      beatProb: validated.beat.probability,
      validationCount: validated.validationChecks?.length ?? 0,
    });

    return validated;
  } catch (err) {
    log.warn("Econ forecast generation failed — using fallback", {
      event: input.eventName,
      error: err instanceof Error ? err.message : String(err),
    });
    return redeliberateEconForecast({
      input,
      forecast: buildFallbackForecast(input),
      passes: 2,
    });
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Econ forecast timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

/**
 * Refresh an econ forecast if we're within the 30-min pre-window window.
 * Returns null if no refresh is needed (outside the 30-min window or forecast
 * was already generated recently).
 */
export async function maybeRefreshForecast(
  existing: EconForecast | null,
  input: EconForecastInput,
  windowStartTime: string,
): Promise<EconForecast | null> {
  if (!isWithinRefreshWindow(windowStartTime)) {
    return existing;
  }

  // Don't regenerate more than once per 10 minutes
  if (existing?.generatedAt) {
    const age = Date.now() - new Date(existing.generatedAt).getTime();
    if (age < 10 * 60_000) return existing;
  }

  return generateEconForecast(input);
}

// ── Refresh window logic ────────────────────────────────────────────────────

function isWithinRefreshWindow(windowStartTime: string): boolean {
  const [h, m] = windowStartTime.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return false;
  const startMinutes = h * 60 + m;
  const now = nowInNewYorkMinutes();
  return now >= startMinutes - 30 && now < startMinutes;
}

function nowInNewYorkMinutes(): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(
    parts.find((part) => part.type === "minute")?.value ?? "0",
  );
  return hour * 60 + minute;
}

// ── Prompt construction ─────────────────────────────────────────────────────

async function buildPrompt(input: EconForecastInput): Promise<{
  prompt: string;
  systemPrompt: string;
}> {
  const systemPrompt = input.isSpeech
    ? SPEECH_SYSTEM_PROMPT
    : ECON_SYSTEM_PROMPT;

  const lines: string[] = [];
  lines.push(`Event: ${input.eventName}`);
  lines.push(`Date: ${input.eventDate}`);
  if (input.eventTime) lines.push(`Time: ${input.eventTime} ET`);
  if (input.eventCountry) lines.push(`Country: ${input.eventCountry}`);

  if (!input.isSpeech) {
    if (input.forecast) lines.push(`Consensus forecast: ${input.forecast}`);
    if (input.previous) lines.push(`Previous: ${input.previous}`);

    // Pull historical prints for context
    try {
      const prints = await readEconPrints({ eventName: input.eventName });
      if (prints.length > 0) {
        lines.push("");
        lines.push("Recent historical prints:");
        for (const p of prints.slice(0, 5)) {
          const actual = p.actual_value != null ? p.actual_value : "N/A";
          const forecast = p.forecast_value != null ? p.forecast_value : "N/A";
          const previous = p.previous_value != null ? p.previous_value : "N/A";
          const printedAt = p.printed_at
            ? new Date(p.printed_at).toISOString().slice(0, 10)
            : "?";
          lines.push(
            `  ${printedAt}: Actual ${actual} vs Forecast ${forecast} (Prev ${previous})`,
          );
        }
      }
    } catch {
      // prints unavailable — non-fatal
    }
  }
  try {
    const [feed, regime] = await Promise.all([
      getFeed("econ-forecast", { limit: 8 }).catch(
        () => ({ items: [] }) as never,
      ),
      getCurrentRegime().catch(() => null),
    ]);
    if (regime?.regime) lines.push(`Current macro regime: ${regime.regime}`);
    const headlines = (feed.items ?? [])
      .map((item: any) => item.headline)
      .filter(Boolean)
      .slice(0, 6);
    if (headlines.length) {
      lines.push("");
      lines.push("Recent RiskFlow context:");
      for (const headline of headlines) lines.push(`  - ${headline}`);
    }
  } catch {
    // Context is additive; forecast still works without it.
  }

  lines.push("");
  lines.push("Generate the forecast JSON now.");

  return { prompt: lines.join("\n"), systemPrompt };
}

// ── Response parsing ────────────────────────────────────────────────────────

function parseForecastResponse(
  raw: string,
  input: EconForecastInput,
): EconForecast | null {
  try {
    // Strip any markdown code fences
    let json = raw.trim();
    if (json.startsWith("```")) {
      json = json.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
    }

    const parsed = JSON.parse(json);

    const forecast = String(parsed.forecast ?? input.forecast ?? "N/A");
    const miss: EconForecastScenario = {
      description: String(parsed.miss?.description ?? "Print below consensus"),
      isBullishForEquities: Boolean(parsed.miss?.isBullishForEquities),
      probability: clampProb(Number(parsed.miss?.probability) || 40),
    };
    const beat: EconForecastScenario = {
      description: String(parsed.beat?.description ?? "Print above consensus"),
      isBullishForEquities: Boolean(parsed.beat?.isBullishForEquities),
      probability: clampProb(Number(parsed.beat?.probability) || 40),
    };

    // Normalize probabilities to sum to 100
    const total = miss.probability + beat.probability;
    if (total !== 100 && total > 0) {
      miss.probability = Math.round((miss.probability / total) * 100);
      beat.probability = 100 - miss.probability;
    }

    const otherNotableEvents: string[] = Array.isArray(
      parsed.otherNotableEvents,
    )
      ? parsed.otherNotableEvents.map(String)
      : [];

    const aiPrediction = String(
      parsed.aiPrediction ?? "No prediction available.",
    );

    return {
      forecast,
      miss,
      beat,
      otherNotableEvents,
      aiPrediction,
      generatedAt: new Date().toISOString(),
      eventCountry: input.eventCountry ?? null,
      eventTime: input.eventTime ?? null,
    };
  } catch {
    return null;
  }
}

function clampProb(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

// ── Fallback ────────────────────────────────────────────────────────────────

function buildFallbackForecast(input: EconForecastInput): EconForecast {
  const isSpeech = input.isSpeech;

  return {
    forecast: isSpeech ? "none" : (input.forecast ?? input.previous ?? "N/A"),
    miss: {
      description: isSpeech
        ? "Dovish surprise — more accommodation signaled"
        : "Print below consensus",
      isBullishForEquities: isSpeech ? true : false,
      probability: 50,
    },
    beat: {
      description: isSpeech
        ? "Hawkish surprise — less accommodation signaled"
        : "Print above consensus",
      isBullishForEquities: isSpeech ? false : true,
      probability: 50,
    },
    otherNotableEvents: [],
    aiPrediction: isSpeech
      ? `Watch for tone shifts in ${input.eventName}. Traders will react to any deviation from recent rhetoric.`
      : `Monitor ${input.eventName} closely. The print will set near-term direction.`,
    generatedAt: new Date().toISOString(),
    eventCountry: input.eventCountry ?? null,
    eventTime: input.eventTime ?? null,
  };
}

/**
 * Determine if an econ event is a speech (not a numerical print).
 */
export function isSpeechEvent(event: {
  category?: string | null;
  name?: string | null;
}): boolean {
  const cat = (event.category ?? "").toLowerCase();
  if (cat === "speaker" || cat === "speech") return true;

  const name = (event.name ?? "").toLowerCase();
  const speechKeywords =
    /\b(speech|speaks?|speaking|remarks|testimony|testifies|testifying|press conference|statement|briefing|fomc member|mpc member)\b/i;
  return speechKeywords.test(name);
}
