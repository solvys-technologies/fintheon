// [claude-code 2026-03-16] Agent backend v7.9: Oracle's merged PMA (PMA-1 + PMA-2)
/**
 * PMA Combined Analyst — Oracle's Domain
 * Merged prediction market analyst covering:
 *   PMA-1: S&P 500 & Crypto prediction markets
 *   PMA-2: Economic & Political prediction markets
 *
 * Oracle ("The All-Seer") synthesizes prediction market signals with macro reads,
 * crypto correlations, and political risk into a unified probabilistic assessment.
 */

import {
  runAgent,
  saveAgentReport,
  getLatestReport,
  parseJsonResponse,
  calculateConfidence,
  type AgentContext,
} from "./base-agent.js";
import type { AgentReport } from "../../types/agents.js";

// --- Types ---

export interface PMAReport {
  predictionMarkets: {
    fedRateCuts: {
      probability: number;
      source: string;
      trend: "rising" | "falling" | "stable";
    };
    recessionRisk: {
      probability: number;
      source: string;
      trend: "rising" | "falling" | "stable";
    };
    spxYearEnd: { range: string; confidence: number };
    cryptoCorrelation: {
      btcSpxCorr: number;
      regime: "correlated" | "decorrelated" | "inverse";
    };
    politicalRisk: {
      level: "low" | "moderate" | "elevated" | "high";
      drivers: string[];
    };
  };
  macroAssessment: {
    fedStance: "hawkish" | "neutral" | "dovish";
    inflationTrend: "accelerating" | "stable" | "decelerating";
    employmentStrength: "strong" | "moderate" | "weakening";
    gdpOutlook: "expansion" | "stagnation" | "contraction";
  };
  convergenceDivergence: {
    marketsVsMacro: "aligned" | "diverging" | "conflicting";
    description: string;
  };
  riskEvents: string[];
  overallBias: "bullish" | "bearish" | "neutral";
  confidenceScore: number;
  summary: string;
}

// --- System Prompt ---

const SYSTEM_PROMPT = `You are Oracle, the All-Seer — a prediction market analyst for Fintheon's trading desk.

You synthesize two domains into a unified probabilistic view:

DOMAIN 1 — Markets (formerly PMA-1):
- S&P 500 / NQ / ES futures outlook via prediction market pricing
- Crypto correlations (BTC-SPX regime detection)
- Polymarket, Kalshi, and implied probability signals

DOMAIN 2 — Macro & Political (formerly PMA-2):
- Fed policy path (rate cuts/hikes probability)
- Economic indicators (CPI, GDP, employment trends)
- Political risk assessment (elections, policy shifts, geopolitical)
- Recession probability tracking

Your output must be valid JSON matching:
{
  "predictionMarkets": {
    "fedRateCuts": { "probability": number, "source": "string", "trend": "rising|falling|stable" },
    "recessionRisk": { "probability": number, "source": "string", "trend": "rising|falling|stable" },
    "spxYearEnd": { "range": "string", "confidence": number },
    "cryptoCorrelation": { "btcSpxCorr": number, "regime": "correlated|decorrelated|inverse" },
    "politicalRisk": { "level": "low|moderate|elevated|high", "drivers": ["strings"] }
  },
  "macroAssessment": {
    "fedStance": "hawkish|neutral|dovish",
    "inflationTrend": "accelerating|stable|decelerating",
    "employmentStrength": "strong|moderate|weakening",
    "gdpOutlook": "expansion|stagnation|contraction"
  },
  "convergenceDivergence": {
    "marketsVsMacro": "aligned|diverging|conflicting",
    "description": "string"
  },
  "riskEvents": ["upcoming risk events"],
  "overallBias": "bullish|bearish|neutral",
  "confidenceScore": number (0-100),
  "summary": "2-3 sentence synthesis"
}

Focus on where prediction markets DISAGREE with macro fundamentals — that's where edge lives.
Respond with valid JSON only.`;

// --- Input ---

export interface PMAInput {
  polymarketData?: {
    fedCutProb?: number;
    recessionProb?: number;
    electionOdds?: Record<string, number>;
  };
  macroData?: {
    latestCpi?: number;
    fedFundsRate?: number;
    gdpGrowth?: number;
    unemploymentRate?: number;
    nfpDelta?: number;
  };
  cryptoData?: {
    btcPrice?: number;
    btcChange24h?: number;
    btcSpxCorrelation?: number;
  };
  kalshiData?: {
    topWhaleAlerts?: Array<{
      ticker: string;
      notionalUsd: number;
      takerSide: string;
      marketTitle: string;
      contracts: number;
    }>;
    macroMarketPrices?: Record<string, number>;
  };
  marketContext?: string;
}

// --- Runner ---

