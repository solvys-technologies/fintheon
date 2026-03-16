// [claude-code 2026-03-14] Hermes routes to OpenRouter (Nous subscription) + Claude Sonnet 4.6
// [claude-code 2026-03-14] Model routing fix: default→Sonnet 4.6, thinkHarder→Opus via chat.ts
// [claude-code 2026-03-14] Fintheon rebrand: Weekly Tribune intent, updated agent display names (Consul/Censori/Herald)
/**
 * Hermes Handler
 * LOCAL orchestration layer for P.I.C. (Priced In Capital)
 * Processes messages through agent logic, routes to OpenRouter (Sonnet 4.6)
 *
 * Architecture: User Message → Hermes → P.I.C. Agent → OpenRouter (Sonnet 4.6) → Response
 */

import { execFile, spawn as spawnProcess } from 'node:child_process'
import type { HermesAgentRole } from './hermes-service.js'
import { getAgentSystemPrompt, extractSkillTag } from './ai/agent-instructions.js'

export type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }

export interface HermesMessage {
  role: 'user' | 'assistant' | 'system'
  content: string | ContentPart[]
}

// Backward compat
export type OpenClawMessage = HermesMessage

export interface HermesChatRequest {
  message: string
  multimodalContent?: ContentPart[]
  conversationId?: string
  history?: HermesMessage[]
  agentOverride?: HermesAgentRole
  thinkHarder?: boolean
}

// Backward compat
export type OpenClawChatRequest = HermesChatRequest

export interface HermesChatResponse {
  content: string
  agent: HermesAgentRole
  confidence: number
  metadata?: {
    intent: string
    symbols?: string[]
    tradeDirection?: 'long' | 'short' | 'flat'
    riskLevel?: 'low' | 'medium' | 'high'
  }
}

// Backward compat
export type OpenClawChatResponse = HermesChatResponse

// Intent detection patterns
const INTENT_PATTERNS: { pattern: RegExp; agent: HermesAgentRole; intent: string }[] = [
  // Harper/CAO triggers
  { pattern: /\b(earnings.?review|er.?journal|earnings.?journal|post.?earnings.?review)\b/i, agent: 'harper-cao', intent: 'earnings-psych' },
  { pattern: /\b(mdb|morning.?daily.?brief|daily.?report|morning.?brief)/i, agent: 'harper-cao', intent: 'mdb-report' },
  { pattern: /\b(trade.?approval|approve|reject|consolidat)/i, agent: 'harper-cao', intent: 'approval' },
  { pattern: /\b(commandment|rule|13|trading.?rules)/i, agent: 'harper-cao', intent: 'rules' },
  { pattern: /\b(psych|tilt|emotion|mental|eval)/i, agent: 'harper-cao', intent: 'psych-eval' },
  { pattern: /\b(weekly.?tribune|tale.?of.?the.?tape|weekly|recap)/i, agent: 'harper-cao', intent: 'weekly-recap' },

  // Oracle (merged PMA) triggers — S&P, Crypto, Econ, Political
  { pattern: /\b(spy|spx|s&?p|es|nasdaq|qqq|nq)\b/i, agent: 'pma-merged', intent: 'sp-analysis' },
  { pattern: /\b(btc|bitcoin|eth|ethereum|crypto)\b/i, agent: 'pma-merged', intent: 'crypto-analysis' },
  { pattern: /\b(kalshi|prediction.?market|probability)\b/i, agent: 'pma-merged', intent: 'prediction-market' },
  { pattern: /\b(fed|fomc|rate|inflation|cpi|ppi)\b/i, agent: 'pma-merged', intent: 'fed-analysis' },
  { pattern: /\b(election|political|policy|tariff)\b/i, agent: 'pma-merged', intent: 'political-analysis' },
  { pattern: /\b(gdp|employment|jobs|unemployment)\b/i, agent: 'pma-merged', intent: 'econ-analysis' },

  // Herald triggers (News & Sentiment)
  { pattern: /\b(sentiment|news|headline|social|twitter)\b/i, agent: 'herald', intent: 'news-sentiment' },

  // Futures Desk triggers
  { pattern: /(\/nq|\/mnq|\/es|futures|topstep)/i, agent: 'futures-desk', intent: 'futures-trade' },
  { pattern: /\b(fa.?ripper|ripper|setup|entry|exit)\b/i, agent: 'futures-desk', intent: 'setup-analysis' },
  { pattern: /\b(technical|chart|support|resistance|ema|vwap)\b/i, agent: 'futures-desk', intent: 'technical' },

  // Fundamentals Desk triggers
  { pattern: /\b(aapl|apple|msft|microsoft|nvda|nvidia|googl|google|meta|amzn|amazon|tsla|tesla)\b/i, agent: 'fundamentals-desk', intent: 'stock-analysis' },
  { pattern: /\b(earnings|guidance|revenue|margin|pe|valuation)\b/i, agent: 'fundamentals-desk', intent: 'earnings' },
  { pattern: /\b(mega.?cap|mag.?7|big.?tech)\b/i, agent: 'fundamentals-desk', intent: 'megacap' },
]

