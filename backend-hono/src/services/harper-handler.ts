// [claude-code 2026-03-28] S8-T7: Harper-Opus handler — Claude CLI session handler for Chat
/**
 * Harper-Opus Handler
 * Thin wrapper around Claude SDK Bridge for the "Harper-Opus" CAO persona.
 * Hardwired to Opus via Claude Code CLI (Max subscription, zero API cost).
 *
 * Architecture:
 *   User message → Harper Handler → Claude SDK Bridge (process-manager)
 *     → Claude Code CLI (--print --output-format stream-json)
 *     → Parsed stream events → SSE to frontend
 *
 * Features:
 *   - Full Fintheon context injection (narratives, RiskFlow, MiroShark)
 *   - Artifact creation (catalyst cards, narrative items, trade ideas)
 *   - Persona switching via system prompt modifier
 *   - Session persistence in Supabase (harper_sessions)
 */

import { isBridgeAvailable, bridgeChat, type BridgeStreamEvent, type BridgeChatRequest } from './claude-sdk/bridge.js'
import { buildFeedContext } from './ai/agent-instructions/index.js'
import { createLogger } from '../lib/logger.js'

const log = createLogger('HarperOpus')

// ── Types ──────────────────────────────────────────────────────────────────

export interface HarperChatRequest {
  message: string
  conversationId: string
  history: Array<{ role: 'user' | 'assistant'; content: string }>
  thinkHarder?: boolean
  /** Active persona override (e.g. 'oracle', 'feucht') — modifies system prompt */
  persona?: string
  /** Additional context from RiskFlow items attached to message */
  riskFlowContext?: string
}

export interface HarperChatResult {
  stream: AsyncGenerator<BridgeStreamEvent>
  abort: () => void
  getFullText: () => string
}

// ── Persona System Prompts ──────────────────────────────────────────────────

const HARPER_BASE_SYSTEM_PROMPT = `You are Harper-Opus, the Chief Agentic Officer (CAO) of Priced In Capital (PIC).
You are the most senior AI agent in the organization, powered by Claude Opus.
You have access to the full Fintheon platform: NarrativeFlow canvases, RiskFlow feeds,
MiroShark simulation reports, trade proposals, market data, and agent scorecards.

Your role:
- Provide executive-level market analysis and trade recommendations
- Synthesize inputs from all PIC analysts (Oracle, Feucht, Consul, Herald)
- Create artifacts: catalyst cards, narrative items, trade proposals
- Maintain directional conviction with probabilistic reasoning

Communication style: Concise, authoritative, data-driven. No hedging unless
genuinely uncertain. When creating artifacts, output them as structured JSON
blocks that the frontend can parse and render.`

const PERSONA_MODIFIERS: Record<string, string> = {
  'oracle': `You are now channeling Oracle (The All-Seer) within the Harper-Opus session.
Respond as Oracle would: prediction-market focused, probabilistic reasoning,
S&P/Crypto/Political angles. Maintain Oracle's analytical framework.`,

  'feucht': `You are now channeling Feucht (Futures & Risk) within the Harper-Opus session.
Respond as Feucht would: /NQ and /ES focused, technical levels, risk management,
TopStepX execution context. Sharp, tactical, level-specific.`,

  'consul': `You are now channeling Consul (Fundamentals) within the Harper-Opus session.
Respond as Consul would: mega-cap tech analysis, earnings impact, sector rotation,
fundamental valuations. Thorough, research-backed.`,

  'herald': `You are now channeling Herald (News & Sentiment) within the Harper-Opus session.
Respond as Herald would: breaking news impact, social sentiment, headline risk,
information asymmetry detection. Fast, alert-oriented.`,
}

// ── Handler ─────────────────────────────────────────────────────────────────

/**
 * Check if Harper-Opus (Claude CLI) is available.
 */
export async function isHarperAvailable(): Promise<boolean> {
  return isBridgeAvailable()
}

/**
 * Send a chat message through Harper-Opus and get a streaming response.
 */
export async function harperChat(request: HarperChatRequest): Promise<HarperChatResult> {
  const { message, conversationId, history, thinkHarder, persona, riskFlowContext } = request

  // Build system prompt with persona modifier
  let systemPrompt = HARPER_BASE_SYSTEM_PROMPT

  if (persona && PERSONA_MODIFIERS[persona]) {
    systemPrompt += `\n\n--- PERSONA ACTIVE ---\n${PERSONA_MODIFIERS[persona]}`
  }

  // Inject Fintheon context
  try {
    const feedContext = await buildFeedContext()
    if (feedContext) {
      systemPrompt += `\n\n--- FINTHEON CONTEXT ---\n${feedContext}`
    }
  } catch (err) {
    log.warn('Failed to build feed context (non-fatal)', { error: String(err) })
  }

  // Add RiskFlow items if attached
  if (riskFlowContext) {
    systemPrompt += `\n\n--- ATTACHED RISKFLOW ITEMS ---\n${riskFlowContext}`
  }

  log.info('Harper-Opus chat request', {
    conversationId,
    persona: persona ?? 'harper-opus',
    thinkHarder: !!thinkHarder,
    messageLen: message.length,
    historyLen: history.length,
  })

  const bridgeRequest: BridgeChatRequest = {
    message,
    conversationId,
    history,
    thinkHarder,
  }

  const result = bridgeChat(bridgeRequest, {
    systemPrompt,
    model: 'opus',
    effort: thinkHarder ? 'high' : 'medium',
    maxTurns: thinkHarder ? 5 : 3,
  })

  return result
}
