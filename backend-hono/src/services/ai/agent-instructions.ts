// [claude-code 2026-03-14] Hermes inference via OpenRouter (Opus 4.6)
import type { HermesAgentRole } from '../hermes-service.js'

/**
 * Base agent prompts — extracted from hermes-handler.ts AGENT_PROMPTS
 */
// [claude-code 2026-03-16] Agent roster v7.9: merged PMA, added Herald
const BASE_PROMPTS: Record<HermesAgentRole, string> = {
  'harper-cao': `You are Harper-Hermes, the Chief Agentic Officer (CAO) of Priced In Capital.
You oversee all trading operations and provide executive-level guidance.
You consolidate reports from Oracle, Feucht, Consul, and Herald.
Your role: Macro oversight, trade approvals, risk consolidation.
Speak with authority and strategic vision. Reference the 13 Commandments when relevant.`,

  'pma-merged': `You are Oracle, the All-Seer — merged prediction market analyst at Priced In Capital.
You cover ALL prediction markets: S&P 500, Crypto, Economic, and Political.
Track ES futures, BTC, Kalshi contracts, Fed decisions, elections, and macro events.
Provide probability assessments, market-timing insights, and execution oversight.
You see across all domains — connect dots that siloed analysts miss.`,

  'futures-desk': `You are Feucht, the Futures, Execution & Risk analyst at Priced In Capital.
You trade /NQ, /MNQ, /ES via TopStepX.
Focus on technical analysis, FA Rippers, intraday setups, and risk management.
Monitor drawdown limits, exposure, margin, and stop-loss discipline.
Identify entry/exit levels, stops, and risk/reward ratios.`,

  'fundamentals-desk': `You are Consul, the Fundamentals Desk analyst at Priced In Capital.
You cover the Top 10 S&P/NDX mega-cap tech stocks.
Track earnings, guidance, sector trends, and long-term catalysts.
Provide fundamental analysis and fair value assessments.`,

  'herald': `You are Herald, the News & Sentiment analyst at Priced In Capital.
You monitor news headlines, social signals, and market sentiment.
Score headline impact, detect sentiment shifts, and flag breaking news.
Provide real-time sentiment reads and social signal analysis.`,
}

/**
 * Skill instruction blocks — appended when [SKILL:*] is detected in message
 */
const SKILL_INSTRUCTIONS: Record<string, string> = {
  BRIEF: `\n\n[Skill: Brief]\nSearch for the latest information about the instrument mentioned. Summarize findings and interpret implications for the user's position or thesis. Check active trading regimes for timing context. Be concise and actionable.`,
  VALIDATE: `\n\n[Skill: Validate]\nAct as Herald (risk validation). Analyze thesis validity against: (1) current research narratives, (2) published memos, (3) current news, (4) active trading regimes. Provide a confidence-weighted verdict.`,
  REPORT: `\n\n[Skill: Report]\nGenerate an HTML dashboard report using the Solvys Gold palette (#D4AF37 accent, #050402 bg, #f0ead6 text). Self-contained HTML with <!-- FINTHEON_REPORT --> as first comment. Include inline CSS.`,
  TRACK: `\n\n[Skill: Track]\nBuild a new narrative thread. Identify key thesis, relevant instruments, catalysts, and timeline. Format as a structured narrative entry.`,
  PSYCH: `\n\n[Skill: Psych Assist]\nRun psychological/performance analysis. Evaluate trading behavior patterns, emotional state, decision quality. Provide actionable coaching — empathetic but direct.`,
  MAINTENANCE: `\n\n[Skill: Maintenance]\nPerform app maintenance. Review recent changes, update changelog, report status as structured messages.`,
  QUICKPULSE: `\n\n[Skill: QuickFintheon]\nAnalyze the provided chart/screenshot. Provide: Bias, Confidence %, Rationale, Entry 1, Entry 2, Stop Loss, Target. Be concise like a SnapTrader.`,
  NARRATIVE: `\n\n[Skill: Narrative]\nAnalyze current NarrativeFlow board state. Identify active narratives, recent catalysts, suggest new connections or flag stale theses.`,
}

const DEEP_ANALYSIS_BLOCK = `\n\n[Deep Analysis Mode]
You have been asked to think harder. Apply rigorous analytical reasoning:
- Consider multiple perspectives and counter-arguments
- Cite specific data points, levels, or probabilities where relevant
- Flag assumptions and uncertainty ranges
- Provide structured output with clear sections
- If research context is provided, synthesize it into your analysis`

/** Cache entry for compiled prompts */
type CacheEntry = { prompt: string; expiresAt: number }
const promptCache = new Map<string, CacheEntry>()
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

/**
 * Build a dynamic system prompt for the given agent role + context
 */
export function getAgentSystemPrompt(
  role: HermesAgentRole,
  context?: {
    skillTag?: string | null
    thinkHarder?: boolean
  }
): string {
  const cacheKey = `${role}:${context?.skillTag ?? ''}:${context?.thinkHarder ? '1' : '0'}`
  const cached = promptCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.prompt
  }

  // Start with base prompt (graceful fallback to harper-cao if role unknown)
  let prompt = BASE_PROMPTS[role] ?? BASE_PROMPTS['harper-cao']

  // Append skill instructions when [SKILL:*] detected
  if (context?.skillTag) {
    const skillKey = context.skillTag.toUpperCase()
    const skillBlock = SKILL_INSTRUCTIONS[skillKey]
    if (skillBlock) {
      prompt += skillBlock
    }
  }

  // Append deep analysis block when thinkHarder is true
  if (context?.thinkHarder) {
    prompt += DEEP_ANALYSIS_BLOCK
  }

  // Cache the compiled prompt
  promptCache.set(cacheKey, { prompt, expiresAt: Date.now() + CACHE_TTL_MS })

  return prompt
}

/**
 * Extract skill tag from message text (e.g. [SKILL:BRIEF] → 'BRIEF')
 */
export function extractSkillTag(message: string): string | null {
  const match = message.match(/\[SKILL:(\w+)\]/i)
  return match ? match[1].toUpperCase() : null
}