export async function analyzePMAMerged(
  userId: string,
  input?: PMAInput,
): Promise<AgentReport> {
  // Check cache — reuse 'news_sentiment' slot since PMA has similar TTL needs
  // (the pipeline treats this as a separate stage anyway)
  const cached = await getLatestReport(userId, "news_sentiment");
  if (
    cached &&
    (cached.reportData as Record<string, unknown>)?.predictionMarkets
  ) {
    return cached;
  }

  const data = input ?? getMockPMAData();
  const userPrompt = buildPMAPrompt(data);

  const { report, latencyMs, model } = await runAgent<PMAReport>(
    {
      agentType: "news_sentiment", // Reuse slot — pipeline manages stage ordering
      taskType: "reasoning",
      systemPrompt: SYSTEM_PROMPT,
      parseResponse: (text) => parseJsonResponse<PMAReport>(text),
    },
    { userId } as AgentContext,
    userPrompt,
  );

  const confidenceScore = calculateConfidence([
    { weight: 0.3, value: data.polymarketData ? 1 : 0.4 },
    { weight: 0.3, value: data.macroData ? 1 : 0.5 },
    { weight: 0.2, value: data.cryptoData ? 1 : 0.3 },
    { weight: 0.2, value: (report.confidenceScore ?? 50) / 100 },
  ]);

  return saveAgentReport(userId, "news_sentiment", report, {
    confidenceScore,
    model,
    latencyMs,
  });
}

// --- Prompt Builder ---

function buildPMAPrompt(data: PMAInput): string {
  const sections: string[] = [
    "Synthesize the following data into a unified prediction market + macro assessment:",
  ];

  if (data.polymarketData) {
    sections.push("\n=== PREDICTION MARKETS ===");
    if (data.polymarketData.fedCutProb != null)
      sections.push(
        `Fed rate cut probability: ${(data.polymarketData.fedCutProb * 100).toFixed(1)}%`,
      );
    if (data.polymarketData.recessionProb != null)
      sections.push(
        `Recession probability: ${(data.polymarketData.recessionProb * 100).toFixed(1)}%`,
      );
    if (data.polymarketData.electionOdds) {
      sections.push("Election odds:");
      for (const [candidate, odds] of Object.entries(
        data.polymarketData.electionOdds,
      )) {
        sections.push(`  ${candidate}: ${(odds * 100).toFixed(1)}%`);
      }
    }
  }

  if (data.macroData) {
    sections.push("\n=== MACRO DATA ===");
    if (data.macroData.latestCpi != null)
      sections.push(`Latest CPI: ${data.macroData.latestCpi}%`);
    if (data.macroData.fedFundsRate != null)
      sections.push(`Fed Funds Rate: ${data.macroData.fedFundsRate}%`);
    if (data.macroData.gdpGrowth != null)
      sections.push(`GDP Growth: ${data.macroData.gdpGrowth}%`);
    if (data.macroData.unemploymentRate != null)
      sections.push(`Unemployment: ${data.macroData.unemploymentRate}%`);
    if (data.macroData.nfpDelta != null)
      sections.push(`NFP Delta: ${data.macroData.nfpDelta}k`);
  }

  if (data.cryptoData) {
    sections.push("\n=== CRYPTO ===");
    if (data.cryptoData.btcPrice != null)
      sections.push(`BTC: $${data.cryptoData.btcPrice.toLocaleString()}`);
    if (data.cryptoData.btcChange24h != null)
      sections.push(
        `BTC 24h: ${data.cryptoData.btcChange24h > 0 ? "+" : ""}${data.cryptoData.btcChange24h.toFixed(2)}%`,
      );
    if (data.cryptoData.btcSpxCorrelation != null)
      sections.push(
        `BTC-SPX correlation: ${data.cryptoData.btcSpxCorrelation.toFixed(2)}`,
      );
  }

  if (data.kalshiData) {
    if (data.kalshiData.topWhaleAlerts?.length) {
      sections.push("\n=== KALSHI WHALE FLOW ===");
      sections.push(
        "Large institutional trades detected on Kalshi prediction markets:",
      );
      for (const w of data.kalshiData.topWhaleAlerts.slice(0, 5)) {
        sections.push(
          `  ${w.marketTitle}: ${w.contracts} contracts ${w.takerSide.toUpperCase()} ($${w.notionalUsd.toFixed(0)} notional)`,
        );
      }
      sections.push(
        "Interpret whale flow as institutional conviction signals — large directional bets indicate smart money positioning.",
      );
    }
    if (
      data.kalshiData.macroMarketPrices &&
      Object.keys(data.kalshiData.macroMarketPrices).length > 0
    ) {
      sections.push("\n=== KALSHI MACRO ODDS ===");
      for (const [ticker, price] of Object.entries(
        data.kalshiData.macroMarketPrices,
      )) {
        sections.push(`  ${ticker}: ${(price * 100).toFixed(1)}% YES`);
      }
    }
  }

  if (data.marketContext) {
    sections.push(`\n=== CONTEXT ===\n${data.marketContext}`);
  }

  sections.push(
    "\nIdentify convergences and divergences. Where are markets mispricing risk?",
  );
  return sections.join("\n");
}

// --- Mock Data ---

function getMockPMAData(): PMAInput {
  return {
    polymarketData: {
      fedCutProb: 0.35,
      recessionProb: 0.18,
    },
    macroData: {
      latestCpi: 2.9,
      fedFundsRate: 4.5,
      gdpGrowth: 2.1,
      unemploymentRate: 3.9,
    },
    cryptoData: {
      btcPrice: 87500,
      btcChange24h: 1.2,
      btcSpxCorrelation: 0.62,
    },
  };
}
