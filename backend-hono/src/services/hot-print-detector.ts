import { HotPrint } from "../types/news-analysis.js";

export interface HotPrintInput {
  type: string;
  actual?: number | null;
  forecast?: number | null;
  previous?: number | null;
  unit?: string;
  releaseTime?: string;
}

interface HotPrintThreshold {
  deviation: number;
  absolute?: boolean;
  impact: HotPrint["impact"];
  implication: string;
}

const thresholds: Record<string, HotPrintThreshold> = {
  CPI: {
    deviation: 0.2,
    impact: "high",
    implication: "Expect immediate rates repricing and equity volatility.",
  },
  PPI: {
    deviation: 0.2,
    impact: "medium",
    implication: "Producer pricing shock likely bleeds into CPI expectations.",
  },
  NFP: {
    deviation: 50_000,
    absolute: true,
    impact: "high",
    implication:
      "Labor-market surprise drives yields and index futures momentum.",
  },
  GDP: {
    deviation: 0.5,
    impact: "medium",
    implication: "Growth surprise re-prices cyclical exposure and rate path.",
  },
  RETAIL: {
    deviation: 0.3,
    impact: "medium",
    implication: "Consumer strength/weakness shifts discretionary leadership.",
  },
};

const normalizeType = (type: string) => type.trim().toUpperCase();

const computeDeviation = (
  input: HotPrintInput,
  rule: HotPrintThreshold,
): number | null => {
  if (input.actual === null || input.actual === undefined) return null;
  if (input.forecast === null || input.forecast === undefined) return null;

  if (rule.absolute) {
    return Math.abs(input.actual - input.forecast);
  }

  return Math.abs(input.actual - input.forecast);
};

export const detectHotPrint = (input: HotPrintInput): HotPrint | null => {
  const typeKey = normalizeType(input.type);
  const rule = thresholds[typeKey];
  if (!rule) return null;

  const deviation = computeDeviation(input, rule);
  if (deviation === null || deviation <= rule.deviation) {
    return null;
  }

  return {
    type: typeKey,
    actual: input.actual ?? 0,
    forecast: input.forecast ?? 0,
    previous: input.previous ?? undefined,
    deviation,
    direction:
      input.actual && input.forecast && input.actual > input.forecast
        ? "above"
        : "below",
    impact: rule.impact,
    tradingImplication: rule.implication,
    releaseTime: input.releaseTime,
  };
};
