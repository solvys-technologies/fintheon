/**
 * Technical Analyst Agent
 * Analyzes price action, EMAs, VWAP, volume for trading bias
 * Phase 6 - Day 21
 */

import {
  runAgent,
  saveAgentReport,
  getLatestReport,
  parseJsonResponse,
  calculateConfidence,
} from "./base-agent.js";
import type {
  TechnicalReport,
  AgentReport,
  Sentiment,
} from "../../types/agents.js";

const SYSTEM_PROMPT = `You are a Technical Analyst for an intraday futures trading desk focused on NASDAQ (/MNQ, /NQ).

Your role is to analyze price action, moving averages, VWAP, and volume to determine trading bias.

Analyze the provided technical data and return a JSON report with this structure:
{
  "trend": {
    "daily": "bullish" | "bearish" | "neutral",
    "hourly": "bullish" | "bearish" | "neutral",
    "strength": number (0-100)
  },
  "emaAnalysis": {
    "ema20": number,
    "ema50": number,
    "ema100": number,
    "ema200": number,
    "priceVsEmas": "above_all" | "mixed" | "below_all"
  },
  "vwapAnalysis": {
    "dailyVwap": number,
    "priceVsVwap": "above" | "below" | "at"
  },
  "volumeProfile": {
    "currentVsAvg": "high" | "normal" | "low",
    "volumeTrend": "increasing" | "decreasing" | "stable"
  },
  "keyPatterns": ["array of identified chart patterns"],
  "tradingBias": "bullish" | "bearish" | "neutral",
  "summary": "2-3 sentence summary of technical outlook"
}

Key considerations:
- Price above 20/50 EMA = short-term bullish
- Price above 100/200 EMA = long-term bullish
- Above VWAP = institutional buying pressure
- High volume confirms moves
- Look for EMA confluence zones as key levels

Respond with valid JSON only, no additional text.`;

export interface TechnicalInput {
  price: number;
  ema20?: number;
  ema50?: number;
  ema100?: number;
  ema200?: number;
  vwap?: number;
  volume?: {
    current: number;
    average: number;
  };
  recentCandles?: {
    high: number;
    low: number;
    close: number;
    volume: number;
  }[];
}

/**
 * Run Technical Analyst
 */
export async function analyzeTechnicals(
  userId: string,
  input?: TechnicalInput,
): Promise<AgentReport> {
  // Check for cached report
  const cached = await getLatestReport(userId, "technical");
  if (cached) {
    return cached;
  }

  // Use mock data if no input provided
  const data = input ?? getMockTechnicalData();

  const userPrompt = buildPrompt(data);

  const { report, latencyMs, model } = await runAgent<TechnicalReport>(
    {
      agentType: "technical",
      taskType: "technical",
      systemPrompt: SYSTEM_PROMPT,
      parseResponse: (text) => parseJsonResponse<TechnicalReport>(text),
    },
    { userId },
    userPrompt,
  );

  // Calculate confidence based on data completeness
  const hasAllEmas = data.ema20 && data.ema50 && data.ema100 && data.ema200;
  const hasVolume = data.volume !== undefined;
  const hasCandles = data.recentCandles && data.recentCandles.length >= 5;

  const confidenceScore = calculateConfidence([
    { weight: 0.3, value: hasAllEmas ? 1 : 0.5 },
    { weight: 0.2, value: data.vwap ? 1 : 0.6 },
    { weight: 0.25, value: hasVolume ? 1 : 0.5 },
    { weight: 0.25, value: hasCandles ? 1 : 0.6 },
  ]);

  return saveAgentReport(userId, "technical", report, {
    confidenceScore,
    model,
    latencyMs,
  });
}

/**
 * Build user prompt from technical data
 */
function buildPrompt(data: TechnicalInput): string {
  const sections: string[] = ["Analyze the following NQ technical data:"];

  sections.push(`Current Price: ${data.price}`);

  if (data.ema20) sections.push(`EMA 20: ${data.ema20}`);
  if (data.ema50) sections.push(`EMA 50: ${data.ema50}`);
  if (data.ema100) sections.push(`EMA 100: ${data.ema100}`);
  if (data.ema200) sections.push(`EMA 200: ${data.ema200}`);

  if (data.vwap) {
    const relation =
      data.price > data.vwap
        ? "above"
        : data.price < data.vwap
          ? "below"
          : "at";
    sections.push(`Daily VWAP: ${data.vwap} (price ${relation})`);
  }

  if (data.volume) {
    const ratio = ((data.volume.current / data.volume.average) * 100).toFixed(
      0,
    );
    sections.push(`Volume: ${ratio}% of average`);
  }

  if (data.recentCandles?.length) {
    const high = Math.max(...data.recentCandles.map((c) => c.high));
    const low = Math.min(...data.recentCandles.map((c) => c.low));
    sections.push(`Recent range: ${low} - ${high}`);
  }

  sections.push(
    "\nDetermine trend, identify patterns, and provide trading bias for NQ.",
  );

  return sections.join("\n");
}

