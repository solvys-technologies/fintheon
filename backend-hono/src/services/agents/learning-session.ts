// [codex 2026-05-17] Post-analysis learning capture for Fintheon agents.
import { addMemory } from "../agent-memory/memory-store.js";
import type { AgentId } from "../agent-memory/types.js";
import { clearAgentSystemPromptCache } from "../ai/agent-instructions/index.js";
import { recordAgentReflection } from "../ai/agent-instructions/fileroom-prompt-vault.js";
import type {
  AgentPipelineResult,
  MarketDataReport,
  NewsSentimentReport,
  TechnicalReport,
} from "../../types/agents.js";

interface QuickAnalysisResult {
  marketData: MarketDataReport;
  sentiment: NewsSentimentReport;
  technical: TechnicalReport;
  latencyMs: number;
}

interface LearningNote {
  agentId: AgentId;
  topic: string;
  insight: string;
  confidence: number;
  metadata?: Record<string, unknown>;
}

function scoreConfidence(value: number | undefined, fallback = 0.7): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  const normalized = value > 1 ? value / 100 : value;
  return Math.min(1, Math.max(0.1, normalized));
}

function compactList(items: string[], limit = 3): string {
  return items.filter(Boolean).slice(0, limit).join("; ");
}

function notesFromSharedAnalysis(
  result: QuickAnalysisResult,
  source: string,
): LearningNote[] {
  const notes: LearningNote[] = [];
  const headlines = result.sentiment.topHeadlines ?? [];
  const catalysts = result.sentiment.catalysts ?? [];

  if (
    result.sentiment.breakingNewsDetected ||
    result.sentiment.macroLevel >= 3
  ) {
    notes.push({
      agentId: "herald",
      topic: "headline-risk-analysis",
      insight:
        `Analysis found macro level ${result.sentiment.macroLevel} headline risk with ` +
        `${headlines.length} top headline(s). Watch pattern: ${
          compactList(headlines.map((h) => `${h.source}: ${h.headline}`)) ||
          result.sentiment.summary
        }`,
      confidence: Math.max(0.72, Math.abs(result.sentiment.sentimentScore)),
      metadata: { source, macroLevel: result.sentiment.macroLevel },
    });
  }

  if (catalysts.length > 0) {
    notes.push({
      agentId: "harper",
      topic: "catalyst-synthesis",
      insight:
        `Analysis surfaced ${catalysts.length} catalyst(s): ` +
        compactList(
          catalysts.map((c) => `${c.event} (${c.impact}/${c.direction})`),
        ),
      confidence: 0.75,
      metadata: { source, catalystCount: catalysts.length },
    });
  }

  if (
    result.marketData.vix.level === "elevated" ||
    result.marketData.vix.level === "high" ||
    result.marketData.vix.level === "extreme"
  ) {
    notes.push({
      agentId: "feucht",
      topic: "volatility-regime",
      insight:
        `VIX registered ${result.marketData.vix.current} (${result.marketData.vix.level}) ` +
        `while technical bias was ${result.technical.tradingBias}. Future risk checks should tighten size before approving intraday trades.`,
      confidence: 0.76,
      metadata: { source, vix: result.marketData.vix.current },
    });
  }

  if (result.technical.keyPatterns.length > 0) {
    notes.push({
      agentId: "oracle",
      topic: "technical-prior",
      insight:
        `Technical analysis found ${result.technical.tradingBias} bias with patterns: ` +
        compactList(result.technical.keyPatterns),
      confidence: scoreConfidence(result.technical.trend.strength),
      metadata: { source, trendStrength: result.technical.trend.strength },
    });
  }

  return notes;
}

function notesFromFullAnalysis(result: AgentPipelineResult): LearningNote[] {
  const notes = notesFromSharedAnalysis(
    {
      marketData: result.marketData,
      sentiment: result.newsSentiment,
      technical: result.technical,
      latencyMs: result.pipelineLatencyMs,
    },
    "agents.full-analysis",
  );

  if (result.debate && Math.abs(result.debate.consensusScore) >= 0.35) {
    notes.push({
      agentId: "consul",
      topic: "debate-consensus",
      insight:
        `Debate produced ${result.debate.finalAssessment.recommendation} consensus ` +
        `(${result.debate.consensusScore.toFixed(2)}): ${result.debate.finalAssessment.reasoning}`,
      confidence: scoreConfidence(result.debate.finalAssessment.confidence),
      metadata: { source: "agents.full-analysis", debateId: result.debate.id },
    });
  }

  if (result.riskAssessment?.decision === "rejected") {
    notes.push({
      agentId: "feucht",
      topic: "risk-rejection",
      insight:
        `Rejected proposal with risk score ${result.riskAssessment.riskScore.toFixed(2)}. ` +
        `${result.riskAssessment.rejectionReason ?? compactList(result.riskAssessment.issues.map((i) => i.description))}`,
      confidence: 0.86,
      metadata: {
        source: "agents.full-analysis",
        decision: result.riskAssessment.decision,
        riskScore: result.riskAssessment.riskScore,
      },
    });
  }

  if (result.overallRecommendation.action !== "trade") {
    notes.push({
      agentId: "harper",
      topic: "no-trade-discipline",
      insight: `Analysis ended with ${result.overallRecommendation.action}: ${result.overallRecommendation.reasoning}`,
      confidence: scoreConfidence(result.overallRecommendation.confidence),
      metadata: { source: "agents.full-analysis" },
    });
  }

  return notes;
}

async function storeNotes(notes: LearningNote[]): Promise<number> {
  const unique = new Map<string, LearningNote>();
  for (const note of notes) {
    unique.set(`${note.agentId}:${note.topic}:${note.insight}`, note);
  }

  const writes = await Promise.all(
    [...unique.values()].map(async (note) => {
      const memory = await addMemory({
        agentId: note.agentId,
        memoryType: "learned_pattern",
        content: `${note.topic}: ${note.insight}`,
        metadata: {
          source: "analysis.learning-session",
          confidence: note.confidence,
          topic: note.topic,
          ...(note.metadata ?? {}),
        },
      });
      if (memory) {
        await recordAgentReflection({
          agentId: note.agentId,
          topic: note.topic,
          insight: note.insight,
          confidence: note.confidence,
          metadata: note.metadata,
        }).catch(() => null);
      }
      return memory;
    }),
  );

  if (writes.some(Boolean)) clearAgentSystemPromptCache();
  return writes.filter(Boolean).length;
}

export async function captureFullAnalysisLearning(
  result: AgentPipelineResult,
): Promise<number> {
  return storeNotes(notesFromFullAnalysis(result));
}

export async function captureQuickAnalysisLearning(
  result: QuickAnalysisResult,
): Promise<number> {
  return storeNotes(notesFromSharedAnalysis(result, "agents.quick-analysis"));
}
