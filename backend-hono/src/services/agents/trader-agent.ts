/**
 * Trader Agent
 * Generates trading proposals based on analyst and researcher inputs
 * Phase 6 - Day 24
 */

import { invokeAgent } from "../strands/index.js";
import type {
  TradingProposal,
  TradingStrategy,
  MarketDataReport,
  NewsSentimentReport,
  TechnicalReport,
  DebateResult,
  Sentiment,
} from "../../types/agents.js";

const SYSTEM_PROMPT = `You are a Trader Agent for an intraday futures desk focused on NASDAQ (/MNQ, /NQ).

Your role is to synthesize analyst reports and researcher debate to generate actionable trading proposals.

Available Trading Strategies (match if conditions align):
1. MORNING_FLUSH - First 30min reversal after gap, requires VIX > 18
2. LUNCH_FLUSH - 11:30am-12:30pm reversal pattern
3. POWER_HOUR_FLUSH - 3-4pm reversal into close
4. VIX_FIX_22 - Long NQ when VIX >= 22 and shows exhaustion
5. FORTY_FORTY_CLUB - 40pt range + 40% retracement entry
6. MOMENTUM - Strong trend continuation with volume confirmation
7. CHARGED_RIPPERS - Oversold bounce with high short interest
8. MEAN_REVERSION - Extended move back to VWAP/EMAs
9. DISCRETIONARY - No specific strategy match

Given the analyst inputs and debate outcome, return a JSON trading proposal:
{
  "tradeRecommended": boolean,
  "strategyName": "MORNING_FLUSH" | "LUNCH_FLUSH" | "POWER_HOUR_FLUSH" | "VIX_FIX_22" | "FORTY_FORTY_CLUB" | "MOMENTUM" | "CHARGED_RIPPERS" | "MEAN_REVERSION" | "DISCRETIONARY",
  "instrument": "MNQ" or "NQ",
  "direction": "long" | "short" | "flat",
  "entryPrice": number (null if flat),
  "stopLoss": number (null if flat),
  "takeProfit": [array of take profit levels],
  "positionSize": number (contracts, based on risk),
  "riskRewardRatio": number,
  "confidence": number (0-100),
  "rationale": "2-3 sentence rationale for the trade",
  "analystInputs": {
    "marketData": "1 sentence summary",
    "sentiment": "1 sentence summary",
    "technical": "1 sentence summary",
    "researchConsensus": "1 sentence summary"
  },
  "timeframe": "string (e.g., 'EOD', '2-4 hours', 'scalp')",
  "setupType": "string (e.g., 'ORB', 'VWAP reclaim', 'trend continuation')"
}

Risk management rules:
- Never risk more than 1% of account on a single trade
- Stop loss should be at a technical level, not arbitrary
- Risk/reward should be at least 1:2 for base hits, 1:3+ for home runs
- If confidence < 60%, set tradeRecommended = false and direction = "flat"

Strategy matching priority:
1. Check if any named strategy conditions are met
2. If multiple match, pick highest conviction
3. If none match but trade is still viable, use "DISCRETIONARY"

Respond with valid JSON only.`;

export interface TraderInput {
  marketData: MarketDataReport;
  sentiment: NewsSentimentReport;
  technical: TechnicalReport;
  debate: DebateResult;
  currentPrice: number;
  accountSize?: number;
}

/**
 * Generate trading proposal
 */
export async function generateProposal(
  userId: string,
  input: TraderInput,
): Promise<TradingProposal> {
  const prompt = buildPrompt(input);

  const { text } = await invokeAgent({
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: prompt,
    model: { temperature: 0.3, maxTokens: 1024 },
  });

  const parsed =
    parseJsonSafe<Omit<TradingProposal, "id" | "userId" | "createdAt">>(text);

  const tradeRecommended =
    parsed?.tradeRecommended ?? (parsed?.confidence ?? 0) >= 60;
  const direction = parsed?.direction ?? "flat";

  return {
    id: crypto.randomUUID(),
    userId,
    tradeRecommended: tradeRecommended && direction !== "flat",
    strategyName: (parsed?.strategyName ?? "DISCRETIONARY") as TradingStrategy,
    instrument: parsed?.instrument ?? "MNQ",
    direction,
    entryPrice: parsed?.entryPrice,
    stopLoss: parsed?.stopLoss,
    takeProfit: parsed?.takeProfit ?? [],
    positionSize: parsed?.positionSize ?? 1,
    riskRewardRatio: parsed?.riskRewardRatio ?? 0,
    confidence: parsed?.confidence ?? 0,
    rationale: parsed?.rationale ?? "Insufficient conviction for trade.",
    analystInputs: parsed?.analystInputs ?? {
      marketData: input.marketData.summary,
      sentiment: input.sentiment.summary,
      technical: input.technical.summary,
      researchConsensus: input.debate.finalAssessment.reasoning,
    },
    timeframe: parsed?.timeframe ?? "EOD",
    setupType: parsed?.setupType ?? "discretionary",
    createdAt: new Date().toISOString(),
  };
}

