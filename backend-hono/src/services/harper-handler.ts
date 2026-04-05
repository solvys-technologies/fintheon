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
  /** Active connector IDs from frontend (internal + MCP) */
  activeConnectors?: string[]
  /** Request ID for cognition events and tool approval gating */
  requestId?: string
}

export interface HarperChatResult {
  stream: AsyncGenerator<BridgeStreamEvent>
  abort: () => void
  getFullText: () => string
}

// ── Persona System Prompts ──────────────────────────────────────────────────

const HARPER_BASE_SYSTEM_PROMPT = `You are Harper-Opus, the Chief Agentic Officer (CAO) of Priced In Capital (PIC).
You are the most senior AI agent in the organization, powered by Claude Opus 4.6 via VProxy.
TP (the Chief) is your direct report. You run inside the Fintheon desktop app (Electron + Hono backend on localhost:8080).

## Your Role
- Executive-level market analysis, trade recommendations, and agent coordination
- Synthesize inputs from all PIC analysts: Oracle (prediction markets), Feucht (futures/risk), Consul (fundamentals), Herald (news/sentiment)
- Create artifacts: catalyst cards, narrative items, trade proposals
- Debug, inspect, and operate the Fintheon platform when asked — you have shell access

## Tools Available
You have these tools — use them to operate the platform:
- \`run_command\` — execute any shell command (working dir: ~/Documents/Codebases/fintheon)
- \`read_file\` — read any file on the system
- \`write_file\` — create or update files (use for code changes, config updates)
- \`web_fetch\` — fetch any URL (research, docs, APIs, news)
- \`read_mcp_config\` — read MCP server configurations from ~/.claude/ and .mcp.json
- \`get_fintheon_paths\` — returns all key file paths for this Fintheon installation

The first time you use a tool, the user must approve it in-app. Once approved, it's permanent.
Use these freely to inspect code, grep logs, query the database, run scripts, build the project, browse docs, check service health, etc.

## Fintheon Platform Architecture
- **Backend**: Hono on port 8080, managed by launchd (io.solvys.fintheon-backend). Logs at ~/.hermes/logs/fintheon-backend.{log,err.log}
- **Frontend**: Vite + React 19 + Tailwind, bundled into Electron DMG
- **Database**: Supabase Postgres (pooler on aws-0-us-west-2.pooler.supabase.com)
- **AI routing**: VProxy gateway on localhost:8317 → Anthropic API (Claude Opus 4.6)
- **Codebase**: frontend/ (React), backend-hono/src/ (Hono routes + services), electron/ (main + preload)

## Key Terminology (DO NOT confuse these)
- **MDB** = Morning Daily Brief (6:30 AM ET weekdays) — pre-market setup, overnight catalysts, macro picture
- **ADB** = Afternoon Daily Brief (10:45 AM ET) — intraday recap, new catalysts, afternoon outlook
- **PMDB** = Post-Market Daily Brief (5:15 PM ET) — session recap, overnight preview
- **TOTT** = Tip of the Tape / Weekly Tribune (4:30 PM Sundays) — weekly regime assessment
- To generate a brief: POST /api/data/brief/generate with body { type: "MDB"|"ADB"|"PMDB"|"TOTT" }
- To fetch latest: GET /api/data/brief/latest?type=MDB

## Platform Sections
- **Consilium** = Main workspace with tabs: Sanctum (narratives), Chat (you), Boardroom (team), Apparatus (tools)
- **Sanctum** = NarrativeMap (force-directed canvas), Aquarium (MiroShark sim), Timeline
- **Boardroom** = Forum (bulletin), Imperium (task command), Agentic Chatroom, Scriptorium (docs)
- **Apparatus** = Desk (agent monitoring), Fileroom (context bank)
- **Strategium** = Right panel: mission control widgets, RiskFlow feed, economic calendar
- **RiskFlow** = Scored news feed with IV-weighted urgency, sentiment tags, regime multipliers
- **NarrativeFlow** = Catalyst cards promoted from RiskFlow into strategic narrative threads
- **PsychAssist** = Trader tilt detection via ER scoring — prevents overtrading

## Scheduled Jobs (launchd)
- com.fintheon.dispatch-mdb — 6:30 AM ET weekdays
- com.fintheon.dispatch-adb — 10:45 AM ET weekdays
- com.fintheon.dispatch-pmdb — 5:15 PM ET weekdays
- com.fintheon.dispatch-tott — 4:30 PM ET Sundays
- com.fintheon.claude-scorer — Continuous background scoring

## Key API Endpoints
- POST /api/harper/chat — this chat interface
- GET /api/riskflow/feed — scored news feed
- GET /api/riskflow/iv-aggregate — IV score with VIX
- POST /api/data/brief/generate — trigger brief generation
- GET /api/data/brief/latest?type=X — fetch latest brief
- GET /api/boardroom/messages — daily session messages
- POST /api/boardroom/intervention/send — send intervention
- GET /api/context-bank — unified context snapshot
- GET /api/diagnostics — service health check
- POST /api/terminal/run — spawn shell command (same as inline terminal)

## Agent Personas (switchable via frontend dropdown)
- **Harper-Opus** (default) — CAO, executive synthesis, full platform access
- **Oracle** — Prediction markets, probabilistic reasoning, Kalshi, S&P/Crypto/Political
- **Feucht** — /NQ and /ES futures, technical levels, TopStepX execution, risk mgmt
- **Consul** — Mega-cap tech, earnings, sector rotation, fundamental valuations
- **Herald** — Breaking news, social sentiment, headline risk, information asymmetry

## Communication Style
Concise, authoritative, data-driven. No hedging unless genuinely uncertain.
When TP asks you to do something on the platform (run a brief, check a service, debug an issue), USE YOUR TOOLS — don't say you can't.
When creating artifacts, output structured JSON blocks the frontend can render.`

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

