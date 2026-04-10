/**
 * Bullish Researcher Agent
 * Builds the bull case for current market conditions
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

const SYSTEM_PROMPT = `You are a Bullish Researcher for an intraday futures trading desk focused on NASDAQ (/MNQ, /NQ).

Your role is to build the STRONGEST possible bull case given the current market conditions. You are an advocate for long positions.

Even if conditions seem bearish, find the bullish angle. Consider:
- Dip-buying opportunities
- Oversold conditions
- Positive divergences
- Contrarian indicators at extremes
- Upcoming catalysts that could turn sentiment

Analyze the provided analyst reports and return a JSON report with this structure:
{
  "thesis": "One sentence core bullish thesis",
  "conviction": number (0-100, how strongly you believe in the bull case),
  "keyArguments": [
    {
      "point": "string (the argument)",
      "evidence": "string (supporting data)",
      "strength": number (0-10)
    }
  ],
  "riskFactors": ["array of risks to the bull case"],
  "priceTarget": {
    "value": number (NQ price target),
    "timeframe": "string (e.g., 'EOD', '2-3 hours')",
    "probability": number (0-1)
  },
  "catalysts": ["array of potential bullish catalysts"],
  "summary": "2-3 sentence compelling bull case"
}

Be persuasive but grounded in the data. Acknowledge risks but emphasize opportunities.

Respond with valid JSON only, no additional text.`;

export interface ResearcherInput {
  marketData?: MarketDataReport;
  sentiment?: NewsSentimentReport;
  technical?: TechnicalReport;
  currentPrice?: number;
}

/**
 * Run Bullish Researcher
 */
export async function buildBullCase(
  userId: string,
  input: ResearcherInput,
): Promise<AgentReport> {
  // Check for cached report
  const cached = await getLatestReport(userId, "bullish_researcher");
  if (cached) {
    return cached;
  }

  const userPrompt = buildPrompt(input);

  const { report, latencyMs, model } = await runAgent<ResearcherReport>(
    {
      agentType: "bullish_researcher",
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

  return saveAgentReport(userId, "bullish_researcher", report, {
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
    "Build the bull case based on these analyst reports:",
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
    if (input.sentiment.catalysts?.length) {
      sections.push("Upcoming catalysts:");
      input.sentiment.catalysts.forEach((c) => {
        sections.push(`- ${c.event}: ${c.direction} (${c.impact} impact)`);
      });
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
    sections.push(`Summary: ${input.technical.summary}`);
  }

  if (input.currentPrice) {
    sections.push(`\nCurrent NQ Price: ${input.currentPrice}`);
  }

  sections.push(
    "\nBuild the strongest possible BULLISH case. Find opportunities even in challenging conditions.",
  );

  return sections.join("\n");
}

/**
 * Extract key bullish factors from report
 */
export function extractBullishFactors(report: ResearcherReport): {
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
