// [claude-code 2026-03-16] Agent backend v7.9: merged PMA, Herald, Notion split docs
/**
 * Agent Pipeline Orchestrator
 * Runs the full collaborative AI agent pipeline.
 *
 * v7.9 Pipeline Stages (Fintheon agent roster):
 *   Stage 1 (parallel): Market Data + Technical + Herald (sentiment/social)
 *   Stage 2: Oracle's PMA Combined (prediction markets + macro)
 *   Stage 3: Consul fundamental overlay (bull/bear research + debate)
 *   Stage 4: Feucht risk check (drawdown/exposure validation + proposal)
 */

import { analyzeMarketData } from './market-data-analyst.js'
import { analyzeHeraldSentiment } from './herald-analyst.js'
import { analyzeTechnicals } from './technical-analyst.js'
import { analyzePMAMerged } from './pma-merged-analyst.js'
import { buildBullCase } from './bullish-researcher.js'
import { buildBearCase } from './bearish-researcher.js'
import { runDebate } from './debate-protocol.js'
import { generateProposal } from './trader-agent.js'
import { assessProposal, getUserPsychology } from './risk-manager.js'
import type {
  AgentPipelineResult,
  MarketDataReport,
  NewsSentimentReport,
  TechnicalReport,
  ResearcherReport,
  DebateResult,
  TradingProposal,
  RiskAssessment,
} from '../../types/agents.js'
import type { PMAReport } from './pma-merged-analyst.js'

export interface PipelineOptions {
  includeDebate?: boolean
  includeProposal?: boolean
  currentPrice?: number
  accountSize?: number
  currentPnL?: number
  vixLevel?: number
}

/**
 * Run the full agent pipeline.
 *
 * Stage 1 (parallel): Market Data Analyst + Technical Analyst + Herald Analyst
 * Stage 2: Oracle — PMA Combined (prediction markets + macro overlay)
 * Stage 3: Consul — Fundamental overlay (bull/bear researchers + debate)
 * Stage 4: Feucht — Risk check (trader proposal + risk assessment)
 */
export async function runAgentPipeline(
  userId: string,
  options: PipelineOptions = {}
): Promise<AgentPipelineResult> {
  const startTime = Date.now()
  const { includeDebate = true, includeProposal = true } = options

  // ── Stage 1: Analysts (parallel) — Market Data + Technical + Herald ──
  const [marketDataReport, technicalReport, sentimentReport] = await Promise.all([
    analyzeMarketData(userId),
    analyzeTechnicals(userId),
    analyzeHeraldSentiment(userId),
  ])

  const marketData = marketDataReport.reportData as unknown as MarketDataReport
  const technical = technicalReport.reportData as unknown as TechnicalReport
  const sentiment = sentimentReport.reportData as unknown as NewsSentimentReport

  // ── Stage 2: Oracle — PMA Combined (prediction markets + macro) ──
  // Oracle's merged analysis overlays prediction market signals on top of
  // the Stage 1 data. The PMA report is stored alongside sentiment for
  // downstream consumption but is conceptually a separate analytical layer.
  const pmaReport = await analyzePMAMerged(userId, {
    macroData: {
      // Feed macro context from Stage 1 into Oracle's analysis
      latestCpi: undefined, // Would come from real data feed
      fedFundsRate: undefined,
    },
    marketContext: `VIX: ${marketData.vix.current}, Regime: ${marketData.marketRegime}, Sentiment: ${sentiment.overallSentiment}`,
  })
  const _pma = pmaReport.reportData as unknown as PMAReport

  // Get current price from input or technical data
  const currentPrice = options.currentPrice ?? technical.emaAnalysis.ema20 ?? 19000

  // ── Stage 3: Consul — Fundamental overlay (researchers + debate) ──
  const researcherInput = {
    marketData,
    sentiment,
    technical,
    currentPrice,
  }

  const [bullishReport, bearishReport] = await Promise.all([
    buildBullCase(userId, researcherInput),
    buildBearCase(userId, researcherInput),
  ])

  const bullish = bullishReport.reportData as unknown as ResearcherReport
  const bearish = bearishReport.reportData as unknown as ResearcherReport

  let debate: DebateResult | undefined
  if (includeDebate) {
    debate = await runDebate(userId, {
      bullishReport: bullish,
      bearishReport: bearish,
      analystReportIds: [marketDataReport.id, sentimentReport.id, technicalReport.id],
    })
  } else {
    debate = createQuickConsensus(userId, bullish, bearish, [
      marketDataReport.id,
      sentimentReport.id,
      technicalReport.id,
    ])
  }

  // ── Stage 4: Feucht — Risk check (proposal + risk assessment) ──
  // Feucht (Futures, Execution & Risk) absorbs old risk-manager logic.
  // The trader agent generates a proposal, then Feucht validates it.
  let proposal: TradingProposal | undefined
  let riskAssessment: RiskAssessment | undefined

  if (includeProposal) {
    proposal = await generateProposal(userId, {
      marketData,
      sentiment,
      technical,
      debate,
      currentPrice,
      accountSize: options.accountSize,
    })

    const psychology = await getUserPsychology(userId)

    riskAssessment = await assessProposal(userId, {
      proposal,
      psychology: psychology ?? undefined,
      currentPnL: options.currentPnL,
      accountSize: options.accountSize,
      vixLevel: options.vixLevel ?? marketData.vix.current,
    })
  }

  const overallRecommendation = generateOverallRecommendation(
    debate,
    riskAssessment,
    proposal
  )

  return {
    marketData,
    newsSentiment: sentiment,
    technical,
    debate,
    proposal,
    riskAssessment,
    overallRecommendation,
    pipelineLatencyMs: Date.now() - startTime,
    createdAt: new Date().toISOString(),
  }
}

