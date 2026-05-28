// [Codex 2026-05-27] S102 PIC internal forecast fields and macro event-risk rules.
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
  "calendarConsensus": string | null,
  "picInternalForecast": "hawkish" | "dovish" | "none",
  "forecast": "legacy mirror of picInternalForecast",
  "miss": { "description": "what would constitute a dovish surprise", "isBullishForEquities": true, "probability": number, "agenticPrint": "dovish" },
  "beat": { "description": "what would constitute a hawkish surprise", "isBullishForEquities": false, "probability": number, "agenticPrint": "hawkish" },
  "missProbability": number,
  "beatProbability": number,
  "confidenceScore": number,
  "forecastDeltaVsConsensus": "compact delta or obstacle read",
  "dataCycleStage": "where this sits in the Fed/data cycle",
  "fedMilestoneAnchor": "next Fed decision/presser/dot plot anchor",
  "secondOrderRead": "what markets do after the first reaction",
  "crossAssetTransmission": "rates/bonds/DXY/equity path",
  "whatConfirms": "what confirms the read",
  "whatInvalidates": "what invalidates the read",
  "commandmentChecks": ["compact commandment guardrails"],
  "otherNotableEvents": [],
  "aiPrediction": "1-2 sentence actionable prediction"
}

Rules:
- Calendar consensus is a baseline/obstacle only. It is never PIC's forecast.
- picInternalForecast is the desk forecast.
- "dovish" = rates lower/sooner = bullish equities; "hawkish" = rates higher/later = bearish equities
- Probabilities must sum to 100. If the speaker is consistently in one camp, weight accordingly.
- confidenceScore is 0-100.
- miss.agenticPrint and beat.agenticPrint are the agentic desk's scenario tone only: "dovish", "hawkish", or "none". No prose.
- aiPrediction: declarative, convicted, no hedging. Reference what the speaker has said recently.
- No emojis, no markdown. Plain JSON only.`;

// ── Econ print system prompt ─────────────────────────────────────────────────

const ECON_SYSTEM_PROMPT = `You analyze scheduled economic data releases for traders at Priced In Capital.
Output strictly a JSON object with these fields:
{
  "calendarConsensus": "the consensus number as a string, e.g. '0.3%' or '215K', or null",
  "picInternalForecast": "PIC's internal forecasted actual only, e.g. '0.2%' or '210K'",
  "forecast": "legacy mirror of picInternalForecast",
  "miss": { "description": "what print would classify as a miss and why", "isBullishForEquities": bool, "probability": number, "agenticPrint": "the desk's miss-side print forecast, e.g. '<0.3%' or '198K'" },
  "beat": { "description": "what print would classify as a beat and why", "isBullishForEquities": bool, "probability": number, "agenticPrint": "the desk's beat-side print forecast, e.g. '>0.3%' or '232K'" },
  "missProbability": number,
  "beatProbability": number,
  "confidenceScore": number,
  "forecastDeltaVsConsensus": "compact delta versus calendar consensus",
  "dataCycleStage": "jobs week / CPI-PPI-PCE / PMIs / GDP / earnings / quarter structure",
  "fedMilestoneAnchor": "next Fed decision, presser, dots, or minutes anchor",
  "secondOrderRead": "what markets do after the first reaction",
  "crossAssetTransmission": "rates/bonds/DXY/equity rotation path",
  "whatConfirms": "what confirms the internal forecast",
  "whatInvalidates": "what invalidates the internal forecast",
  "commandmentChecks": ["compact commandment guardrails"],
  "otherNotableEvents": ["any other events at the same time"],
  "aiPrediction": "1-3 sentence actionable prediction citing recent trends and what traders are positioned for"
}

Rules:
- Calendar consensus is a baseline/obstacle only. It is never PIC's forecast.
- picInternalForecast: produce only the desk's forecasted actual value with unit. No prose, no thesis text, no rationale.
- forecast: mirror picInternalForecast for legacy consumers only.
- miss.agenticPrint and beat.agenticPrint are the Agentic Desk's deliberated scenario print for that path, not probability. Use only the print/value with unit or comparator. No prose.
- If consensus is missing, infer a directional forecast from recent prints, RiskFlow headlines, and regime data. Do not answer with a generic passage.
- miss/beat isBullishForEquities depends on what's good/bad for risk assets:
  * Lower CPI/inflation = bullish (rates down). Higher = bearish.
  * Higher GDP/employment/PMI = bullish (growth). Lower = bearish.
  * Lower jobless claims = bullish (labor strong). Higher = bearish.
  * BUT: if inflation is the dominant fear (VIX elevated), strong growth data can be bearish (more rate hikes).
  * Think through the current macro regime — use the context provided.
