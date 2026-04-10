// [claude-code 2026-03-11] Signal processor — routes incoming signals through fast or full pipeline based on confidence

/**
 * Signal Processor
 * Routes incoming signals through fast or full pipeline based on confidence
 */

import { assessProposal, getUserPsychology } from "../agents/risk-manager.js";
import { runAgentPipeline } from "../agents/pipeline.js";
import {
  createProposal,
  acknowledgeProposal,
  executeProposal,
} from "./proposal-service.js";
import type {
  SignalEvent,
  TradingProposal,
  RiskAssessment,
  AgentPipelineResult,
} from "../../types/agents.js";

// In-memory signal log
const signalLog: Array<
  SignalEvent & { processedAt: string; result: string; proposalId?: string }
> = [];
const MAX_SIGNAL_LOG = 100;

// Daily trade counter (resets at midnight EST)
let tradesToday = 0;
let lastTradeDate = "";

function resetDailyCounterIfNeeded() {
  const estNow = new Date().toLocaleDateString("en-US", {
    timeZone: "America/New_York",
  });
  if (estNow !== lastTradeDate) {
    tradesToday = 0;
    lastTradeDate = estNow;
  }
}

const MAX_TRADES_PER_DAY = 3;
const AUTO_EXECUTE_RISK_THRESHOLD = 0.3;
const HIGH_CONFIDENCE_THRESHOLD = 80;

export async function processSignal(
  signal: SignalEvent,
  userId: string = "system",
): Promise<{
  path: "fast" | "full" | "rejected";
  proposalId?: string;
  autoExecuted?: boolean;
  reason?: string;
}> {
  resetDailyCounterIfNeeded();

  // Enforce daily trade limit
  if (tradesToday >= MAX_TRADES_PER_DAY) {
    logSignal(signal, "rejected_daily_limit");
    return {
      path: "rejected",
      reason: `Daily trade limit reached (${MAX_TRADES_PER_DAY})`,
    };
  }

  if (signal.confidence >= HIGH_CONFIDENCE_THRESHOLD) {
    return processFastPath(signal, userId);
  } else {
    return processFullPath(signal, userId);
  }
}

async function processFastPath(
  signal: SignalEvent,
  userId: string,
): Promise<{
  path: "fast";
  proposalId?: string;
  autoExecuted?: boolean;
  reason?: string;
}> {
  console.log(
    `[AutoPilot] Fast path: ${signal.strategy} ${signal.direction} @ ${signal.entryPrice} (confidence: ${signal.confidence}%)`,
  );

  // Build a TradingProposal from signal
  const proposal = buildProposalFromSignal(signal, userId);

  // Run risk assessment only (skip debate)
  const psychology = await getUserPsychology(userId).catch(() => null);
  const assessment = await assessProposal(userId, {
    proposal,
    psychology: psychology ?? undefined,
  });

  if (assessment.decision === "rejected") {
    logSignal(signal, "rejected_risk", undefined);
    return {
      path: "fast",
      reason: assessment.rejectionReason ?? "Risk manager rejected",
    };
  }

  // Create stored proposal
  const pipelineResult: AgentPipelineResult = {
    marketData: {
      vix: { current: 0, change: 0, level: "normal" },
      es: { price: 0, change: 0, percentChange: 0 },
      nq: { price: signal.entryPrice, change: 0, percentChange: 0 },
      treasuryYields: { twoYear: 0, tenYear: 0, spread: 0 },
      marketRegime: "risk_on",
      keyLevels: { support: [], resistance: [] },
      summary: "Signal-driven",
    },
    newsSentiment: {
      overallSentiment: "neutral",
      sentimentScore: 0,
      macroLevel: 1,
      breakingNewsDetected: false,
      topHeadlines: [],
      catalysts: [],
      riskEvents: [],
      summary: "Signal-driven",
    },
    technical: {
      trend: { daily: "neutral", hourly: "neutral", strength: 50 },
      emaAnalysis: {
        ema20: 0,
        ema50: 0,
        ema100: 0,
        ema200: 0,
        priceVsEmas: "mixed",
      },
      vwapAnalysis: { dailyVwap: 0, priceVsVwap: "at" },
      volumeProfile: { currentVsAvg: "normal", volumeTrend: "stable" },
      keyPatterns: signal.signals,
      tradingBias: signal.direction === "long" ? "bullish" : "bearish",
      summary: "Signal-driven",
    },
    debate: {
      id: "signal-fast-path",
      userId,
      analystReportIds: [],
      bullishReport: {
        thesis: "Signal-driven",
        conviction: signal.confidence,
        keyArguments: [],
        riskFactors: [],
        catalysts: [],
        summary: "",
      },
      bearishReport: {
        thesis: "",
        conviction: 0,
        keyArguments: [],
        riskFactors: [],
        catalysts: [],
        summary: "",
      },
      debateRounds: [],
      consensusScore: signal.direction === "long" ? 0.5 : -0.5,
      finalAssessment: {
        recommendation: signal.direction === "long" ? "bullish" : "bearish",
        confidence: signal.confidence,
        reasoning: `Signal: ${signal.signals.join(", ")}`,
        keyRisks: [],
      },
      createdAt: new Date().toISOString(),
    },
    proposal,
    riskAssessment: assessment,
    overallRecommendation: {
      action: "trade",
      direction: signal.direction,
      confidence: signal.confidence,
      reasoning: `Auto-signal: ${signal.signals.join(", ")}`,
    },
    pipelineLatencyMs: 0,
    createdAt: new Date().toISOString(),
  };

  const storedProposal = await createProposal(userId, pipelineResult);

  // Auto-execute if risk is low enough
  if (assessment.riskScore < AUTO_EXECUTE_RISK_THRESHOLD) {
    await acknowledgeProposal(storedProposal.id, "approved", userId);
    const execResult = await executeProposal(storedProposal.id, userId);
    if (execResult.success) {
      tradesToday++;
      logSignal(signal, "auto_executed", storedProposal.id);
      return {
        path: "fast",
        proposalId: storedProposal.id,
        autoExecuted: true,
      };
    }
    logSignal(signal, "execution_failed", storedProposal.id);
    return {
      path: "fast",
      proposalId: storedProposal.id,
      autoExecuted: false,
      reason: execResult.error,
    };
  }

  // Risk too high for auto — send to UI
  logSignal(signal, "pending_approval", storedProposal.id);
  return {
    path: "fast",
    proposalId: storedProposal.id,
    autoExecuted: false,
    reason: "Risk score above auto-execute threshold",
  };
}