// Symbol extraction patterns
const SYMBOL_PATTERNS = [
  /\$([A-Z]{1,5})/g,
  /\b([A-Z]{2,5})\b(?=.*(?:stock|share|price|trade|buy|sell))/gi,
  /\b(\/[A-Z]{2,3})\b/g,
  /\b(BTC|ETH|SOL|DOGE)\b/gi
]

/**
 * Detect which P.I.C. agent should handle the message
 */
export function detectAgent(message: string): { agent: HermesAgentRole; intent: string; confidence: number } {
  for (const { pattern, agent, intent } of INTENT_PATTERNS) {
    if (pattern.test(message)) {
      return { agent, intent, confidence: 0.85 }
    }
  }
  return { agent: 'harper-cao', intent: 'general', confidence: 0.6 }
}

/**
 * Extract symbols from message
 */
export function extractSymbols(message: string): string[] {
  const symbols = new Set<string>()
  for (const pattern of SYMBOL_PATTERNS) {
    const matches = message.matchAll(pattern)
    for (const match of matches) {
      symbols.add(match[1].toUpperCase())
    }
  }
  return Array.from(symbols)
}

/**
 * Generate response based on agent persona and message context
 * This is the LOCAL processing - no external API calls
 */
export function generateLocalResponse(
  request: HermesChatRequest,
  agentInfo: { agent: HermesAgentRole; intent: string; confidence: number }
): HermesChatResponse {
  const { agent, intent } = agentInfo
  const symbols = extractSymbols(request.message)
  const skillTag = extractSkillTag(request.message)
  const _agentPrompt = getAgentSystemPrompt(agent, { skillTag, thinkHarder: request.thinkHarder })

  let content: string
  let tradeDirection: 'long' | 'short' | 'flat' | undefined
  let riskLevel: 'low' | 'medium' | 'high' | undefined

  switch (intent) {
    case 'mdb-report':
      content = generateMDBReport()
      break
    case 'weekly-recap':
      content = generateWeeklyRecap()
      break
    case 'psych-eval':
      content = generatePsychEval()
      break
    case 'earnings-psych':
      content = generateFundamentalsAnalysis(symbols, request.message)
      break
    case 'rules':
      content = generateRulesResponse(request.message)
      break
    case 'futures-trade':
    case 'setup-analysis':
      content = generateFuturesAnalysis(symbols, request.message)
      tradeDirection = 'flat'
      riskLevel = 'medium'
      break
    case 'stock-analysis':
    case 'earnings':
    case 'megacap':
      content = generateFundamentalsAnalysis(symbols, request.message)
      break
    case 'prediction-market':
    case 'sp-analysis':
    case 'crypto-analysis':
      content = generatePMAAnalysis(agent, symbols, request.message)
      break
    case 'fed-analysis':
    case 'political-analysis':
    case 'econ-analysis':
      content = generateMacroAnalysis(intent, request.message)
      break
    default:
      content = generateGeneralResponse(agent, request.message)
  }

  return {
    content,
    agent,
    confidence: agentInfo.confidence,
    metadata: {
      intent,
      symbols: symbols.length > 0 ? symbols : undefined,
      tradeDirection,
      riskLevel
    }
  }
}

