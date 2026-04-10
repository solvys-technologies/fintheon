/**
 * Market Data Analyst Agent
 * Analyzes current market conditions, VIX, key levels
 * Phase 6 - Day 20
 */

import {
  runAgent,
  saveAgentReport,
  getLatestReport,
  parseJsonResponse,
  calculateConfidence,
} from "./base-agent.js";
import type { MarketDataReport, AgentReport } from "../../types/agents.js";

const SYSTEM_PROMPT = `You are a Market Data Analyst for an intraday futures trading desk focused on NASDAQ (/MNQ, /NQ).

Your role is to analyze current market conditions and provide actionable intelligence.

Analyze the provided market data and return a JSON report with this structure:
{
  "vix": {
    "current": number,
    "change": number,
    "level": "low" | "normal" | "elevated" | "high" | "extreme"
  },
  "es": {
    "price": number,
    "change": number,
    "percentChange": number
  },
  "nq": {
    "price": number,
    "change": number,
    "percentChange": number
  },
  "treasuryYields": {
    "twoYear": number,
    "tenYear": number,
    "spread": number
  },
  "marketRegime": "risk_on" | "risk_off" | "transitional",
  "keyLevels": {
    "support": [array of key support levels for NQ],
    "resistance": [array of key resistance levels for NQ]
  },
  "summary": "2-3 sentence summary of market conditions"
}

VIX level classification:
- low: < 13
- normal: 13-18
- elevated: 18-25
- high: 25-35
- extreme: > 35

Market regime:
- risk_on: VIX low/normal, positive price action, yields stable
- risk_off: VIX elevated+, selling pressure, flight to safety
- transitional: mixed signals, choppy conditions

Respond with valid JSON only, no additional text.`;

export interface MarketDataInput {
  vix?: { current: number; change: number };
  es?: { price: number; change: number };
  nq?: { price: number; change: number };
  yields?: { twoYear: number; tenYear: number };
}

/**
 * Run Market Data Analyst
 */
export async function analyzeMarketData(
  userId: string,
  input?: MarketDataInput,
): Promise<AgentReport> {
  // Check for cached report first
  const cached = await getLatestReport(userId, "market_data");
  if (cached) {
    return cached;
  }

  // Use mock data in dev or if no input provided
  const data = input ?? getMockMarketData();

  const userPrompt = buildPrompt(data);

  const { report, latencyMs, model } = await runAgent<MarketDataReport>(
    {
      agentType: "market_data",
      taskType: "technical",
      systemPrompt: SYSTEM_PROMPT,
      parseResponse: (text) => parseJsonResponse<MarketDataReport>(text),
    },
    { userId },
    userPrompt,
  );

  // Calculate confidence based on data freshness and completeness
  const confidenceScore = calculateConfidence([
    { weight: 0.3, value: data.vix ? 1 : 0.5 },
    { weight: 0.3, value: data.nq ? 1 : 0.5 },
    { weight: 0.2, value: data.es ? 1 : 0.5 },
    { weight: 0.2, value: data.yields ? 1 : 0.5 },
  ]);

  return saveAgentReport(userId, "market_data", report, {
    confidenceScore,
    model,
    latencyMs,
  });
}

/**
 * Build the user prompt with market data
 */
function buildPrompt(data: MarketDataInput): string {
  const sections: string[] = ["Analyze the following market data:"];

  if (data.vix) {
    sections.push(
      `VIX: ${data.vix.current} (${data.vix.change >= 0 ? "+" : ""}${data.vix.change})`,
    );
  }

  if (data.es) {
    const pctChange = (
      (data.es.change / (data.es.price - data.es.change)) *
      100
    ).toFixed(2);
    sections.push(
      `ES (S&P 500 Futures): ${data.es.price} (${data.es.change >= 0 ? "+" : ""}${data.es.change}, ${pctChange}%)`,
    );
  }

  if (data.nq) {
    const pctChange = (
      (data.nq.change / (data.nq.price - data.nq.change)) *
      100
    ).toFixed(2);
    sections.push(
      `NQ (Nasdaq Futures): ${data.nq.price} (${data.nq.change >= 0 ? "+" : ""}${data.nq.change}, ${pctChange}%)`,
    );
  }

  if (data.yields) {
    const spread = (data.yields.tenYear - data.yields.twoYear).toFixed(2);
    sections.push(
      `Treasury Yields: 2Y=${data.yields.twoYear}%, 10Y=${data.yields.tenYear}%, Spread=${spread}%`,
    );
  }

  sections.push(
    "\nProvide key support/resistance levels for NQ and assess the current market regime.",
  );

  return sections.join("\n");
}

/**
 * Get mock market data for development
 */
function getMockMarketData(): MarketDataInput {
  return {
    vix: { current: 16.5, change: -0.8 },
    es: { price: 5420.25, change: 12.5 },
    nq: { price: 19250.0, change: 85.0 },
    yields: { twoYear: 4.35, tenYear: 4.15 },
  };
}

/**
 * Get VIX level classification
 */
export function classifyVixLevel(
  vix: number,
): MarketDataReport["vix"]["level"] {
  if (vix < 13) return "low";
  if (vix < 18) return "normal";
  if (vix < 25) return "elevated";
  if (vix < 35) return "high";
  return "extreme";
}

/**
 * Determine market regime from indicators
 */
export function determineMarketRegime(
  vixLevel: MarketDataReport["vix"]["level"],
  priceAction: "positive" | "negative" | "neutral",
): MarketDataReport["marketRegime"] {
  if (vixLevel === "low" || vixLevel === "normal") {
    return priceAction === "negative" ? "transitional" : "risk_on";
  }
  if (vixLevel === "high" || vixLevel === "extreme") {
    return "risk_off";
  }
  return "transitional";
}