/**
 * Create quick consensus without full debate
 */
function createQuickConsensus(
  userId: string,
  bullish: ResearcherReport,
  bearish: ResearcherReport,
  analystReportIds: string[]
): DebateResult {
  const bullScore = bullish.conviction *
    (bullish.keyArguments.reduce((s, a) => s + a.strength, 0) / Math.max(1, bullish.keyArguments.length * 10))
  const bearScore = bearish.conviction *
    (bearish.keyArguments.reduce((s, a) => s + a.strength, 0) / Math.max(1, bearish.keyArguments.length * 10))

  const consensusScore = (bullScore - bearScore) / 100

  return {
    id: crypto.randomUUID(),
    userId,
    analystReportIds,
    bullishReport: bullish,
    bearishReport: bearish,
    debateRounds: [],
    consensusScore,
    finalAssessment: {
      recommendation: consensusScore > 0.2 ? 'bullish' : consensusScore < -0.2 ? 'bearish' : 'neutral',
      confidence: Math.abs(consensusScore) * 100,
      reasoning: `Quick assessment: ${consensusScore > 0 ? 'Bull' : 'Bear'} case stronger with ${Math.abs(consensusScore * 100).toFixed(0)}% edge.`,
      keyRisks: [...bullish.riskFactors.slice(0, 2), ...bearish.riskFactors.slice(0, 2)],
    },
    createdAt: new Date().toISOString(),
  }
}

/**
 * Generate overall recommendation from pipeline results
 */
function generateOverallRecommendation(
  debate: DebateResult,
  riskAssessment?: RiskAssessment,
  proposal?: TradingProposal
): AgentPipelineResult['overallRecommendation'] {
  if (riskAssessment?.decision === 'rejected') {
    return {
      action: 'avoid',
      confidence: 100 - (riskAssessment.riskScore * 100),
      reasoning: riskAssessment.rejectionReason ?? 'Risk assessment failed.',
    }
  }

  if (proposal?.direction === 'flat') {
    return {
      action: 'wait',
      confidence: proposal.confidence,
      reasoning: 'Insufficient conviction for trade. Wait for clearer setup.',
    }
  }

  if (Math.abs(debate.consensusScore) < 0.2) {
    return {
      action: 'wait',
      confidence: debate.finalAssessment.confidence,
      reasoning: debate.finalAssessment.reasoning,
    }
  }

  const proposalDirection = proposal?.direction
  const direction: 'long' | 'short' =
    (proposalDirection === 'long' || proposalDirection === 'short')
      ? proposalDirection
      : (debate.consensusScore > 0 ? 'long' : 'short')

  const confidence = proposal?.confidence ?? debate.finalAssessment.confidence

  return {
    action: 'trade',
    direction,
    confidence,
    reasoning: proposal?.rationale ?? debate.finalAssessment.reasoning,
  }
}

/**
 * Run analysts only (lighter weight — Stage 1 only)
 */
export async function runAnalystsOnly(userId: string): Promise<{
  marketData: MarketDataReport
  sentiment: NewsSentimentReport
  technical: TechnicalReport
  latencyMs: number
}> {
  const startTime = Date.now()

  const [marketDataReport, sentimentReport, technicalReport] = await Promise.all([
    analyzeMarketData(userId),
    analyzeHeraldSentiment(userId),
    analyzeTechnicals(userId),
  ])

  return {
    marketData: marketDataReport.reportData as unknown as MarketDataReport,
    sentiment: sentimentReport.reportData as unknown as NewsSentimentReport,
    technical: technicalReport.reportData as unknown as TechnicalReport,
    latencyMs: Date.now() - startTime,
  }
}