/**
 * Get mock technical data for development
 */
function getMockTechnicalData(): TechnicalInput {
  const price = 19250;
  return {
    price,
    ema20: price - 15,
    ema50: price - 45,
    ema100: price - 120,
    ema200: price - 350,
    vwap: price - 25,
    volume: {
      current: 125000,
      average: 100000,
    },
    recentCandles: [
      { high: 19280, low: 19220, close: 19265, volume: 25000 },
      { high: 19270, low: 19200, close: 19250, volume: 28000 },
      { high: 19260, low: 19180, close: 19235, volume: 22000 },
      { high: 19240, low: 19150, close: 19200, volume: 30000 },
      { high: 19220, low: 19140, close: 19180, volume: 27000 },
    ],
  };
}

/**
 * Determine EMA confluence level
 */
export function analyzeEmaConfluence(
  price: number,
  emas: { ema20: number; ema50: number; ema100: number; ema200: number },
): {
  level:
    | "strong_bullish"
    | "bullish"
    | "neutral"
    | "bearish"
    | "strong_bearish";
  confluencePrice?: number;
} {
  const aboveCount = [
    price > emas.ema20,
    price > emas.ema50,
    price > emas.ema100,
    price > emas.ema200,
  ].filter(Boolean).length;

  // Check for EMA confluence (EMAs close together)
  const emaValues = [emas.ema20, emas.ema50, emas.ema100, emas.ema200];
  const emaSpread = Math.max(...emaValues) - Math.min(...emaValues);
  const avgEma = emaValues.reduce((a, b) => a + b, 0) / 4;
  const spreadPercent = (emaSpread / avgEma) * 100;

  const confluencePrice = spreadPercent < 2 ? avgEma : undefined;

  if (aboveCount === 4) return { level: "strong_bullish", confluencePrice };
  if (aboveCount === 3) return { level: "bullish", confluencePrice };
  if (aboveCount === 2) return { level: "neutral", confluencePrice };
  if (aboveCount === 1) return { level: "bearish", confluencePrice };
  return { level: "strong_bearish", confluencePrice };
}

/**
 * Determine trading bias from technical factors
 */
export function determineTechnicalBias(report: TechnicalReport): {
  bias: Sentiment;
  conviction: number;
  factors: string[];
} {
  const factors: string[] = [];
  let score = 0;

  // Trend analysis
  if (report.trend.daily === "bullish") {
    score += 2;
    factors.push("Daily trend bullish");
  } else if (report.trend.daily === "bearish") {
    score -= 2;
    factors.push("Daily trend bearish");
  }

  if (report.trend.hourly === "bullish") {
    score += 1;
    factors.push("Hourly trend bullish");
  } else if (report.trend.hourly === "bearish") {
    score -= 1;
    factors.push("Hourly trend bearish");
  }

  // EMA analysis
  if (report.emaAnalysis.priceVsEmas === "above_all") {
    score += 2;
    factors.push("Price above all EMAs");
  } else if (report.emaAnalysis.priceVsEmas === "below_all") {
    score -= 2;
    factors.push("Price below all EMAs");
  }

  // VWAP analysis
  if (report.vwapAnalysis.priceVsVwap === "above") {
    score += 1;
    factors.push("Price above VWAP");
  } else if (report.vwapAnalysis.priceVsVwap === "below") {
    score -= 1;
    factors.push("Price below VWAP");
  }

  // Volume confirmation
  if (report.volumeProfile.currentVsAvg === "high") {
    const multiplier = score > 0 ? 1.2 : score < 0 ? 1.2 : 1;
    score = score * multiplier;
    factors.push("High volume confirms move");
  }

  const maxScore = 6;
  const conviction = Math.min(100, Math.abs(score / maxScore) * 100);

  let bias: Sentiment = "neutral";
  if (score > 1) bias = "bullish";
  if (score < -1) bias = "bearish";

  return { bias, conviction, factors };
}
