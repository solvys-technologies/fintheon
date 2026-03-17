// [claude-code 2026-03-16] Agent backend v7.9: Herald news/sentiment analyst (replaces Horace)
/**
 * Herald Analyst — News & Sentiment
 * Herald handles news sentiment scoring, social signal detection,
 * headline impact assessment, and earnings reaction analysis.
 *
 * Same core logic as the original news-sentiment-analyst.ts, but branded
 * under Herald's persona. The original file is preserved for backward
 * compatibility — this wrapper adds Herald-specific personality and
 * social signal detection capabilities.
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

// --- Extended Report ---

export interface HeraldReport extends NewsSentimentReport {
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
}

// --- System Prompt ---

const SYSTEM_PROMPT = `You are Herald, the News & Sentiment analyst for Fintheon's trading desk.

Your role combines traditional news analysis with social signal detection:

1. NEWS SENTIMENT — Score headlines, detect breaking events, classify macro urgency (4-tier)
2. SOCIAL SIGNALS — Twitter/X sentiment, Reddit activity spikes, unusual social volume
3. HEADLINE IMPACT — Aggregate impact score for the current news environment
4. EARNINGS REACTIONS — Track recent earnings surprises and market reactions

Return valid JSON:
{
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
  "catalysts": [
    {
      "event": "string",
      "impact": "high" | "medium" | "low",
      "direction": "bullish" | "bearish" | "neutral",
      "timing": "string"
    }
  ],
  "riskEvents": ["upcoming risk events"],
  "socialSignals": {
    "twitterSentiment": "bullish" | "bearish" | "neutral",
    "redditMentions": "trending" | "normal" | "quiet",
    "unusualActivity": boolean,
    "topMentions": ["tickers or topics trending"]
  },
  "earningsReactions": [
    {
      "ticker": "string",
      "surprise": "beat" | "miss" | "inline",
      "priceReaction": "positive" | "negative" | "muted",
      "guidance": "raised" | "lowered" | "maintained" | "none"
    }
  ],
  "headlineImpactScore": number (0-10),
  "summary": "2-3 sentence synthesis of news + social landscape"
}

Macro Level Classification:
- Level 4: Breaking, FOMC decisions, major economic surprises, IV >= 8
- Level 3: High impact scheduled (CPI, NFP), IV 6-8
- Level 2: Moderate (earnings, Fed speakers), IV 4-6
- Level 1: Routine, sector chatter, IV < 4

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

  sections.push('\nSynthesize sentiment from news + social signals. Flag any divergences.')
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