// Response generators

function generateMDBReport(): string {
  const time = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  return `## MDB Report - ${time}

### Market Status
- **Session**: Pre-market / Regular Hours / After Hours
- **ES Futures**: Awaiting data sync
- **VIX**: Monitoring volatility levels

### Agent Check-In
- **Harper-Hermes/CAO**: Operational
- **Oracle (All-Seer)**: Standing by
- **Feucht (Futures & Risk)**: Ready for setups
- **Consul (Fundamentals)**: Tracking mega-caps
- **Herald (News)**: Monitoring headlines

### Today's Focus
*Hermes is now connected. Agent pipeline ready.*

**Next Steps**: Run "Check the Tape" for real-time market data, or ask about specific setups.`
}

function generateWeeklyRecap(): string {
  return `## The Weekly Tribune

### Performance Overview
*Connecting to trading journal...*

### Key Trades
- Awaiting trade log sync from TopStepX/Kalshi

### ER Status
- Emotional Resilience: **Stable**
- Tilt Events: 0
- Discipline Score: Pending eval

### Lessons Learned
1. Follow the 13 Commandments
2. Good traders buy from good prices (Rule 8)
3. No shot in the dark trades (Rule 3)

*Full analytics available once trading data is synced.*`
}

function generatePsychEval(): string {
  return `## Psychological Evaluation

### Current State Assessment
- **Emotional Baseline**: Neutral
- **Tilt Risk**: Low
- **Trading Readiness**: Evaluating...

### Check-In Questions
1. How are you feeling about today's market?
2. Any revenge trading urges from recent losses?
3. Are you following your trading plan?

### Commandment Reminder
> "There is always another trade" (Rule 1)
> "Be right or be right out" (Rule 12)

*Share your thoughts and I'll provide a detailed assessment.*`
}

function generateRulesResponse(_message: string): string {
  const commandments = [
    "1. There is always another trade",
    "2. The markets will always trade",
    "3. No 'shot in the dark' trades",
    "4. You can not go broke taking profits",
    "5. Know what tape you're trading",
    "6. You never need to make back losses the same way you lost them",
    "7. No doubling down on losers",
    "8. Good traders buy from good prices",
    "9. Good things happen to traders who wait",
    "10. Only fight for things worth fighting for",
    "11. Some days there is nothing to do",
    "12. Be right or be right out",
    "13. There is always another trade"
  ]

  return `## The 13 Commandments of P.I.C.

${commandments.join('\n')}

---
*These rules define our trading discipline. Which one would you like to discuss?*`
}

function generateFuturesAnalysis(symbols: string[], _message: string): string {
  const futures = symbols.filter(s => s.startsWith('/'))
  const symbol = futures[0] || '/NQ'

  return `## Futures Desk Analysis: ${symbol}

### Technical Levels (Pending Data Sync)
- **Current Price**: Awaiting feed
- **Daily High/Low**: --
- **VWAP**: --
- **EMA 9/21/50**: --

### Setup Assessment
*FA Ripper scan pending market data connection*

### Trade Thesis
- Direction: **Awaiting confirmation**
- Entry Zone: TBD
- Stop: TBD (Rule 12: Be right or be right out)
- Target: Minimum 2:1 R:R (Rule 8)

### Risk Check
- Position sizing: Follow max loss rules
- Conviction level: Needs more data

*Connect TopStepX data for live analysis.*`
}

function generateFundamentalsAnalysis(symbols: string[], _message: string): string {
  const symbol = symbols[0] || 'TECH'

  return `## Fundamentals Desk: ${symbol}

### Company Overview
*Pulling fundamental data...*

### Key Metrics (Last Quarter)
- Revenue: Awaiting data
- EPS: Awaiting data
- Guidance: Awaiting data

### Investment Thesis
**Current View**: Awaiting analysis completion

*For real-time fundamentals, ensure data feeds are connected.*`
}