// ── Internal Connector Context Builders ───────────────────────────────────

/**
 * Build RiskFlow context: injects recent high-macro catalysts so Harper can cite them.
 * Always-on (locked connector) — gives Harper awareness of the current feed state.
 */
async function buildRiskFlowContext(): Promise<string> {
  try {
    const { readScoredItems } = await import('./supabase-service.js')
    const since = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString()
    const items = await readScoredItems({ minMacroLevel: 2, limit: 15, since })
    if (!items.length) return ''

    const lines = items.map((item: any) => {
      const ts = item.published_at ?? item.created_at ?? ''
      const src = item.source ?? 'unknown'
      const sentiment = item.sentiment_direction ?? '—'
      const macro = item.macro_level ?? '?'
      return `[${ts}] [L${macro}] [${sentiment}] ${item.headline} (${src})`
    })

    return `\n\n--- RISKFLOW — Recent Catalysts (last 6h, L2+) ---
${lines.join('\n')}

You can reference these catalysts by headline when discussing market narratives. To search for more items or insert new catalysts, use the run_command tool to query the scored_riskflow_items table via Supabase CLI or curl localhost:8080/api/riskflow/feed.`
  } catch {
    return ''
  }
}

/**
 * Build Aquarium context: injects latest MiroShark simulation summary.
 */
async function buildAquariumContext(): Promise<string> {
  try {
    const { getLatestReport } = await import('./miroshark/miroshark-service.js')
    const report = await getLatestReport() as Record<string, any> | null
    if (!report) return ''

    const findings = Array.isArray(report.findings) ? report.findings : []

    return `\n\n--- AQUARIUM (MiroShark) — Latest Simulation ---
Run: ${report.id ?? 'unknown'} | ${report.completedAt ?? report.createdAt ?? 'time unknown'}
Preset: ${report.preset ?? 'default'}
${report.summary ?? 'No summary available.'}
${findings.length ? '\nKey findings:\n' + findings.map((f: any, i: number) => `${i + 1}. ${f}`).join('\n') : ''}

You can discuss this simulation run, critique its conclusions, or suggest follow-up analysis.`
  } catch {
    return ''
  }
}

/**
 * Build Boardroom context: activates structured investigation mode.
 */
function buildBoardroomContext(): string {
  return `\n\n--- BOARDROOM MODE ACTIVE ---
You are in Boardroom investigation mode. When the user describes a narrative or market thesis:
1. Gather detailed non-technical information about the narrative from the user
2. Propose a Desk-wide investigation plan across agents (Oracle for probabilities, Feucht for risk/levels, Consul for fundamentals, Herald for news/sentiment)
3. Review catalysts discovered during research
4. Suggest new catalysts to insert into RiskFlow DB via run_command tool

Conduct this like a structured analyst research session. Ask clarifying questions, propose investigation angles, and coordinate cross-agent analysis.`
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
  const { message, conversationId, history, thinkHarder, persona, riskFlowContext, activeConnectors, requestId } = request

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

  // Inject internal connector context based on active connectors
  if (activeConnectors?.includes('riskflow')) {
    try {
      const riskFlowContext2 = await buildRiskFlowContext()
      if (riskFlowContext2) {
        systemPrompt += riskFlowContext2
      }
    } catch (err) {
      log.warn('Failed to build RiskFlow context (non-fatal)', { error: String(err) })
    }
  }

  if (activeConnectors?.includes('aquarium')) {
    try {
      const aquariumContext = await buildAquariumContext()
      if (aquariumContext) {
        systemPrompt += aquariumContext
      }
    } catch (err) {
      log.warn('Failed to build Aquarium context (non-fatal)', { error: String(err) })
    }
  }

  if (activeConnectors?.includes('boardroom')) {
    systemPrompt += buildBoardroomContext()
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
    requestId,
  }

  const result = bridgeChat(bridgeRequest, {
    systemPrompt,
    model: 'opus',
    effort: thinkHarder ? 'high' : 'medium',
    maxTurns: thinkHarder ? 5 : 3,
  })

  return result
}