- missProbability and beatProbability must sum to 100 and match miss/beat.probability.
- confidenceScore is 0-100.
- Include Wall Street pre-positioning, rate-sensitive equity rotation, and fractal time/correlation requirements when the context supports it.
- aiPrediction: sharp, convicted, declarative. Put all forecast rationale, data-cycle logic, and positioning text here, not in picInternalForecast.
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

    const calendarConsensus =
      cleanOptionalString(parsed.calendarConsensus) ??
      cleanOptionalString(input.forecast) ??
      cleanOptionalString(input.previous);
    const rawPicForecast =
      cleanOptionalString(parsed.picInternalForecast) ??
      cleanOptionalString(parsed.forecast);
    const picInternalForecast =
      cleanForecastedActual(rawPicForecast, input.isSpeech) ??
      cleanForecastedActual(input.forecast, input.isSpeech) ??
      cleanForecastedActual(input.previous, input.isSpeech) ??
      (input.isSpeech ? "none" : "Internal actual pending");
    const forecast = picInternalForecast;
    const miss: EconForecastScenario = {
      description: String(parsed.miss?.description ?? "Print below consensus"),
      isBullishForEquities: Boolean(parsed.miss?.isBullishForEquities),
      probability: clampProb(
        Number(parsed.missProbability ?? parsed.miss?.probability) || 40,
      ),
      agenticPrint: scenarioAgenticPrint(
        parsed.miss?.agenticPrint,
        forecast,
        "miss",
        input.isSpeech,
      ),
    };
    const beat: EconForecastScenario = {
      description: String(parsed.beat?.description ?? "Print above consensus"),
      isBullishForEquities: Boolean(parsed.beat?.isBullishForEquities),
      probability: clampProb(
        Number(parsed.beatProbability ?? parsed.beat?.probability) || 40,
      ),
      agenticPrint: scenarioAgenticPrint(
        parsed.beat?.agenticPrint,
        forecast,
        "beat",
        input.isSpeech,
      ),
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

    const forecastNote = forecastTextNote(rawPicForecast, picInternalForecast);
    const aiPrediction = [
      forecastNote,
      String(parsed.aiPrediction ?? "No prediction available.").trim(),
    ]
      .filter(Boolean)
      .join(" ")
      .trim();

    return {
      calendarConsensus,
      picInternalForecast,
      missProbability: miss.probability,
      beatProbability: beat.probability,
      confidenceScore: clampProb(Number(parsed.confidenceScore) || 45),
      forecastDeltaVsConsensus:
        cleanOptionalString(parsed.forecastDeltaVsConsensus) ??
        "Consensus is baseline only",
      dataCycleStage:
        cleanOptionalString(parsed.dataCycleStage) ??
        inferDataCycleStage(input),
      fedMilestoneAnchor:
        cleanOptionalString(parsed.fedMilestoneAnchor) ??
        "Next Fed communication",
      secondOrderRead:
        cleanOptionalString(parsed.secondOrderRead) ??
        "Watch rates, bonds, DXY, and equity rotation after the first move.",
      crossAssetTransmission:
        cleanOptionalString(parsed.crossAssetTransmission) ??
        "Rates and bonds transmit into NQ/ES leadership.",
      whatConfirms:
        cleanOptionalString(parsed.whatConfirms) ??
        "Tape confirms through rates, bonds, and index correlation.",
      whatInvalidates:
        cleanOptionalString(parsed.whatInvalidates) ??
        "Cross-asset reaction rejects the event read.",
      commandmentChecks: cleanStringList(parsed.commandmentChecks),
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

function cleanOptionalString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || /^(n\/?a|null|undefined)$/i.test(trimmed)) return null;
  return trimmed.slice(0, 320);
}

