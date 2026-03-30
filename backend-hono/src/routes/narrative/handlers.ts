// [claude-code 2026-03-06] Narrative catalyst scoring endpoints — LLM-scored candidates from RiskFlow/briefs
import type { Context } from 'hono'
import { generateText } from 'ai'
import { selectModel, createModelClient, markProviderUnhealthy, type AiModelKey } from '../../services/ai/model-selector.js'

export interface ScoredCandidate {
  sourceId: string
  sourceType: 'riskflow' | 'mdb-brief'
  notabilityScore: number
  sentiment: 'bullish' | 'bearish'
  severity: 'high' | 'medium' | 'low'
  tickers: string[]
  themes: string[]
  suggestedTitle: string
  suggestedDescription: string
  originalHeadline?: string
}

interface RiskFlowItem {
  id: string
  headline: string
  summary: string
  source: string
  severity: string
  tags: string[]
  publishedAt: string
}

const RISKFLOW_PROMPT = `You are a market catalyst analyst for Priced In Capital. Score these news items for notability as market catalysts.

For each item, return a JSON object with:
- sourceId: the original item id
- notabilityScore (0-100): How notable is this as a market catalyst? 80+ = major event, 50-79 = moderate, <50 = noise
- sentiment: "bullish" or "bearish"
- severity: "high", "medium", or "low"
- tickers: Array of relevant ticker symbols (e.g., ["NQ", "ES", "AAPL"])
- themes: Array of market themes (e.g., ["rate policy", "tech earnings", "geopolitical"])
- suggestedTitle: Short catalyst title (max 50 chars)
- suggestedDescription: 1-2 sentence description

Return ONLY a JSON array, no markdown, no explanation.

Items:
`

const BRIEF_PROMPT = `You are a market catalyst analyst for Priced In Capital. Parse this daily market brief into discrete catalyst events.

Extract each distinct market event or data point as a separate catalyst. For each:
- sourceId: "brief-0", "brief-1", etc.
- notabilityScore (0-100)
- sentiment: "bullish" or "bearish"
- severity: "high", "medium", or "low"
- tickers: relevant ticker symbols
- themes: market themes
- suggestedTitle: short title (max 50 chars)
- suggestedDescription: 1-2 sentence description

Return ONLY a JSON array, no markdown, no explanation.

Brief:
`

const RESEARCH_DRILL_PROMPT = `You are a market research analyst for Priced In Capital. Given a highlighted phrase from a market narrative card, generate exactly 5 deeper research bullets.

Each bullet should reveal a specific, data-driven insight about the highlighted topic. Include numbers, percentages, dates, or specific entities where possible.

Return a JSON array of 5 objects, each with:
- boldPhrase: A bold key insight (max 80 chars, e.g. "Supply chain repricing underway")
- explanation: Detailed explanation with specific facts (max 300 chars)

Return ONLY a JSON array, no markdown, no explanation.
`

const BULLISH_KEYWORDS = ['cut', 'rally', 'surge', 'soar', 'jump', 'gain', 'rise', 'boost']

function fallbackScore(item: RiskFlowItem): ScoredCandidate {
  const headlineLower = item.headline.toLowerCase()
  const isBullish = BULLISH_KEYWORDS.some(kw => headlineLower.includes(kw))
  const severityMap: Record<string, number> = { high: 80, medium: 50, low: 20 }

  return {
    sourceId: item.id,
    sourceType: 'riskflow',
    notabilityScore: severityMap[item.severity] ?? 50,
    sentiment: isBullish ? 'bullish' : 'bearish',
    severity: (item.severity as ScoredCandidate['severity']) || 'medium',
    tickers: item.tags.filter(t => /^[A-Z]{1,5}$/.test(t)),
    themes: item.tags.filter(t => !/^[A-Z]{1,5}$/.test(t)),
    suggestedTitle: item.headline.slice(0, 50),
    suggestedDescription: item.summary.slice(0, 200),
    originalHeadline: item.headline,
  }
}

function stripMarkdownFences(text: string): string {
  return text.replace(/^```(?:json)?\s*/m, '').replace(/\s*```\s*$/m, '').trim()
}

async function callLlm(prompt: string): Promise<{ parsed: unknown[] | null; provider: string }> {
  const selection = selectModel({ taskType: 'sentiment' })
  const model = createModelClient(selection.model as AiModelKey)

  try {
    const { text } = await generateText({ model, prompt })
    const cleaned = stripMarkdownFences(text)
    const parsed = JSON.parse(cleaned)
    if (!Array.isArray(parsed)) throw new Error('LLM response is not an array')
    return { parsed, provider: selection.provider }
  } catch (err) {
    console.error('[Narrative] LLM call or parse failed:', err)
    markProviderUnhealthy(selection.provider)
    return { parsed: null, provider: selection.provider }
  }
}