function generatePMAAnalysis(agent: HermesAgentRole, _symbols: string[], _message: string): string {
  const focus = 'S&P 500, Crypto, Economic & Political'

  return `## Oracle (All-Seer) Analysis: ${focus}

### Prediction Market Overview
*Connecting to Kalshi...*

### Current Probabilities
- Awaiting live contract data

### Trade Ideas
*Scan for high-probability setups once data syncs*

*Connect Kalshi API for live prediction market data.*`
}

function generateMacroAnalysis(intent: string, _message: string): string {
  const topic = intent === 'fed-analysis' ? 'Federal Reserve' :
    intent === 'political-analysis' ? 'Political Events' : 'Economic Data'

  return `## Macro Analysis: ${topic}

### Current Environment
*Monitoring macro conditions...*

### Key Events
- Fed meeting schedule: Check calendar
- Economic releases: Pending data sync

### Trading Impact
- Volatility expectation: Moderate
- Position adjustments: None recommended yet

*For real-time macro analysis, connect to news and economic data feeds.*`
}

function generateGeneralResponse(agent: HermesAgentRole, _message: string): string {
  const agentName = {
    'harper-cao': 'Harper-Hermes (CAO)',
    'pma-merged': 'Oracle (All-Seer)',
    'futures-desk': 'Feucht (Futures & Risk)',
    'fundamentals-desk': 'Consul (Fundamentals)',
    'herald': 'Herald (News & Sentiment)'
  }[agent]

  return `## ${agentName} Response

I'm ${agentName}, part of the Hermes P.I.C. agent network.

Your message has been received. Here's what I can help with:

**My Capabilities:**
${agent === 'harper-cao' ? '- MDB Reports & Daily Briefings\n- Trade Approvals\n- Psych Evaluations\n- Trading Rules & Discipline' : ''}
${agent === 'pma-merged' ? '- S&P 500 & Crypto prediction markets\n- Fed/FOMC & macro analysis\n- Political event impact\n- Kalshi contract evaluation' : ''}
${agent === 'futures-desk' ? '- /NQ, /ES, /MNQ trading\n- FA Ripper setups\n- Technical analysis\n- Risk management & exposure monitoring' : ''}
${agent === 'fundamentals-desk' ? '- Mega-cap tech analysis\n- Earnings deep-dives\n- Valuation models' : ''}
${agent === 'herald' ? '- News sentiment analysis\n- Social signal detection\n- Headline impact assessment' : ''}

*Hermes local processing is active.*`
}

const OPENROUTER_OPUS_MODEL = 'anthropic/claude-sonnet-4-6'

/**
 * Main handler — routes through OpenRouter (Nous subscription) + Claude Sonnet 4.6
 */
export async function handleHermesChat(request: HermesChatRequest): Promise<HermesChatResponse> {
  const agentInfo = request.agentOverride
    ? { agent: request.agentOverride, intent: 'override', confidence: 1.0 }
    : detectAgent(request.message)

  const skillTag = extractSkillTag(request.message)
  const systemPrompt = getAgentSystemPrompt(agentInfo.agent, { skillTag, thinkHarder: request.thinkHarder })
  const messages: { role: string; content: string | ContentPart[] }[] = [
    { role: 'system', content: systemPrompt }
  ]

  if (request.history?.length) {
    messages.push(...request.history.map(h => ({ role: h.role, content: h.content })))
  }

  if (request.multimodalContent?.length) {
    messages.push({ role: 'user', content: request.multimodalContent })
  } else {
    messages.push({ role: 'user', content: request.message })
  }

  const apiKey = process.env.OPENROUTER_API_KEY ?? ''
  const baseUrl = 'https://openrouter.ai/api/v1'

  if (!apiKey) {
    console.warn('[Hermes] OPENROUTER_API_KEY not set, using local fallback')
    return generateLocalResponse(request, agentInfo)
  }

  console.log(`[Hermes] Calling OpenRouter (Sonnet 4.6) for agent ${agentInfo.agent} (${messages.length} messages)`)

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.OPENROUTER_APP_URL ?? 'https://pulse-solvys.vercel.app',
        'X-Title': process.env.OPENROUTER_APP_NAME ?? 'Pulse-AI-Gateway',
      },
      body: JSON.stringify({
        model: OPENROUTER_OPUS_MODEL,
        messages,
        max_tokens: 8192,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`[Hermes] OpenRouter error ${response.status}: ${errorText}`)
      return generateLocalResponse(request, agentInfo)
    }

    const data = await response.json() as {
      choices?: { message?: { content?: string } }[]
    }
    const content = data.choices?.[0]?.message?.content ?? ''

    if (!content) {
      console.warn('[Hermes] Empty response from OpenRouter, using local fallback')
      return generateLocalResponse(request, agentInfo)
    }

    console.log(`[Hermes] OpenRouter (Sonnet 4.6) response received: ${content.substring(0, 50)}...`)

    return {
      content,
      agent: agentInfo.agent,
      confidence: agentInfo.confidence,
      metadata: {
        intent: agentInfo.intent,
        symbols: extractSymbols(request.message)
      }
    }
  } catch (error) {
    console.error('[Hermes] OpenRouter request failed:', error)
    return generateLocalResponse(request, agentInfo)
  }
}

