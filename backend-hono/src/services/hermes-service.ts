// [claude-code 2026-03-14] Hermes inference via OpenRouter (Nous) + Claude Opus 4.6
/**
 * Hermes Service
 * Agentic backend layer for Priced In Capital (P.I.C.)
 * Orchestrates AI agents: Harper-Hermes (CAO), Oracle (All-Seer), Feucht (Futures & Risk), Consul (Fundamentals), Herald (News)
 *
 * Architecture: HERMES AGENT → FINTHEON UI → H.E's (Human Executives)
 * Inference: OpenRouter (Nous subscription) + Claude Opus 4.6
 */

import { createOpenAI } from '@ai-sdk/openai'
import type { AiProviderType, AiRequestCost } from '../types/ai-types.js'

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1'
const HERMES_BASE_URL = process.env.OPENROUTER_BASE_URL
  ? `${process.env.OPENROUTER_BASE_URL.replace(/\/+$/, '')}/v1`
  : OPENROUTER_BASE
const HERMES_API_KEY = process.env.OPENROUTER_API_KEY

// [claude-code 2026-03-16] Agent roster v7.9: merged PMA, added Herald
// P.I.C. Agent Hierarchy
export type HermesAgentRole =
  | 'harper-cao'          // Chief Agentic Officer - Executive level
  | 'pma-merged'          // Oracle: All-Seer (merged PMA-1 + PMA-2)
  | 'futures-desk'        // Feucht: Futures, Execution & Risk
  | 'fundamentals-desk'   // Consul: Tech Mega-Cap Analyst
  | 'herald'              // Herald: News & Sentiment

// Backward compat alias
export type OpenClawAgentRole = HermesAgentRole

export type HermesAgentStatus = 'operational' | 'monitoring' | 'awaiting-approval' | 'hedging' | 'standby' | 'offline'

export interface HermesAgent {
  id: string
  role: HermesAgentRole
  displayName: string
  status: HermesAgentStatus
  lastCheckin: Date
  scope: string
  reportsTo: HermesAgentRole | 'human-executives'
}

export interface HermesTradeProposal {
  id: string
  sourceAgent: HermesAgentRole
  symbol: string
  direction: 'long' | 'short'
  instrument: 'futures' | 'prediction-market'
  platform: 'topstep' | 'kalshi'
  entry: number
  stop: number
  target: number
  rationale: string
  conviction: 'high' | 'medium' | 'low'
  riskReward: number
  strategy: string
  timestamp: Date
  status: 'pending' | 'approved' | 'rejected' | 'executed' | 'expired'
  approvedBy?: string
  approvedAt?: Date
}

export interface HermesAlert {
  id: string
  type: 'session-open' | 'off-schedule-event' | 'hot-print' | 'black-swan' | 'risk-warning'
  sourceAgent: HermesAgentRole
  priority: 'critical' | 'high' | 'medium' | 'low'
  title: string
  detail: string
  symbols?: string[]
  timestamp: Date
  acknowledged: boolean
}

export interface HermesDailyReport {
  id: string
  date: string
  pnl: number
  trades: HermesTradeProposal[]
  bias: 'bullish' | 'bearish' | 'neutral' | 'selective'
  mdbReport: string // Dawn Dispatch report
  timestamp: Date
}

export interface HermesClientConfig {
  apiKey: string
  baseUrl?: string
  appName?: string
}

// Agent definitions following P.I.C. hierarchy (v7.9)
const HERMES_AGENTS: Record<HermesAgentRole, Omit<HermesAgent, 'id' | 'lastCheckin' | 'status'>> = {
  'harper-cao': {
    role: 'harper-cao',
    displayName: 'Harper-Hermes / CAO',
    scope: 'Macro oversight, approvals, trade consolidation',
    reportsTo: 'human-executives'
  },
  'pma-merged': {
    role: 'pma-merged',
    displayName: 'Oracle (All-Seer)',
    scope: 'Prediction markets (S&P, Crypto, Econ, Political) + execution oversight',
    reportsTo: 'harper-cao'
  },
  'futures-desk': {
    role: 'futures-desk',
    displayName: 'Feucht (Futures & Risk)',
    scope: '/NQ, /MNQ, /ES trading via TopStepX + risk management',
    reportsTo: 'harper-cao'
  },
  'fundamentals-desk': {
    role: 'fundamentals-desk',
    displayName: 'Consul (Fundamentals)',
    scope: 'Top 10 S&P/NDX tech watchlist + mega-cap analysis',
    reportsTo: 'harper-cao'
  },
  'herald': {
    role: 'herald',
    displayName: 'Herald (News & Sentiment)',
    scope: 'News sentiment, social signals, headline impact',
    reportsTo: 'harper-cao'
  }
}

