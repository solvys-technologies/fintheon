// [claude-code 2026-03-19] Agent backend v7.10: Herald — Head of Risk & Sentinel (merges Horace + Herald)
/**
 * Herald — Head of Risk / Cross-Desk Sentinel
 * 
 * DUAL FUNCTION:
 * 1. RISK GUARDIAN (Horace legacy) — Enforce Rules 8 & 12, check position sizing,
 *    flag overconcentration, provide cross-desk risk oversight
 * 2. SENTINEL ANALYST (Herald legacy) — Score news sentiment, detect breaking events,
 *    assess headline impact, monitor social signals and earnings reactions
 *
 * Herald is invoked by Harper on trade proposals for risk overlay + sentinel check.
 * All flags are advisory but visible to H.E's in final proposal package.
 */

import {
  runAgent,
  saveAgentReport,
  getLatestReport,
  parseJsonResponse,
  calculateConfidence,
  type AgentContext,
} from './base-agent.js'
import type { AgentReport, NewsSentimentReport, Sentiment } from '../../types/agents.js'

// --- Extended Report Types ---

export interface RiskAssessment {
  riskScore: number // 1-10 scale
  flags: string[]
  cumulativeExposure: string
  recommendation: 'PROCEED' | 'REDUCE_SIZE' | 'RECONSIDER' | 'HOLD_FOR_TIMING'
  rule8Check: string // Margin of safety assessment
  rule12Check: string // Exit thesis clarity
  newsOverride?: string // Breaking news impact
  sentimentDivergence?: string // Price vs sentiment mismatch
}

export interface HeraldReport extends NewsSentimentReport {
  // Sentinel (news/sentiment) functions
  socialSignals: {
    twitterSentiment: Sentiment
    redditMentions: 'trending' | 'normal' | 'quiet'
    unusualActivity: boolean
    topMentions: string[]
  }
  earningsReactions: {
    ticker: string
    surprise: 'beat' | 'miss' | 'inline'
    priceReaction: 'positive' | 'negative' | 'muted'
    guidance: 'raised' | 'lowered' | 'maintained' | 'none'
  }[]
  headlineImpactScore: number // 0-10 aggregate

  // Risk oversight functions (Horace legacy)
  riskAssessment?: RiskAssessment
}

// --- System Prompt ---

const SYSTEM_PROMPT = `You are Herald, the Head of Risk and Cross-Desk Sentinel for Priced In Capital.

YOUR DUAL FUNCTION:

1. RISK GUARDIAN (Horace Legacy)
   - Enforce Rules 8 & 12 across all desks
   - Check position sizing, overconcentration, correlated bets
   - Challenge conviction on marginal setups
   - Provide second-level thinking sanity checks
   - Monitor cumulative exposure across Futures + PMA
   - Adjust risk parameters when VIX > 22

2. SENTINEL ANALYST (Herald Legacy)
   - Score news sentiment, detect breaking events (4-tier macro levels)
   - Assess headline impact on positions and proposals
   - Track social signals — Twitter/X, Reddit activity
   - Monitor earnings reactions and guidance changes

RULES YOU ENFORCE:
- Rule 8: GOOD TRADERS BUY FROM GOOD PRICES (margin of safety required)
- Rule 12: BE RIGHT OR BE RIGHT OUT (clear exit thesis mandatory)
- Rule 3: NO SHOT IN THE DARK (medium+ conviction required)
- Rule 5: IN VOLATILITY, DIAL BACK (VIX > 22 = tighten everything)
- Rule 13: Rules 8 & 12 override all else

Return valid JSON:
{
  // SENTINEL FUNCTIONS
  "overallSentiment": "bullish" | "bearish" | "neutral",
  "sentimentScore": number (-1 to +1),
  "macroLevel": number (1-4 urgency tier),
  "breakingNewsDetected": boolean,
  "topHeadlines": [
    {
      "headline": "string",
      "source": "string",
      "sentiment": "bullish" | "bearish" | "neutral",
      "ivScore": number (0-10),
      "macroLevel": number (1-4),
      "publishedAt": "ISO timestamp"
    }
  ],
  "catalysts": [{ "event": "string", "impact": "high" | "medium" | "low", "direction": "bullish" | "bearish" | "neutral", "timing": "string" }],
  "riskEvents": ["upcoming risk events"],
  "socialSignals": {
    "twitterSentiment": "bullish" | "bearish" | "neutral",
    "redditMentions": "trending" | "normal" | "quiet",
    "unusualActivity": boolean,
    "topMentions": ["tickers or topics trending"]
  },
  "earningsReactions": [{ "ticker": "string", "surprise": "beat" | "miss" | "inline", "priceReaction": "positive" | "negative" | "muted", "guidance": "raised" | "lowered" | "maintained" | "none" }],
  "headlineImpactScore": number (0-10),

  // RISK OVERSIGHT FUNCTIONS (when proposal provided)
  "riskAssessment": {
    "riskScore": number (1-10),
    "flags": ["array of risk flags"],
    "cumulativeExposure": "description",
    "recommendation": "PROCEED" | "REDUCE_SIZE" | "RECONSIDER" | "HOLD_FOR_TIMING",
    "rule8Check": "margin of safety assessment",
    "rule12Check": "exit thesis clarity check",
    "newsOverride": "breaking news impact if applicable",
    "sentimentDivergence": "price vs sentiment mismatch if any"
  },

  "summary": "2-3 sentence synthesis"
}

MACRO LEVEL CLASSIFICATION:
- Level 4: Breaking, FOMC decisions, major economic surprises, IV >= 8
- Level 3: High impact scheduled (CPI, NFP), IV 6-8
- Level 2: Moderate (earnings, Fed speakers), IV 4-6
- Level 1: Routine, sector chatter, IV < 4

YOUR VOICE: Measured, cautionary, wise. Not pessimistic — you understand avoiding big losses matters more than catching big wins. A 50% loss requires a 100% gain to recover.

Respond with valid JSON only.`