function cleanForecastedActual(
  value: unknown,
  isSpeech: boolean,
): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || /^(n\/?a|null|undefined|pending)$/i.test(trimmed)) {
    return null;
  }

  if (isSpeech) {
    const tone = trimmed.match(/\b(hawkish|dovish|none)\b/i)?.[1];
    return tone ? tone.toLowerCase() : null;
  }

  const token = trimmed.match(
    /[<>≤≥]?\s*[-+]?\d+(?:\.\d+)?\s*(?:%|k|m|b|bp|bps|mm|bn)?/i,
  )?.[0];
  return token ? token.replace(/\s+/g, "").slice(0, 18) : null;
}

function forecastTextNote(
  rawForecast: string | null,
  actual: string,
): string | null {
  if (!rawForecast) return null;
  const trimmed = rawForecast.trim();
  if (!trimmed || trimmed === actual) return null;
  const note = trimmed
    .replace(actual, "")
    .replace(/^[-–—:,\s]+/, "")
    .trim();
  const text = note && note !== trimmed ? note : trimmed;
  return /[a-z]{3}/i.test(text) ? text.slice(0, 220) : null;
}

function cleanStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(cleanOptionalString)
    .filter((item): item is string => Boolean(item))
    .slice(0, 6);
}

function inferDataCycleStage(input: EconForecastInput): string {
  const name = input.eventName.toLowerCase();
  if (/cpi|ppi|pce|inflation|prices/.test(name)) return "inflation cycle";
  if (/payroll|jobs|claims|employment|unemployment|wage/.test(name)) {
    return "labor cycle";
  }
  if (/pmi|ism|manufacturing|services/.test(name)) return "growth survey cycle";
  if (/gdp|spending|retail/.test(name)) return "growth/spending cycle";
  if (input.isSpeech) return "Fed communication cycle";
  return "macro data cycle";
}

function scenarioAgenticPrint(
  raw: unknown,
  forecast: string,
  side: "miss" | "beat",
  isSpeech: boolean,
): string {
  const explicit = typeof raw === "string" ? raw.trim() : "";
  if (explicit && !/^(n\/?a|null|undefined)$/i.test(explicit)) {
    return explicit.slice(0, 48);
  }
  return fallbackScenarioPrint(forecast, side, isSpeech);
}

function fallbackScenarioPrint(
  forecast: string,
  side: "miss" | "beat",
  isSpeech: boolean,
): string {
  if (isSpeech) return side === "miss" ? "dovish" : "hawkish";
  const clean = forecast.trim();
  if (!clean || /^(n\/?a|null|undefined)$/i.test(clean)) return "\u2014";
  if (/^[<>≤≥]/.test(clean)) return clean;
  return `${side === "miss" ? "<" : ">"}${clean}`;
}

// ── Fallback ────────────────────────────────────────────────────────────────

function buildFallbackForecast(input: EconForecastInput): EconForecast {
  const isSpeech = input.isSpeech;
  const fallbackForecast = isSpeech
    ? "none"
    : (input.forecast ?? input.previous ?? "N/A");

  return {
    calendarConsensus: isSpeech
      ? null
      : (input.forecast ?? input.previous ?? null),
    picInternalForecast: "Internal forecast pending",
    missProbability: 50,
    beatProbability: 50,
    confidenceScore: 35,
    forecastDeltaVsConsensus: "Pending desk review",
    dataCycleStage: inferDataCycleStage(input),
    fedMilestoneAnchor: "Next Fed communication",
    secondOrderRead: "Fallback read: wait for cross-asset confirmation.",
    crossAssetTransmission: "Rates, bonds, DXY, and equity indices must agree.",
    whatConfirms: "HTF/LTF alignment and correlated NQ/ES tape.",
    whatInvalidates: "Rates or bonds reject the event move.",
    commandmentChecks: ["3: no shot in the dark", "12: right or right out"],
    forecast: fallbackForecast,
    miss: {
      description: isSpeech
        ? "Dovish surprise — more accommodation signaled"
        : "Print below consensus",
      isBullishForEquities: isSpeech ? true : false,
      probability: 50,
      agenticPrint: fallbackScenarioPrint(fallbackForecast, "miss", isSpeech),
    },
    beat: {
      description: isSpeech
        ? "Hawkish surprise — less accommodation signaled"
        : "Print above consensus",
      isBullishForEquities: isSpeech ? false : true,
      probability: 50,
      agenticPrint: fallbackScenarioPrint(fallbackForecast, "beat", isSpeech),
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