async function processFullPath(
  signal: SignalEvent,
  userId: string,
): Promise<{
  path: "full";
  proposalId?: string;
  autoExecuted?: boolean;
  reason?: string;
}> {
  console.log(
    `[AutoPilot] Full path: ${signal.strategy} ${signal.direction} @ ${signal.entryPrice} (confidence: ${signal.confidence}%)`,
  );

  try {
    const pipelineResult = await runAgentPipeline(userId, {
      includeDebate: true,
      includeProposal: true,
      currentPrice: signal.entryPrice,
    });

    if (!pipelineResult.proposal?.tradeRecommended) {
      logSignal(signal, "pipeline_no_trade");
      return { path: "full", reason: "Pipeline did not recommend trade" };
    }

    if (pipelineResult.riskAssessment?.decision === "rejected") {
      logSignal(signal, "pipeline_rejected");
      return {
        path: "full",
        reason:
          pipelineResult.riskAssessment.rejectionReason ??
          "Pipeline risk rejection",
      };
    }

    const storedProposal = await createProposal(userId, pipelineResult);
    logSignal(signal, "pending_approval", storedProposal.id);
    return { path: "full", proposalId: storedProposal.id, autoExecuted: false };
  } catch (error) {
    console.error("[AutoPilot] Full path error:", error);
    logSignal(signal, "pipeline_error");
    return { path: "full", reason: "Pipeline execution error" };
  }
}

function buildProposalFromSignal(
  signal: SignalEvent,
  userId: string,
): TradingProposal {
  const risk = Math.abs(signal.entryPrice - signal.stopLoss);
  const reward =
    signal.takeProfit.length > 0
      ? Math.abs(signal.takeProfit[0] - signal.entryPrice)
      : risk * 1.5;

  return {
    id: crypto.randomUUID(),
    userId,
    tradeRecommended: true,
    strategyName: signal.strategy,
    instrument: signal.instrument,
    direction: signal.direction,
    entryPrice: signal.entryPrice,
    stopLoss: signal.stopLoss,
    takeProfit: signal.takeProfit,
    positionSize: 1, // 1 contract default
    riskRewardRatio: reward / risk,
    confidence: signal.confidence,
    rationale: `Signal-driven: ${signal.signals.join(", ")}${signal.htfContext ? ` | HTF: ${signal.htfContext}` : ""}${signal.rsiValue ? ` | RSI: ${signal.rsiValue.toFixed(1)}` : ""}`,
    analystInputs: {
      marketData: `Entry: ${signal.entryPrice}, Stop: ${signal.stopLoss}`,
      sentiment: `Source: ${signal.source}`,
      technical: `Signals: ${signal.signals.join(", ")}`,
      researchConsensus: `Confidence: ${signal.confidence}%, Session: ${signal.sessionWindow ?? "unknown"}`,
    },
    timeframe: "intraday",
    setupType: signal.signals.join(" + "),
    createdAt: new Date().toISOString(),
  };
}

function logSignal(signal: SignalEvent, result: string, proposalId?: string) {
  signalLog.unshift({
    ...signal,
    processedAt: new Date().toISOString(),
    result,
    proposalId,
  });
  if (signalLog.length > MAX_SIGNAL_LOG) signalLog.pop();
}

export function getRecentSignals(limit: number = 50) {
  return signalLog.slice(0, limit);
}

export function getSignalStats() {
  resetDailyCounterIfNeeded();
  return {
    tradesToday,
    maxTradesPerDay: MAX_TRADES_PER_DAY,
    totalSignalsLogged: signalLog.length,
  };
}
