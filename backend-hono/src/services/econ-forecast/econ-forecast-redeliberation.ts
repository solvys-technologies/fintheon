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
  forecast?: string;
  missProbability?: number;
  beatProbability?: number;
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
      current = applyRedeliberation(current, parsed, i);
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

  return {
    ...forecast,
    forecast: parsed.forecast ?? forecast.forecast,
    miss: { ...forecast.miss, probability: normalizedMiss },
    beat: { ...forecast.beat, probability: 100 - normalizedMiss },
    aiPrediction: parsed.aiPrediction ?? forecast.aiPrediction,
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
      miss: forecast.miss,
      beat: forecast.beat,
      aiPrediction: forecast.aiPrediction,
    }),
    "",
    "Validate the forecast and adjust only if the miss/beat probabilities or wording are internally inconsistent.",
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

const REDELIBERATION_SYSTEM_PROMPT = `You are the second-pass validation desk for Fintheon economic forecasts.
Return strict JSON only:
{
  "verdict": "pass" | "adjust",
  "rationale": "one concise sentence",
  "forecast": "optional corrected consensus string",
  "missProbability": number,
  "beatProbability": number,
  "aiPrediction": "optional tightened prediction"
}

Rules:
- Run a skeptical validity check against event type, consensus, previous, and macro logic.
- Do not invent actual print data.
- Probabilities must represent miss vs beat odds and sum to roughly 100.
- Prefer "pass" unless there is a concrete inconsistency.`;