// --- Input ---

export interface HeraldInput {
  headlines: {
    headline: string
    source: string
    isBreaking: boolean
    ivScore?: number
    publishedAt: string
  }[]
  socialData?: {
    twitterTrending?: string[]
    redditHot?: string[]
    unusualVolume?: boolean
  }
  earningsData?: {
    ticker: string
    actual: number
    estimate: number
    guidance?: string
  }[]
  upcomingEvents?: string[]
  // Risk assessment input (Horace legacy)
  proposal?: {
    id: string
    instrument: string
    direction: 'long' | 'short'
    entryPrice?: number
    stopLoss?: number
    takeProfit?: number[]
    positionSize?: number
    riskRewardRatio?: number
    conviction?: number // 0-100
    rationale: string
  }
  existingPositions?: { symbol: string; size: number; direction: 'long' | 'short' }[]
  vixLevel?: number
  accountSize?: number
}

// --- Runner ---

export async function analyzeHeraldSentiment(
  userId: string,
  input?: HeraldInput
): Promise<AgentReport> {
  const cached = await getLatestReport(userId, 'news_sentiment')
  if (cached) return cached

  const data = input ?? getMockHeraldData()
  const userPrompt = buildHeraldPrompt(data)

  const { report, latencyMs, model } = await runAgent<HeraldReport>(
    {
      agentType: 'news_sentiment',
      taskType: 'news',
      systemPrompt: SYSTEM_PROMPT,
      parseResponse: (text) => parseJsonResponse<HeraldReport>(text),
    },
    { userId } as AgentContext,
    userPrompt
  )

  const hasBreaking = data.headlines.some((h) => h.isBreaking)
  const hasSocial = !!data.socialData
  const hasEarnings = (data.earningsData?.length ?? 0) > 0

  const confidenceScore = calculateConfidence([
    { weight: 0.3, value: Math.min(1, data.headlines.length / 10) },
    { weight: 0.2, value: hasBreaking ? 1 : 0.6 },
    { weight: 0.2, value: hasSocial ? 1 : 0.4 },
    { weight: 0.15, value: hasEarnings ? 1 : 0.5 },
    { weight: 0.15, value: data.upcomingEvents?.length ? 1 : 0.7 },
  ])

  return saveAgentReport(userId, 'news_sentiment', report, {
    confidenceScore,
    model,
    latencyMs,
  })
}

// --- Prompt Builder ---