// All P.I.C. agents use OpenRouter Claude Opus 4.6 (Nous subscription)
export const HERMES_TASK_MODEL_MAP: Record<string, string> = {
  'harper-cao': 'anthropic/claude-opus-4.6',
  'cao-approval': 'anthropic/claude-opus-4.6',
  'cao-consolidation': 'anthropic/claude-opus-4.6',
  'pma-merged': 'anthropic/claude-opus-4.6',
  'prediction-market': 'anthropic/claude-opus-4.6',
  'futures-desk': 'anthropic/claude-opus-4.6',
  'fa-rippers': 'anthropic/claude-opus-4.6',
  'economic-analysis': 'anthropic/claude-opus-4.6',
  'fundamentals-desk': 'anthropic/claude-opus-4.6',
  'earnings-analysis': 'anthropic/claude-opus-4.6',
  'tech-mega-cap': 'anthropic/claude-opus-4.6',
  'herald': 'anthropic/claude-opus-4.6',
}

// Backward compat
export const OPENCLAW_TASK_MODEL_MAP = HERMES_TASK_MODEL_MAP

/**
 * Build headers for OpenRouter API calls
 */
export const buildHermesHeaders = (config?: {
  appName?: string
}): Record<string, string> => {
  const appName = config?.appName ?? process.env.HERMES_APP_NAME ?? 'Fintheon-PIC-Hermes'

  return {
    'X-Hermes-App': appName,
    'Content-Type': 'application/json',
  }
}

// Backward compat
export const buildOpenClawHeaders = buildHermesHeaders

/**
 * Check if Hermes / OpenRouter is available
 */
export const isHermesAvailable = (): boolean => {
  return Boolean(HERMES_API_KEY && HERMES_API_KEY.length > 0)
}

// Backward compat
export const isOpenClawAvailable = isHermesAvailable

/**
 * Create a Hermes client using OpenAI-compatible interface
 * Calls OpenRouter (Opus 4.6) via Nous subscription
 */
export const createHermesClient = (modelId?: string) => {
  if (!HERMES_API_KEY) {
    throw new Error('Missing OPENROUTER_API_KEY environment variable')
  }

  const headers = buildHermesHeaders()

  const hermes = createOpenAI({
    apiKey: HERMES_API_KEY,
    baseURL: HERMES_BASE_URL,
    headers: {
      ...(headers as Record<string, string>),
      'HTTP-Referer': process.env.OPENROUTER_APP_URL ?? 'https://fintheon-solvys.vercel.app',
      'X-Title': process.env.OPENROUTER_APP_NAME ?? 'Fintheon-AI-Gateway',
    },
  })

  return hermes(modelId ?? 'anthropic/claude-opus-4.6')
}

// Backward compat
export const createOpenClawClient = createHermesClient

/**
 * Get agent definition by role
 */
export const getAgentDefinition = (role: HermesAgentRole): Omit<HermesAgent, 'id' | 'lastCheckin' | 'status'> => {
  return HERMES_AGENTS[role]
}

/**
 * Get all agent definitions
 */
export const getAllAgentDefinitions = (): typeof HERMES_AGENTS => {
  return HERMES_AGENTS
}

/**
 * Get the recommended model for a task
 */
export const getModelForTask = (task: string): string | undefined => {
  const normalizedTask = task.toLowerCase().replace(/[^a-z0-9-]/g, '-')
  return HERMES_TASK_MODEL_MAP[normalizedTask]
}

/**
 * Map agent role to AI task type for model selection
 */
