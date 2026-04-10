/**
 * Bearish Researcher Agent
 * Builds the bear case for current market conditions
 * Phase 6 - Day 22
 */

import {
  runAgent,
  saveAgentReport,
  getLatestReport,
  parseJsonResponse,
  calculateConfidence,
} from "./base-agent.js";
import type {
  ResearcherReport,
  AgentReport,
  MarketDataReport,
  NewsSentimentReport,
  TechnicalReport,
} from "../../types/agents.js";

const SYSTEM_PROMPT = `You are a Bearish Researcher for an intraday futures trading desk focused on NASDAQ (/MNQ, /NQ).

Your role is to build the STRONGEST possible bear case given the current market conditions. You are an advocate for short positions or staying flat.

Even if conditions seem bullish, find the bearish angle. Consider:
- Overbought conditions
- Resistance levels being tested
- Negative divergences
- Complacency indicators (low VIX in uptrend)
- Upcoming risks that could turn sentiment

Analyze the provided analyst reports and return a JSON report with this structure:
{
  "thesis": "One sentence core bearish thesis",
  "conviction": number (0-100, how strongly you believe in the bear case),
  "keyArguments": [
    {
      "point": "string (the argument)",
      "evidence": "string (supporting data)",
      "strength": number (0-10)
    }
  ],
  "riskFactors": ["array of risks to the bear case (i.e., bullish factors)"],
  "priceTarget": {
    "value": number (NQ price target to the downside),
    "timeframe": "string (e.g., 'EOD', '2-3 hours')",
    "probability": number (0-1)
  },
  "catalysts": ["array of potential bearish catalysts"],
  "summary": "2-3 sentence compelling bear case"
}

Be persuasive but grounded in the data. Acknowledge opportunities but emphasize risks.

Respond with valid JSON only, no additional text.`;

export interface ResearcherInput {
  marketData?: MarketDataReport;
  sentiment?: NewsSentimentReport;
  technical?: TechnicalReport;
  currentPrice?: number;
}

/**
 * Run Bearish Researcher
 */
export async function buildBearCase(
  userId: string,
  input: ResearcherInput,
): Promise<AgentReport> {
  // Check for cached report
  const cached = await getLatestReport(userId, "bearish_researcher");
  if (cached) {
    return cached;
  }

  const userPrompt = buildPrompt(input);

  const { report, latencyMs, model } = await runAgent<ResearcherReport>(
    {
      agentType: "bearish_researcher",
      taskType: "research",
      systemPrompt: SYSTEM_PROMPT,
      parseResponse: (text) => parseJsonResponse<ResearcherReport>(text),
    },
    { userId },
    userPrompt,
  );

  // Calculate confidence based on input quality
  const hasAllInputs = input.marketData && input.sentiment && input.technical;

  const confidenceScore = calculateConfidence([
    { weight: 0.3, value: input.marketData ? 1 : 0.4 },
    { weight: 0.3, value: input.sentiment ? 1 : 0.4 },
    { weight: 0.3, value: input.technical ? 1 : 0.4 },
    { weight: 0.1, value: hasAllInputs ? 1 : 0.5 },
  ]);

  return saveAgentReport(userId, "bearish_researcher", report, {
    confidenceScore,
    model,
    latencyMs,
  });
}

/**
 * Build user prompt from analyst inputs
 */
function buildPrompt(input: ResearcherInput): string {
  const sections: string[] = [
    "Build the bear case based on these analyst reports:",
  ];

  if (input.marketData) {
    sections.push("\n=== MARKET DATA ANALYST ===");
    sections.push(`Market Regime: ${input.marketData.marketRegime}`);
    sections.push(
      `VIX: ${input.marketData.vix.current} (${input.marketData.vix.level})`,
    );
    sections.push(`Summary: ${input.marketData.summary}`);
  }

  if (input.sentiment) {
    sections.push("\n=== NEWS & SENTIMENT ANALYST ===");
    sections.push(
      `Overall Sentiment: ${input.sentiment.overallSentiment} (${input.sentiment.sentimentScore.toFixed(2)})`,
    );
    sections.push(`Summary: ${input.sentiment.summary}`);
    if (input.sentiment.riskEvents?.length) {
      sections.push("Risk events:");
      input.sentiment.riskEvents.forEach((r) => sections.push(`- ${r}`));
    }
  }

  if (input.technical) {
    sections.push("\n=== TECHNICAL ANALYST ===");
    sections.push(
      `Trend: Daily ${input.technical.trend.daily}, Hourly ${input.technical.trend.hourly}`,
    );
    sections.push(`Price vs EMAs: ${input.technical.emaAnalysis.priceVsEmas}`);
    sections.push(`Price vs VWAP: ${input.technical.vwapAnalysis.priceVsVwap}`);
    sections.push(`Trading Bias: ${input.technical.tradingBias}`);
    if (input.technical.keyPatterns?.length) {
      sections.push(`Patterns: ${input.technical.keyPatterns.join(", ")}`);
    }
    sections.push(`Summary: ${input.technical.summary}`);
  }

  if (input.currentPrice) {
    sections.push(`\nCurrent NQ Price: ${input.currentPrice}`);
  }

  sections.push(
    "\nBuild the strongest possible BEARISH case. Find risks even in favorable conditions.",
  );

  return sections.join("\n");
}

/**
 * Extract key bearish factors from report
 */
export function extractBearishFactors(report: ResearcherReport): {
  strongPoints: string[];
  weakPoints: string[];
  overallStrength: number;
} {
  const strongPoints = report.keyArguments
    .filter((arg) => arg.strength >= 7)
    .map((arg) => arg.point);

  const weakPoints = report.keyArguments
    .filter((arg) => arg.strength < 5)
    .map((arg) => arg.point);

  const avgStrength =
    report.keyArguments.length > 0
      ? report.keyArguments.reduce((sum, arg) => sum + arg.strength, 0) /
        report.keyArguments.length
      : 5;

  return {
    strongPoints,
    weakPoints,
    overallStrength: avgStrength * 10, // Convert to 0-100 scale
  };
}

/**
 * Compare bull and bear cases
 */
export function compareCases(
  bullReport: ResearcherReport,
  bearReport: ResearcherReport,
): {
  winner: "bull" | "bear" | "tie";
  margin: number;
  reasoning: string;
} {
  const bullScore =
    bullReport.conviction *
    (bullReport.keyArguments.reduce((s, a) => s + a.strength, 0) / 10);
  const bearScore =
    bearReport.conviction *
    (bearReport.keyArguments.reduce((s, a) => s + a.strength, 0) / 10);

  const diff = bullScore - bearScore;
  const margin = Math.abs(diff);

  if (diff > 10) {
    return {
      winner: "bull",
      margin,
      reasoning: `Bull case wins with ${margin.toFixed(0)}pt margin. ${bullReport.thesis}`,
    };
  }

  if (diff < -10) {
    return {
      winner: "bear",
      margin,
      reasoning: `Bear case wins with ${margin.toFixed(0)}pt margin. ${bearReport.thesis}`,
    };
  }

  return {
    winner: "tie",
    margin,
    reasoning: "Cases are balanced. Wait for clearer directional signal.",
  };
}