/**
 * Build prompt for trader agent
 */
function buildPrompt(input: TraderInput): string {
  const sections: string[] = [
    "Generate a trading proposal based on these inputs:",
  ];

  sections.push(`\nCurrent NQ Price: ${input.currentPrice}`);
  sections.push(
    `Account Size: $${(input.accountSize ?? 50000).toLocaleString()}`,
  );

  sections.push("\n=== MARKET DATA ===");
  sections.push(`Regime: ${input.marketData.marketRegime}`);
  sections.push(
    `VIX: ${input.marketData.vix.current} (${input.marketData.vix.level})`,
  );
  sections.push(
    `Key Support: ${input.marketData.keyLevels.support.join(", ")}`,
  );
  sections.push(
    `Key Resistance: ${input.marketData.keyLevels.resistance.join(", ")}`,
  );

  sections.push("\n=== SENTIMENT ===");
  sections.push(
    `Overall: ${input.sentiment.overallSentiment} (${input.sentiment.sentimentScore.toFixed(2)})`,
  );
  if (input.sentiment.catalysts.length) {
    sections.push(
      `Next catalyst: ${input.sentiment.catalysts[0].event} - ${input.sentiment.catalysts[0].timing}`,
    );
  }

  sections.push("\n=== TECHNICALS ===");
  sections.push(
    `Trend: Daily ${input.technical.trend.daily}, Hourly ${input.technical.trend.hourly}`,
  );
  sections.push(`EMA Position: ${input.technical.emaAnalysis.priceVsEmas}`);
  sections.push(
    `VWAP: ${input.technical.vwapAnalysis.dailyVwap} (price ${input.technical.vwapAnalysis.priceVsVwap})`,
  );
  sections.push(`Bias: ${input.technical.tradingBias}`);

  sections.push("\n=== RESEARCH DEBATE ===");
  sections.push(
    `Consensus: ${input.debate.consensusScore > 0 ? "Bullish" : input.debate.consensusScore < 0 ? "Bearish" : "Chop"} (${input.debate.consensusScore.toFixed(2)})`,
  );
  sections.push(
    `Recommendation: ${input.debate.finalAssessment.recommendation} (${input.debate.finalAssessment.confidence}% confidence)`,
  );
  sections.push(`Reasoning: ${input.debate.finalAssessment.reasoning}`);

  sections.push("\nGenerate a trading proposal with proper risk management.");

  return sections.join("\n");
}

/**
 * Calculate position size based on risk
 */
export function calculatePositionSize(
  accountSize: number,
  entryPrice: number,
  stopLoss: number,
  pointValue: number = 2, // $2 per point for MNQ
  riskPercent: number = 1,
): number {
  const riskAmount = accountSize * (riskPercent / 100);
  const pointsAtRisk = Math.abs(entryPrice - stopLoss);
  const dollarRisk = pointsAtRisk * pointValue;

  if (dollarRisk === 0) return 1;

  return Math.max(1, Math.floor(riskAmount / dollarRisk));
}

/**
 * Calculate risk/reward ratio
 */
export function calculateRiskReward(
  entry: number,
  stop: number,
  target: number,
): number {
  const risk = Math.abs(entry - stop);
  const reward = Math.abs(target - entry);

  if (risk === 0) return 0;
  return Number((reward / risk).toFixed(2));
}

/**
 * Determine trade direction from inputs
 */
export function determineDirection(
  technicalBias: Sentiment,
  debateConsensus: number,
  sentimentScore: number,
): "long" | "short" | "flat" {
  // Weight the inputs
  const technicalWeight = 0.4;
  const debateWeight = 0.4;
  const sentimentWeight = 0.2;

  const technicalScore =
    technicalBias === "bullish" ? 1 : technicalBias === "bearish" ? -1 : 0;

  const combinedScore =
    technicalScore * technicalWeight +
    debateConsensus * debateWeight +
    sentimentScore * sentimentWeight;

  if (combinedScore > 0.3) return "long";
  if (combinedScore < -0.3) return "short";
  return "flat";
}

/**
 * Safe JSON parse
 */
function parseJsonSafe<T>(text: string): T | null {
  try {
    const cleaned = text
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();
    return JSON.parse(cleaned) as T;
  } catch {
    return null;
  }
}