// Backward compat
export const handleOpenClawChat = handleHermesChat

/**
 * Initialize Hermes agent on startup:
 * 1. Optionally launch Hermes gateway process if configured
 * 2. Warm up OpenRouter (Sonnet 4.6) connection with a Harper (CAO) ping
 */
export async function initHermesAgent(): Promise<void> {
  const hermesBin = process.env.HERMES_BINARY_PATH ?? 'hermes'

  try {
    const gatewayRunning = await new Promise<boolean>((resolve) => {
      execFile(hermesBin, ['gateway', 'status'], { timeout: 5_000 }, (err, stdout) => {
        if (err) { resolve(false); return }
        resolve(stdout.toLowerCase().includes('running'))
      })
    })
    if (!gatewayRunning) {
      console.log('[Hermes] Gateway not running — starting...')
      const gw = spawnProcess(hermesBin, ['gateway', 'start'], { stdio: 'ignore', detached: true })
      gw.unref()
      console.log('[Hermes] Gateway start dispatched (PID:', gw.pid, ')')
    } else {
      console.log('[Hermes] Gateway already running')
    }
  } catch (err) {
    console.warn(`[Hermes] Gateway launch skipped (non-fatal): ${err instanceof Error ? err.message : String(err)}`)
  }

  const apiKey = process.env.OPENROUTER_API_KEY ?? ''
  if (!apiKey) {
    console.log('[Hermes] OPENROUTER_API_KEY not set — skipping OpenRouter warm-up')
    return
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15_000)
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.OPENROUTER_APP_URL ?? 'https://pulse-solvys.vercel.app',
        'X-Title': process.env.OPENROUTER_APP_NAME ?? 'Pulse-AI-Gateway',
      },
      body: JSON.stringify({
        model: OPENROUTER_OPUS_MODEL,
        messages: [
          { role: 'system', content: 'You are Harper, CAO of Priced In Capital.' },
          { role: 'user', content: '[SYSTEM] Agent initialization ping — confirm availability.' },
        ],
        max_tokens: 64,
      }),
      signal: controller.signal,
    })
    clearTimeout(timeout)
    if (response.ok) {
      console.log('[Hermes] OpenRouter (Sonnet 4.6) warm-up complete (harper-cao ready)')
    } else {
      console.warn(`[Hermes] OpenRouter warm-up failed (non-fatal): HTTP ${response.status}`)
    }
  } catch (error) {
    console.warn(`[Hermes] OpenRouter warm-up failed (non-fatal): ${error instanceof Error ? error.message : String(error)}`)
  }
}

// Backward compat
export const initOpenClawAgent = initHermesAgent

/**
 * Stream Hermes response
 */
export async function* streamHermesChat(request: HermesChatRequest): AsyncGenerator<string> {
  const response = await handleHermesChat(request)
  const content = response.content
  const chunkSize = 20

  for (let i = 0; i < content.length; i += chunkSize) {
    yield content.slice(i, i + chunkSize)
    await new Promise(resolve => setTimeout(resolve, 10))
  }
}

// Backward compat
export const streamOpenClawChat = streamHermesChat
