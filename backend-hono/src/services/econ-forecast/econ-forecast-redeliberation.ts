// [Codex 2026-05-27] Keep redeliberation aligned with PIC internal forecast fields.
import { invokeAgent } from "../strands/index.js";
import type { EconForecast } from "../../types/day-plan.js";
import type { EconForecastInput } from "./econ-forecast-service.js";

const REDELIBERATION_TIMEOUT_MS = 18_000;

interface RedeliberationInput {
  input: EconForecastInput;
  forecast: EconForecast;
  passes: number;
}

interface RedeliberationResult {
  verdict?: "pass" | "adjust";
  rationale?: string;
  picInternalForecast?: string;
  missProbability?: number;
  beatProbability?: number;
  confidenceScore?: number;
  secondOrderRead?: string;
  whatConfirms?: string;
  whatInvalidates?: string;
  missAgenticPrint?: string;
  beatAgenticPrint?: string;
  aiPrediction?: string;
}

export async function redeliberateEconForecast({
  input,
  forecast,
  passes,
}: RedeliberationInput): Promise<EconForecast> {
  let current: EconForecast = {
    ...forecast,
    validationChecks: forecast.validationChecks ?? [],
  };

  for (let i = 1; i <= passes; i++) {
    try {
      const result = await withTimeout(
        invokeAgent({
          systemPrompt: REDELIBERATION_SYSTEM_PROMPT,
          userPrompt: buildRedeliberationPrompt(input, current, i),
          model: {
            model: "deepseek-reasoner",
            temperature: 0.25,
            maxTokens: 420,
          },
          provider: "deepseek-direct",
        }),
        REDELIBERATION_TIMEOUT_MS,
      );
      const parsed = parseRedeliberation(result.text);
      current = applyRedeliberation(current, parsed, i, input.isSpeech);
    } catch (err) {
      current = {
        ...current,
        validationChecks: [
          ...(current.validationChecks ?? []),
          {
            pass: i,
            verdict: "fallback_pass",
            rationale: err instanceof Error ? err.message : String(err),
            checkedAt: new Date().toISOString(),
          },
        ],
      };
    }
  }

  return current;
}

function applyRedeliberation(
  forecast: EconForecast,
  parsed: RedeliberationResult | null,
  pass: number,
  isSpeech: boolean,
): EconForecast {
  if (!parsed) {
    return {
      ...forecast,
      validationChecks: [
        ...(forecast.validationChecks ?? []),
        {
          pass,
          verdict: "fallback_pass",
          rationale: "Validator returned non-JSON output",
          checkedAt: new Date().toISOString(),
        },
      ],
    };
  }

  const missProbability = clampProbability(
    parsed.missProbability ?? forecast.miss.probability,
  );
  const beatProbability = clampProbability(
    parsed.beatProbability ?? forecast.beat.probability,
  );
  const total = missProbability + beatProbability;
  const normalizedMiss =
    total > 0 ? Math.round((missProbability / total) * 100) : 50;
  const correctedForecast = cleanForecastedActual(
    parsed.picInternalForecast,
    isSpeech,
  );
  const forecastNote = forecastTextNote(
    parsed.picInternalForecast,
    correctedForecast ?? forecast.picInternalForecast,
  );
  const aiPrediction = [
    forecastNote,
    parsed.aiPrediction ?? forecast.aiPrediction,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  return {
    ...forecast,
    picInternalForecast: correctedForecast ?? forecast.picInternalForecast,
    forecast:
      correctedForecast ?? forecast.picInternalForecast ?? forecast.forecast,
    missProbability: normalizedMiss,
    beatProbability: 100 - normalizedMiss,
    confidenceScore: clampProbability(
      parsed.confidenceScore ?? forecast.confidenceScore,
    ),
    secondOrderRead: parsed.secondOrderRead ?? forecast.secondOrderRead,
    whatConfirms: parsed.whatConfirms ?? forecast.whatConfirms,
    whatInvalidates: parsed.whatInvalidates ?? forecast.whatInvalidates,
    miss: {
      ...forecast.miss,
      probability: normalizedMiss,
      agenticPrint:
        cleanAgenticPrint(parsed.missAgenticPrint) ??
        forecast.miss.agenticPrint,
    },
    beat: {
      ...forecast.beat,
      probability: 100 - normalizedMiss,
      agenticPrint:
        cleanAgenticPrint(parsed.beatAgenticPrint) ??
        forecast.beat.agenticPrint,
    },
    aiPrediction,
    validationChecks: [
      ...(forecast.validationChecks ?? []),
      {
        pass,
        verdict: parsed.verdict === "adjust" ? "adjusted" : "pass",
        rationale: parsed.rationale ?? "Forecast passed redeliberation",
        checkedAt: new Date().toISOString(),
      },
    ],
  };
}

function parseRedeliberation(raw: string): RedeliberationResult | null {
  const stripped = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "");
  const match = stripped.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]) as RedeliberationResult;
  } catch {
    return null;
  }
}