function buildHeraldPrompt(data: HeraldInput): string {
  const sections: string[] = ['Analyze the following news and social landscape:']

  sections.push('\n=== HEADLINES ===')
  data.headlines.forEach((h, i) => {
    const breaking = h.isBreaking ? '[BREAKING] ' : ''
    const iv = h.ivScore != null ? ` (IV: ${h.ivScore})` : ''
    sections.push(`${i + 1}. ${breaking}${h.headline}${iv} — ${h.source}`)
  })

  if (data.socialData) {
    sections.push('\n=== SOCIAL SIGNALS ===')
    if (data.socialData.twitterTrending?.length)
      sections.push(`Twitter/X trending: ${data.socialData.twitterTrending.join(', ')}`)
    if (data.socialData.redditHot?.length)
      sections.push(`Reddit hot: ${data.socialData.redditHot.join(', ')}`)
    if (data.socialData.unusualVolume)
      sections.push('Unusual social volume detected')
  }

  if (data.earningsData?.length) {
    sections.push('\n=== EARNINGS ===')
    data.earningsData.forEach((e) => {
      const surprise = e.actual > e.estimate ? 'BEAT' : e.actual < e.estimate ? 'MISS' : 'INLINE'
      sections.push(`${e.ticker}: ${surprise} (actual ${e.actual} vs est ${e.estimate})${e.guidance ? ` — guidance ${e.guidance}` : ''}`)
    })
  }

  if (data.upcomingEvents?.length) {
    sections.push('\n=== UPCOMING EVENTS ===')
    data.upcomingEvents.forEach((ev) => sections.push(`- ${ev}`))
  }

  // Risk assessment section (Horace legacy)
  if (data.proposal) {
    sections.push('\n=== TRADE PROPOSAL FOR RISK REVIEW ===')
    sections.push(`ID: ${data.proposal.id}`)
    sections.push(`Instrument: ${data.proposal.instrument}`)
    sections.push(`Direction: ${data.proposal.direction.toUpperCase()}`)
    if (data.proposal.entryPrice) sections.push(`Entry: $${data.proposal.entryPrice}`)
    if (data.proposal.stopLoss) sections.push(`Stop: $${data.proposal.stopLoss}`)
    if (data.proposal.takeProfit?.length) sections.push(`TP: ${data.proposal.takeProfit.join(', ')}`)
    if (data.proposal.positionSize) sections.push(`Size: ${data.proposal.positionSize} contracts`)
    if (data.proposal.riskRewardRatio) sections.push(`R:R: ${data.proposal.riskRewardRatio}:1`)
    if (data.proposal.conviction) sections.push(`Conviction: ${data.proposal.conviction}%`)
    sections.push(`Rationale: ${data.proposal.rationale}`)

    if (data.existingPositions?.length) {
      sections.push('\n=== EXISTING POSITIONS ===')
      data.existingPositions.forEach(p => {
        sections.push(`- ${p.symbol}: ${p.size} contracts (${p.direction})`)
      })
    }

    if (data.vixLevel) {
      sections.push(`\nVIX: ${data.vixLevel} ${data.vixLevel > 22 ? '(ELEVATED - tighten risk)' : ''}`)
    }

    if (data.accountSize) {
      const positionValue = (data.proposal.positionSize ?? 0) * (data.proposal.entryPrice ?? 0)
      const concentration = ((positionValue / data.accountSize) * 100).toFixed(2)
      sections.push(`\nPosition Concentration: ${concentration}% of account`)
    }

    sections.push('\n=== RISK ASSESSMENT REQUIRED ===')
    sections.push('Evaluate this proposal against:')
    sections.push('- Rule 8: Is this a good price? Margin of safety?')
    sections.push('- Rule 12: Clear exit thesis? Will they know when they\'re wrong?')
    sections.push('- Rule 3: Conviction level justified by confluence?')
    sections.push('- Cross-desk correlation with existing positions')
    sections.push('- VIX regime adjustment (if VIX > 22)')
  }

  sections.push('\nSynthesize sentiment from news + social signals. Flag any divergences.')
  if (data.proposal) {
    sections.push('Provide risk assessment overlay for the proposal.')
  }
  return sections.join('\n')
}

// --- Mock Data ---

function getMockHeraldData(): HeraldInput {
  const now = new Date()
  return {
    headlines: [
      {
        headline: 'Fed officials signal patience on rate cuts amid sticky inflation',
        source: 'Reuters',
        isBreaking: false,
        ivScore: 6,
        publishedAt: new Date(now.getTime() - 30 * 60_000).toISOString(),
      },
      {
        headline: 'BREAKING: CPI comes in at 2.9% YoY, below 3.1% forecast',
        source: 'FinancialJuice',
        isBreaking: true,
        ivScore: 8.5,
        publishedAt: new Date(now.getTime() - 15 * 60_000).toISOString(),
      },
      {
        headline: 'NVDA announces new AI chip with 2x performance boost',
        source: 'Bloomberg',
        isBreaking: false,
        ivScore: 5,
        publishedAt: new Date(now.getTime() - 45 * 60_000).toISOString(),
      },
      {
        headline: 'Tech earnings season kicks off with mixed guidance',
        source: 'InsiderWire',
        isBreaking: false,
        publishedAt: new Date(now.getTime() - 60 * 60_000).toISOString(),
      },
    ],
    upcomingEvents: [
      'FOMC minutes release — Today 2pm ET',
      'Initial jobless claims — Tomorrow 8:30am ET',
    ],
  }
}