function toScoredCandidate(raw: Record<string, unknown>, sourceType: ScoredCandidate['sourceType']): ScoredCandidate {
  return {
    sourceId: String(raw.sourceId ?? ''),
    sourceType,
    notabilityScore: Number(raw.notabilityScore) || 50,
    sentiment: raw.sentiment === 'bullish' ? 'bullish' : 'bearish',
    severity: (['high', 'medium', 'low'].includes(raw.severity as string) ? raw.severity : 'medium') as ScoredCandidate['severity'],
    tickers: Array.isArray(raw.tickers) ? raw.tickers.map(String) : [],
    themes: Array.isArray(raw.themes) ? raw.themes.map(String) : [],
    suggestedTitle: String(raw.suggestedTitle ?? '').slice(0, 50),
    suggestedDescription: String(raw.suggestedDescription ?? '').slice(0, 200),
    originalHeadline: raw.originalHeadline ? String(raw.originalHeadline) : undefined,
  }
}

/**
 * POST /api/narrative/score-riskflow
 * Score RiskFlow items as catalyst candidates via LLM
 */
export async function scoreRiskflow(c: Context) {
  try {
    const { items } = await c.req.json<{ items: RiskFlowItem[] }>()
    if (!Array.isArray(items) || items.length === 0) {
      return c.json({ error: 'items array required' }, 400)
    }

    const batch = items.slice(0, 20)
    const itemsPayload = batch.map(({ id, headline, summary, source, severity, tags }) => ({
      id, headline, summary, source, severity, tags,
    }))

    const { parsed, provider } = await callLlm(RISKFLOW_PROMPT + JSON.stringify(itemsPayload, null, 2))

    let scored: ScoredCandidate[]
    if (parsed) {
      scored = parsed.map(raw => {
        const candidate = toScoredCandidate(raw as Record<string, unknown>, 'riskflow')
        const original = batch.find(i => i.id === candidate.sourceId)
        if (original) candidate.originalHeadline = original.headline
        return candidate
      })
    } else {
      scored = batch.map(fallbackScore)
    }

    return c.json({ scored, provider })
  } catch (err) {
    console.error('[Narrative] scoreRiskflow error:', err)
    return c.json({ error: 'Failed to score items' }, 500)
  }
}

/**
 * POST /api/narrative/score-brief
 * Parse and score a daily brief into catalyst candidates via LLM
 */
export async function scoreBrief(c: Context) {
  try {
    const { briefText } = await c.req.json<{ briefText: string }>()
    if (!briefText || typeof briefText !== 'string') {
      return c.json({ error: 'briefText string required' }, 400)
    }

    const { parsed, provider } = await callLlm(BRIEF_PROMPT + briefText)

    let scored: ScoredCandidate[]
    if (parsed) {
      scored = parsed.map(raw => toScoredCandidate(raw as Record<string, unknown>, 'mdb-brief'))
    } else {
      scored = [{
        sourceId: 'brief-0',
        sourceType: 'mdb-brief',
        notabilityScore: 50,
        sentiment: 'bearish',
        severity: 'medium',
        tickers: [],
        themes: [],
        suggestedTitle: 'Daily Brief',
        suggestedDescription: briefText.slice(0, 200),
      }]
    }

    return c.json({ scored, provider })
  } catch (err) {
    console.error('[Narrative] scoreBrief error:', err)
    return c.json({ error: 'Failed to score brief' }, 500)
  }
}

/**
 * POST /api/narrative/research-drill
 * Generate 5 deeper research bullets for a highlighted phrase
 */
export async function researchDrill(c: Context) {
  try {
    const { highlightedText, parentTitle, parentDescription, riskCategory, sentiment } =
      await c.req.json<{
        highlightedText: string
        parentTitle: string
        parentDescription: string
        riskCategory: string
        sentiment: string
      }>()

    if (!highlightedText) return c.json({ error: 'highlightedText required' }, 400)

    const prompt = RESEARCH_DRILL_PROMPT
      + `\nHighlighted phrase: "${highlightedText}"`
      + `\nParent card: ${parentTitle}`
      + `\nContext: ${parentDescription}`
      + `\nRisk category: ${riskCategory}`
      + `\nMarket sentiment: ${sentiment}`

    const { parsed, provider } = await callLlm(prompt)

    let bullets: Array<{ boldPhrase: string; explanation: string }>
    if (parsed) {
      bullets = parsed.map((raw: any) => ({
        boldPhrase: String(raw.boldPhrase ?? raw.key ?? '').slice(0, 80),
        explanation: String(raw.explanation ?? raw.detail ?? '').slice(0, 300),
      }))
    } else {
      bullets = [{ boldPhrase: highlightedText, explanation: 'AI analysis unavailable — try again.' }]
    }

    const formatted = bullets.map((b, i) => ({
      id: `drill-${Date.now()}-${i}`,
      boldPhrase: b.boldPhrase,
      explanation: b.explanation,
      source: 'ai' as const,
      highlightable: true,
    }))

    return c.json({ bullets: formatted, provider })
  } catch (err) {
    console.error('[Narrative] researchDrill error:', err)
    return c.json({ error: 'Failed to generate research' }, 500)
  }
}
