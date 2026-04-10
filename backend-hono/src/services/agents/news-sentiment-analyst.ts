/**
 * News & Sentiment Analyst Agent
 * Analyzes news feed for sentiment and catalysts
 * Phase 6 - Day 20
 */

import {
  runAgent,
  saveAgentReport,
  getLatestReport,
  parseJsonResponse,
  calculateConfidence,
} from "./base-agent.js";
import type {
  NewsSentimentReport,
  AgentReport,
  Sentiment,
} from "../../types/agents.js";
import type { FeedItem } from "../../types/riskflow.js";

const SYSTEM_PROMPT = `You are a News & Sentiment Analyst for an intraday futures trading desk focused on NASDAQ (/MNQ, /NQ).

Your role is to analyze financial news and determine market sentiment and upcoming catalysts.

Analyze the provided news headlines and return a JSON report with this structure:
{
  "overallSentiment": "bullish" | "bearish" | "neutral",
  "sentimentScore": number (-1 to +1, where -1 is extremely bearish, +1 is extremely bullish),
  "macroLevel": number (1-4 urgency tier: 4=breaking/extreme, 3=high impact, 2=moderate, 1=routine),
  "breakingNewsDetected": boolean,
  "topHeadlines": [
    {
      "headline": "string",
      "source": "string",
      "sentiment": "bullish" | "bearish" | "neutral",
      "ivScore": number (0-10 for implied volatility impact),
      "macroLevel": number (1-4),
      "publishedAt": "ISO timestamp"
    }
  ],
  "catalysts": [
    {
      "event": "string (e.g., 'Fed meeting', 'CPI release')",
      "impact": "high" | "medium" | "low",
      "direction": "bullish" | "bearish" | "neutral",
      "timing": "string (e.g., 'Today 2pm ET', 'Tomorrow')"
    }
  ],
  "riskEvents": ["array of upcoming risk events to watch"],
  "summary": "2-3 sentence summary of news sentiment and key catalysts"
}

Macro Level Classification (4-tier):
- Level 4: Breaking news, FOMC decisions, major economic surprises, IV >= 8
- Level 3: High impact scheduled events (CPI, NFP), IV 6-8
- Level 2: Moderate impact (earnings, Fed speakers), IV 4-6
- Level 1: Routine news, sector chatter, IV < 4

Focus on:
1. Breaking news that could move markets (Level 4)
2. Scheduled events (Fed, earnings, economic data)
3. Geopolitical developments
4. Sector-specific news affecting tech/NASDAQ

Respond with valid JSON only, no additional text.`;

export interface NewsSentimentInput {
  headlines: {
    headline: string;
    source: string;
    isBreaking: boolean;
    ivScore?: number;
    publishedAt: string;
  }[];
  upcomingEvents?: string[];
}

/**
 * Run News & Sentiment Analyst
 */
export async function analyzeNewsSentiment(
  userId: string,
  input?: NewsSentimentInput,
): Promise<AgentReport> {
  // Check for cached report
  const cached = await getLatestReport(userId, "news_sentiment");
  if (cached) {
    return cached;
  }

  // Use mock data if no input provided
  const data = input ?? getMockNewsData();

  const userPrompt = buildPrompt(data);

  const { report, latencyMs, model } = await runAgent<NewsSentimentReport>(
    {
      agentType: "news_sentiment",
      taskType: "news",
      systemPrompt: SYSTEM_PROMPT,
      parseResponse: (text) => parseJsonResponse<NewsSentimentReport>(text),
    },
    { userId },
    userPrompt,
  );

  // Calculate confidence based on data quality
  const hasBreaking = data.headlines.some((h) => h.isBreaking);
  const hasIvScores = data.headlines.some((h) => h.ivScore !== undefined);

  const confidenceScore = calculateConfidence([
    { weight: 0.4, value: Math.min(1, data.headlines.length / 10) },
    { weight: 0.2, value: hasBreaking ? 1 : 0.6 },
    { weight: 0.2, value: hasIvScores ? 1 : 0.5 },
    { weight: 0.2, value: data.upcomingEvents?.length ? 1 : 0.7 },
  ]);

  return saveAgentReport(userId, "news_sentiment", report, {
    confidenceScore,
    model,
    latencyMs,
  });
}

/**
 * Create input from RiskFlow feed items
 */
export function feedToSentimentInput(items: FeedItem[]): NewsSentimentInput {
  return {
    headlines: items.map((item) => ({
      headline: item.headline,
      source: item.source,
      isBreaking: item.isBreaking,
      ivScore: item.ivScore,
      publishedAt: item.publishedAt,
    })),
  };
}

/**
 * Build user prompt from news data
 */
function buildPrompt(data: NewsSentimentInput): string {
  const sections: string[] = [
    "Analyze the following financial news headlines:",
  ];

  data.headlines.forEach((h, i) => {
    const breaking = h.isBreaking ? "[BREAKING] " : "";
    const iv = h.ivScore !== undefined ? ` (IV: ${h.ivScore})` : "";
    sections.push(`${i + 1}. ${breaking}${h.headline}${iv} - ${h.source}`);
  });

  if (data.upcomingEvents?.length) {
    sections.push("\nUpcoming scheduled events:");
    data.upcomingEvents.forEach((event) => sections.push(`- ${event}`));
  }

  sections.push(
    "\nDetermine overall sentiment and identify key catalysts for NQ futures.",
  );

  return sections.join("\n");
}

/**
 * Get mock news data for development
 */
function getMockNewsData(): NewsSentimentInput {
  const now = new Date();
  return {
    headlines: [
      {
        headline:
          "Fed officials signal patience on rate cuts amid sticky inflation",
        source: "Reuters",
        isBreaking: false,
        ivScore: 6,
        publishedAt: new Date(now.getTime() - 30 * 60_000).toISOString(),
      },
      {
        headline: "BREAKING: CPI comes in at 2.9% YoY, below 3.1% forecast",
        source: "FinancialJuice",
        isBreaking: true,
        ivScore: 8.5,
        publishedAt: new Date(now.getTime() - 15 * 60_000).toISOString(),
      },
      {
        headline: "NVDA announces new AI chip with 2x performance boost",
        source: "Bloomberg",
        isBreaking: false,
        ivScore: 5,
        publishedAt: new Date(now.getTime() - 45 * 60_000).toISOString(),
      },
      {
        headline: "Tech earnings season kicks off with mixed guidance",
        source: "OSINTSources",
        isBreaking: false,
        publishedAt: new Date(now.getTime() - 60 * 60_000).toISOString(),
      },
    ],
    upcomingEvents: [
      "FOMC minutes release - Today 2pm ET",
      "Initial jobless claims - Tomorrow 8:30am ET",
    ],
  };
}

/**
 * Aggregate sentiment from multiple headlines
 */
export function aggregateSentiment(
  headlines: { sentiment: Sentiment; weight: number }[],
): { overall: Sentiment; score: number } {
  if (headlines.length === 0) {
    return { overall: "neutral", score: 0 };
  }

  const sentimentValues: Record<Sentiment, number> = {
    bullish: 1,
    neutral: 0,
    bearish: -1,
  };

  const totalWeight = headlines.reduce((sum, h) => sum + h.weight, 0);
  const weightedScore =
    headlines.reduce(
      (sum, h) => sum + sentimentValues[h.sentiment] * h.weight,
      0,
    ) / totalWeight;

  let overall: Sentiment = "neutral";
  if (weightedScore > 0.2) overall = "bullish";
  if (weightedScore < -0.2) overall = "bearish";

  return { overall, score: weightedScore };
}
