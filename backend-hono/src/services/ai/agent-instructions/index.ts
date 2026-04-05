// [claude-code 2026-03-23] Source of Truth fusion — modular prompt composition + capability awareness injection
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
 * Capability awareness block — tells agents what data and tools they have access to.
 * Without this, agents respond with generic "awaiting data sync" placeholders.
 */
const CAPABILITIES_BLOCK = `

## Your Capabilities — USE THEM
You have access to the following live data sources and tools. Do NOT say "awaiting data sync" or "connecting to..." — your data is live. Use it.

### MANDATORY: Backend Data First
**ALWAYS check internal backend data BEFORE going to the internet.** Your backend has live, scored, enriched data that is better than raw web results. Only use external search if the backend data is insufficient or the user explicitly asks for external research.

**Internal data sources (CHECK THESE FIRST):**
- **RiskFlow Feed**: Live news headlines with macro-level scoring (HIGH/MED/LOW) and sentiment are injected at the end of this prompt when available. Reference them by name when discussing current market conditions, narratives, or risk events.
- **NarrativeFlow / Catalysts**: Promoted RiskFlow items with narrative thread assignments — use \`run_command\` to query the backend API: \`curl -s http://localhost:8080/api/narrative/catalysts\`
- **Economic Calendar**: \`curl -s http://localhost:8080/api/data/econ-events\`
- **Daily Briefs**: \`curl -s http://localhost:8080/api/data/briefs/latest\`
- **Supabase DB**: scored_riskflow_items, narrative_threads, econ_events tables — query via backend API endpoints
- **Notion**: Trade ideas database, daily P&L logs, economic events calendar, and meeting notes.

**External sources (USE ONLY AFTER checking internal data):**
- **Exa Search**: Neural web search for financial research, news, analysis, and real-time information.
- **Yahoo Finance**: Real-time quotes, options chains, fundamentals, and company data.
- **Playwright Browser**: Headless browser for chart screenshots, TopStepX chart interaction, and web scraping.

When live data appears below (e.g., RiskFlow headlines), weave it into your analysis. Cite specific headlines, scores, and sources. You are a live analyst — act like one.
`

/**
 * Build a dynamic system prompt for the given agent role + context.
 *
 * Composition order:
 *   1. Base role description
 *   2. Shared beliefs (neural web — all agents)
 *   3. Capabilities block (tools and data)
 *   4. Agent-specific philosophy block
 *   5. Commandment gates (contextual, if trading state provided)
 *   6. Skill instructions (if [SKILL:*] tag detected)
 *   7. Deep analysis block (if thinkHarder)
 *   --- appended by caller (hermes-handler.ts) ---
 *   8. Live RiskFlow feed context
 *   9. Cross-agent thought bank context (collective thought plane)
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

  // 2.5. Capability awareness — what tools and data the agent has access to
  prompt += CAPABILITIES_BLOCK

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

/**
 * Build a REFLECT context block for Harper standup prompts.
 * Returns the latest news analysis quality report so Harper can flag scoring issues.
 */
export async function buildReflectContext(): Promise<string> {
  try {
    const { getLatestReflectReport } = await import('../../autoresearch/reflect-engine.js');
    const report = await getLatestReflectReport();
    if (!report) return '';

    const criticalCount = report.findings.filter((f: any) => f.severity === 'critical').length;
    const warningCount = report.findings.filter((f: any) => f.severity === 'warning').length;

    let block = `\n\n## REFLECT — News Analysis Quality Report (${report.generatedAt.slice(0, 10)})`;
    block += `\n${report.summary}`;

    if (criticalCount > 0 || warningCount > 0) {
      block += '\n\nFindings:';
      for (const f of report.findings) {
        if (f.severity === 'info') continue;
        block += `\n- [${f.severity.toUpperCase()}] ${f.message} → ${f.recommendation}`;
      }
    }

    if (report.adjustments.length > 0) {
      block += '\n\nRecommended adjustments:';
      for (const a of report.adjustments) {
        block += `\n- ${a.parameter}: ${a.reason}`;
      }
    }

    block += '\n\nMention any critical REFLECT findings in your standup. If all metrics are healthy, note that scoring quality is on track.';
    return block;
  } catch {
    return '';
  }
}