function buildRedeliberationPrompt(
  input: EconForecastInput,
  forecast: EconForecast,
  pass: number,
): string {
  return [
    `Pass: ${pass}`,
    `Event: ${input.eventName}`,
    `Date: ${input.eventDate}`,
    `Time: ${input.eventTime ?? "unknown"} ET`,
    `Country: ${input.eventCountry ?? "unknown"}`,
    `Consensus: ${input.forecast ?? "none"}`,
    `Previous: ${input.previous ?? "none"}`,
    "",
    "Current forecast JSON:",
    JSON.stringify({
      forecast: forecast.forecast,
      picInternalForecast: forecast.picInternalForecast,
      calendarConsensus: forecast.calendarConsensus,
      miss: forecast.miss,
      beat: forecast.beat,
      confidenceScore: forecast.confidenceScore,
      secondOrderRead: forecast.secondOrderRead,
      whatConfirms: forecast.whatConfirms,
      whatInvalidates: forecast.whatInvalidates,
      aiPrediction: forecast.aiPrediction,
    }),
    "",
    "Validate the PIC internal forecast. Calendar consensus is baseline only, never the desk forecast.",
    "Adjust only if the miss/beat probabilities, confidence, or second-order read are internally inconsistent.",
  ].join("\n");
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(
        new Error(`Forecast redeliberation timed out after ${timeoutMs}ms`),
      );
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

function clampProbability(value: number): number {
  if (!Number.isFinite(value)) return 50;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function cleanAgenticPrint(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed || /^(n\/?a|null|undefined)$/i.test(trimmed)) return undefined;
  return trimmed.slice(0, 48);
}

function cleanForecastedActual(
  value: unknown,
  isSpeech: boolean,
): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed || /^(n\/?a|null|undefined|pending)$/i.test(trimmed)) {
    return undefined;
  }
  if (isSpeech) {
    const tone = trimmed.match(/\b(hawkish|dovish|none)\b/i)?.[1];
    return tone ? tone.toLowerCase() : undefined;
  }
  const token = trimmed.match(
    /[<>≤≥]?\s*[-+]?\d+(?:\.\d+)?\s*(?:%|k|m|b|bp|bps|mm|bn)?/i,
  )?.[0];
  return token ? token.replace(/\s+/g, "").slice(0, 18) : undefined;
}

function forecastTextNote(rawForecast: unknown, actual: string): string | null {
  if (typeof rawForecast !== "string") return null;
  const trimmed = rawForecast.trim();
  if (!trimmed || trimmed === actual) return null;
  const note = trimmed
    .replace(actual, "")
    .replace(/^[-–—:,\s]+/, "")
    .trim();
  const text = note && note !== trimmed ? note : trimmed;
  return /[a-z]{3}/i.test(text) ? text.slice(0, 220) : null;
}

const REDELIBERATION_SYSTEM_PROMPT = `You are the second-pass validation desk for Fintheon economic forecasts.
Return strict JSON only:
{
  "verdict": "pass" | "adjust",
  "rationale": "one concise sentence",
  "picInternalForecast": "optional corrected PIC forecasted actual only",
  "missProbability": number,
  "beatProbability": number,
  "confidenceScore": number,
  "secondOrderRead": "optional tightened second-order read",
  "whatConfirms": "optional tightened confirmation",
  "whatInvalidates": "optional tightened invalidation",
  "missAgenticPrint": "optional corrected miss-side print value only",
  "beatAgenticPrint": "optional corrected beat-side print value only",
  "aiPrediction": "optional tightened prediction"
}

Rules:
- Run a skeptical validity check against event type, consensus, previous, and macro logic.
- Calendar consensus is not PIC's forecast.
- Do not invent actual print data.
- picInternalForecast must be only a forecasted actual value/tone with no prose. Put all rationale in aiPrediction.
- Probabilities must represent miss vs beat odds and sum to roughly 100.
- Only return missAgenticPrint or beatAgenticPrint when the current print values are concretely wrong. Values must be terse print/tone strings, not prose.
- Prefer "pass" unless there is a concrete inconsistency.`;
