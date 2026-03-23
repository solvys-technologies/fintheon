// [claude-code 2026-03-22] Source of Truth fusion — modular prompt composition
import type { HermesAgentRole } from '../../hermes-service.js'
import { BASE_PROMPTS } from './base-prompts.js'
import { SHARED_BELIEFS } from './shared-beliefs.js'
import { AGENT_PHILOSOPHY } from './philosophy-blocks.js'
import { SKILL_INSTRUCTIONS, DEEP_ANALYSIS_BLOCK } from './skill-instructions.js'
import { getCommandmentGates } from './commandment-gates.js'

/** Cache entry for compiled prompts */
type CacheEntry = { prompt: string; expiresAt: number }
const promptCache = new Map<string, CacheEntry>()
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

/**
 * Build a dynamic system prompt for the given agent role + context.
 *
 * Composition order:
 *   1. Base role description
 *   2. Shared beliefs (neural web — all agents)
 *   3. Agent-specific philosophy block
 *   4. Commandment gates (contextual, if trading state provided)
 *   5. Skill instructions (if [SKILL:*] tag detected)
 *   6. Deep analysis block (if thinkHarder)
 */
export function getAgentSystemPrompt(
  role: HermesAgentRole,
  context?: {
    skillTag?: string | null
    thinkHarder?: boolean
    tradingState?: {
      timeEST?: string
      morningRoutineDone?: boolean
      consecutiveLosses?: number
      lastBigWinWithin48h?: boolean
      holdingLosingPosition?: boolean
      currentPnL?: number
    }
  }
): string {
  // Cache key includes trading state hash for gate variations
  const gateHash = context?.tradingState
    ? `${context.tradingState.timeEST ?? ''}:${context.tradingState.morningRoutineDone ?? ''}:${context.tradingState.consecutiveLosses ?? 0}`
    : ''
  const cacheKey = `${role}:${context?.skillTag ?? ''}:${context?.thinkHarder ? '1' : '0'}:${gateHash}`
  const cached = promptCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.prompt
  }

  // 1. Base role description (graceful fallback to harper-cao)
  let prompt = BASE_PROMPTS[role] ?? BASE_PROMPTS['harper-cao']

  // 2. Shared beliefs — the neural web
  prompt += SHARED_BELIEFS

  // 3. Agent-specific philosophy block
  const philosophy = AGENT_PHILOSOPHY[role]
  if (philosophy) {
    prompt += philosophy
  }

  // 4. Commandment gates (contextual)
  if (context?.tradingState) {
    prompt += getCommandmentGates(context.tradingState)
  }

  // 5. Skill instructions when [SKILL:*] detected
  if (context?.skillTag) {
    const skillKey = context.skillTag.toUpperCase()
    const skillBlock = SKILL_INSTRUCTIONS[skillKey]
    if (skillBlock) {
      prompt += skillBlock
    }
  }

  // 6. Deep analysis block
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

/**
 * Build a live RiskFlow feed context block for agent chat prompts.
 * Returns recent headlines so agents can reference real-time data
 * when analyzing narratives, risk events, and econ prints.
 */
export async function buildFeedContext(): Promise<string> {
  try {
    const { getFeed } = await import('../../riskflow/feed-service.js')
    const feed = await getFeed('system', { limit: 10 })
    if (feed.items.length === 0) return ''

    const headlines = feed.items
      .map(
        (item: any, i: number) =>
          `${i + 1}. [${item.macroLevel >= 3 ? 'HIGH' : item.macroLevel >= 2 ? 'MED' : 'LOW'}] ${item.headline} (${item.source}${item.sentiment ? ', ' + item.sentiment : ''})`
      )
      .join('\n')

    return `\n\n## Live RiskFlow Headlines (recent)\n${headlines}\n\nReference these headlines when discussing current market conditions, narratives, or risk events.`
  } catch {
    return ''
  }
}