export const agentRoleToTaskType = (role: HermesAgentRole): string => {
  switch (role) {
    case 'harper-cao':
      return 'reasoning'
    case 'pma-merged':
      return 'prediction-market'
    case 'herald':
      return 'news-sentiment'
    case 'futures-desk':
      return 'technical'
    case 'fundamentals-desk':
      return 'research'
    default:
      return 'general'
  }
}

/**
 * Calculate cost from token usage (OpenRouter Opus 4.6 pricing)
 */
export const calculateHermesCost = (
  usage: { inputTokens?: number; outputTokens?: number },
  model: string
): AiRequestCost => {
  const inputTokens = usage.inputTokens ?? 0
  const outputTokens = usage.outputTokens ?? 0
  const totalTokens = inputTokens + outputTokens

  const pricing: Record<string, { input: number; output: number }> = {
    'anthropic/claude-opus-4.6': { input: 0.005, output: 0.025 },
  }

  const modelPricing = pricing[model] ?? { input: 0.005, output: 0.025 }

  const inputCostUsd = (inputTokens / 1000) * modelPricing.input
  const outputCostUsd = (outputTokens / 1000) * modelPricing.output
  const totalCostUsd = inputCostUsd + outputCostUsd

  return {
    provider: 'hermes' as AiProviderType,
    model,
    inputTokens,
    outputTokens,
    totalTokens,
    inputCostUsd,
    outputCostUsd,
    totalCostUsd,
    timestamp: new Date().toISOString()
  }
}

// Backward compat
export const calculateOpenClawCost = calculateHermesCost

/**
 * Check if an error is a rate limit error
 */
export const isHermesRateLimitError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') return false

  const status =
    (error as { status?: number }).status ?? (error as { statusCode?: number }).statusCode
  if (status === 429) return true

  const message = 'message' in error ? String((error as { message?: string }).message) : ''
  return (
    message.toLowerCase().includes('rate limit') ||
    message.toLowerCase().includes('too many requests')
  )
}

// Backward compat
export const isOpenClawRateLimitError = isHermesRateLimitError

/**
 * Check if an error is retryable
 */
export const isHermesRetryableError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') return false

  if (isHermesRateLimitError(error)) return true

  const status =
    (error as { status?: number }).status ?? (error as { statusCode?: number }).statusCode ?? null

  if (status && [408, 500, 502, 503, 504].includes(status)) {
    return true
  }

  const message = 'message' in error ? String((error as { message?: string }).message).toLowerCase() : ''
  return (
    message.includes('timeout') ||
    message.includes('network') ||
    message.includes('connection')
  )
}

// Backward compat
export const isOpenClawRetryableError = isHermesRetryableError

/**
 * P.I.C. Trading Rules validation
 * Validates proposals against the 13 Commandments
 */
export const validateTradeProposal = (proposal: Partial<HermesTradeProposal>): {
  valid: boolean
  violations: string[]
} => {
  const violations: string[] = []

  // Rule 3: No "shot in the dark" trades — conviction required
  if (!proposal.conviction || proposal.conviction === 'low') {
    violations.push('Rule 3: No "shot in the dark" trades - conviction must be medium or high')
  }

  // Rule 8: Good traders buy from good prices
  if (proposal.riskReward && proposal.riskReward < 2) {
    violations.push('Rule 8: Risk/reward must be at least 2:1 for good trade entries')
  }

  // Check stop is defined (Rule 12: Be right or be right out)
  if (!proposal.stop) {
    violations.push('Rule 12: Stop loss must be defined - no painful endings')
  }

  return {
    valid: violations.length === 0,
    violations
  }
}

/**
 * Hermes model IDs used by P.I.C. (OpenRouter Opus 4.6)
 */
export const HERMES_MODELS = {
  CAO_REASONING: 'anthropic/claude-opus-4.6',
  FAST_ANALYSIS: 'anthropic/claude-opus-4.6',
  NEWS_REALTIME: 'anthropic/claude-opus-4.6',
  RESEARCH: 'anthropic/claude-opus-4.6',
} as const

// Backward compat
export const OPENCLAW_MODELS = HERMES_MODELS

export type HermesModelId = (typeof HERMES_MODELS)[keyof typeof HERMES_MODELS]
