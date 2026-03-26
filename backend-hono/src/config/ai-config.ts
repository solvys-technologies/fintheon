// [claude-code 2026-03-14] Default inference: OpenRouter (Nous subscription) + Claude Opus 4.6; Groq removed as primary
import priceSystemPrompt from '../prompts/price-system-prompt.js'
import type { AiProviderType, CrossProviderFallback } from '../types/ai-types.js'

type Env = Record<string, string | undefined>

const getEnv = (key: string): string | undefined => {
  const env = (globalThis as { process?: { env?: Env } }).process?.env
  return env?.[key]
}

// Model keys - OpenRouter provides alternative routes to same models
export type AiModelKey =
  | 'sonnet'
  | 'grok'
  // OpenRouter alternative routes
  | 'openrouter-sonnet'  // Claude Sonnet 4.5 via OpenRouter
  | 'openrouter-opus'    // Claude Opus 4.5 via OpenRouter
  | 'openrouter-grok'    // Grok 4.1 via OpenRouter
  // Hermes P.I.C. agent keys (routed to OpenRouter Opus 4.6 via Nous subscription)
  | 'hermes-cao'         // CAO/Harper reasoning
  | 'hermes-research'    // Deep research
  | 'hermes-fast'        // Fast analysis
  | 'hermes-realtime'    // Real-time
  // Claude Code SDK Bridge (free via Max subscription)
  | 'claude-local'      // Claude Opus via local CLI bridge
  // GitHub Models (free, OAuth-powered)
  | 'github-deepseek'   // DeepSeek R1 via GitHub Models
  // Nous Research direct inference (fallback when OpenRouter DNS fails)
  | 'nous-direct'       // Hermes 4 405B via inference-api.nousresearch.com

export type AiProvider = 'openai-compatible'

export interface AiModelConfig {
  id: string
  displayName: string
  provider: AiProvider
  providerType: AiProviderType
  apiKeyEnv: string
  baseUrl?: string
  temperature: number
  maxTokens: number
  timeoutMs: number
  costPer1kInputUsd: number
  costPer1kOutputUsd: number
  contextWindow?: number
  supportsStreaming?: boolean
  supportsVision?: boolean
}

export interface AiRoutingConfig {
  defaultModel: AiModelKey
  taskModelMap: Record<string, AiModelKey>
  fallbackMap: Record<AiModelKey, AiModelKey>
  crossProviderFallbacks: CrossProviderFallback[]
}

export interface AiProviderSettings {
  primary: AiProviderType
  enableFallback: boolean
  openRouter: {
    baseUrl: string
    appUrl: string
    appName: string
  }
  vercelGateway: {
    baseUrl: string
  }
  hermes: {
    baseUrl: string
    appName: string
  }
  githubModels: {
    baseUrl: string
  }
}

export interface AiConversationConfig {
  maxHistoryMessages: number
  maxContextTokens: number
  summarizationThreshold: number
}

export interface AiPerformanceConfig {
  slowResponseMs: number
}

export interface AiConfig {
  models: Record<AiModelKey, AiModelConfig>
  routing: AiRoutingConfig
  providers: AiProviderSettings
  conversation: AiConversationConfig
  performance: AiPerformanceConfig
  systemPrompt?: string
}

// Provider base URLs
const vercelGatewayBaseUrl =
  getEnv('VERCEL_AI_GATEWAY_BASE_URL') ?? 'https://ai-gateway.vercel.sh/v1/chat/completions'

const openRouterBaseUrl = 'https://openrouter.ai/api/v1'
const githubModelsBaseUrl = 'https://models.inference.ai.azure.com'

// OpenRouter (Nous subscription) — primary inference; Hermes base URL optional for legacy
const normalizeHermesBaseUrl = (value: string): string => {
  const trimmed = value.trim().replace(/\/+$/, '')
  return trimmed.endsWith('/v1') ? trimmed.slice(0, -3) : trimmed
}

const getHermesOpenAIBaseUrl = (): string => {
  const base = normalizeHermesBaseUrl(
    getEnv('HERMES_BASE_URL') ?? getEnv('OPENROUTER_BASE_URL') ?? 'https://openrouter.ai/api'
  )
  return base.includes('openrouter') ? `${base}/v1` : `${base}/v1`
}

// Model aliases for backward compatibility
const modelAliases: Record<string, AiModelKey> = {
  // Vercel Gateway models
  sonnet: 'sonnet',
  'claude-sonnet': 'sonnet',
  'sonnet-4.5': 'sonnet',
  opus: 'sonnet',
  grok: 'grok',
  'grok-4.1': 'grok',
  general: 'grok',
  groq: 'openrouter-opus',
  'llama-3.3-70b': 'openrouter-sonnet',
  haiku: 'openrouter-opus',
  tech: 'openrouter-opus',
  // OpenRouter alternative routes
  'openrouter-sonnet': 'openrouter-sonnet',
  'openrouter-claude': 'openrouter-sonnet',
  'openrouter-opus': 'openrouter-opus',
  'llama-70b': 'openrouter-sonnet',
  'openrouter-grok': 'openrouter-grok',
  'grok-openrouter': 'openrouter-grok',
  // Hermes P.I.C. agent routes
  'hermes-cao': 'openrouter-opus',
  'harper': 'openrouter-opus',
  'cao': 'openrouter-opus',
  'hermes-research': 'openrouter-opus',
  'pic-research': 'openrouter-opus',
  'hermes-fast': 'openrouter-opus',
  'pic-fast': 'openrouter-opus',
  'hermes-realtime': 'openrouter-opus',
  'pic-realtime': 'openrouter-opus',
  'pma': 'openrouter-opus',
  // Claude Code SDK Bridge (Max subscription)
  'claude-local': 'claude-local',
  'claude-sdk': 'claude-local',
  'claude-max': 'claude-local',
  'opus-local': 'claude-local',
  // GitHub Models (GPT-4o fallback)
  'github-deepseek': 'github-deepseek',
  'github-gpt4o': 'github-deepseek',
  'github-models': 'github-deepseek',
  'gpt4o-free': 'github-deepseek',
  // Nous Direct (fallback)
  'nous-direct': 'nous-direct',
  'nous': 'nous-direct',
  'hermes-direct': 'nous-direct',
  'nous-fallback': 'nous-direct'
}

export const resolveModelKey = (value?: string): AiModelKey | undefined => {
  if (!value) return undefined
  return modelAliases[value.toLowerCase()]
}

// Determine primary provider from env
const getPrimaryProvider = (): AiProviderType => {
  const envValue = getEnv('AI_PRIMARY_PROVIDER')
  if (envValue === 'vercel-gateway') return 'vercel-gateway'
  if (envValue === 'openrouter') return 'openrouter'
  if (envValue === 'hermes') return 'hermes'
  // Default to openrouter if API key is present
  return getEnv('OPENROUTER_API_KEY') ? 'openrouter' : 'vercel-gateway'
}

const enableProviderFallback = getEnv('AI_ENABLE_PROVIDER_FALLBACK') !== 'false'

// Default: Sonnet 4.6 via OpenRouter (Nous subscription)
const defaultModel = resolveModelKey(getEnv('AI_DEFAULT_MODEL'))
  ?? (getEnv('OPENROUTER_API_KEY') ? 'openrouter-sonnet' as AiModelKey : 'openrouter-opus')

export const defaultAiConfig: AiConfig = {
  models: {
    // Vercel Gateway models (existing)
    sonnet: {
      id: 'anthropic/claude-sonnet-4.5',
      displayName: 'Claude Sonnet 4.5',
      provider: 'openai-compatible',
      providerType: 'vercel-gateway',
      apiKeyEnv: 'VERCEL_AI_GATEWAY_API_KEY',
      baseUrl: vercelGatewayBaseUrl,
      temperature: 0.4,
      maxTokens: 4096,
      timeoutMs: 45_000,
      costPer1kInputUsd: 0.003,
      costPer1kOutputUsd: 0.015,
      contextWindow: 200_000,
      supportsStreaming: true,
      supportsVision: true
    },
    grok: {
      id: 'xai/grok-4.1',
      displayName: 'Grok 4.1 Reasoning',
      provider: 'openai-compatible',
      providerType: 'vercel-gateway',
      apiKeyEnv: 'VERCEL_AI_GATEWAY_API_KEY',
      baseUrl: vercelGatewayBaseUrl,
      temperature: 0.4,
      maxTokens: 2048,
      timeoutMs: 30_000,
      costPer1kInputUsd: 0.003,
      costPer1kOutputUsd: 0.015,
      contextWindow: 128_000,
      supportsStreaming: true,
      supportsVision: false
    },
    // OpenRouter alternative routes (same models, different provider)
    'openrouter-sonnet': {
      id: 'anthropic/claude-sonnet-4',
      displayName: 'Claude Sonnet 4.5 (OpenRouter)',
      provider: 'openai-compatible',
      providerType: 'openrouter',
      apiKeyEnv: 'OPENROUTER_API_KEY',
      baseUrl: openRouterBaseUrl,
      temperature: 0.4,
      maxTokens: 4096,
      timeoutMs: 60_000,
      costPer1kInputUsd: 0.003,
      costPer1kOutputUsd: 0.015,
      contextWindow: 200_000,
      supportsStreaming: true,
      supportsVision: true
    },
    'openrouter-grok': {
      id: 'x-ai/grok-4',
      displayName: 'Grok 4.1 (OpenRouter)',
      provider: 'openai-compatible',
      providerType: 'openrouter',
      apiKeyEnv: 'OPENROUTER_API_KEY',
      baseUrl: openRouterBaseUrl,
      temperature: 0.3,
      maxTokens: 4096,
      timeoutMs: 45_000,
      costPer1kInputUsd: 0.003,
      costPer1kOutputUsd: 0.015,
      contextWindow: 128_000,
      supportsStreaming: true,
      supportsVision: false
    },
    'openrouter-opus': {
      id: 'anthropic/claude-opus-4.6',
      displayName: 'Claude Opus 4.6 (OpenRouter / Nous)',
      provider: 'openai-compatible',
      providerType: 'openrouter',
      apiKeyEnv: 'OPENROUTER_API_KEY',
      baseUrl: openRouterBaseUrl,
      temperature: 0.4,
      maxTokens: 8192,
      timeoutMs: 90_000,
      costPer1kInputUsd: 0.005,
      costPer1kOutputUsd: 0.025,
      contextWindow: 1_000_000,
      supportsStreaming: true,
      supportsVision: true
    },

    // Hermes P.I.C. agent keys — resolve to OpenRouter Opus 4.6 (same config as openrouter-opus)
    'hermes-cao': {
      id: 'anthropic/claude-opus-4.6',
      displayName: 'Claude Opus 4.6 (Hermes CAO)',
      provider: 'openai-compatible',
      providerType: 'openrouter',
      apiKeyEnv: 'OPENROUTER_API_KEY',
      baseUrl: openRouterBaseUrl,
      temperature: 0.3,
      maxTokens: 8192,
      timeoutMs: 90_000,
      costPer1kInputUsd: 0.005,
      costPer1kOutputUsd: 0.025,
      contextWindow: 1_000_000,
      supportsStreaming: true,
      supportsVision: true
    },
    'hermes-research': {
      id: 'anthropic/claude-opus-4.6',
      displayName: 'Claude Opus 4.6 (Hermes Research)',
      provider: 'openai-compatible',
      providerType: 'openrouter',
      apiKeyEnv: 'OPENROUTER_API_KEY',
      baseUrl: openRouterBaseUrl,
      temperature: 0.4,
      maxTokens: 8192,
      timeoutMs: 90_000,
      costPer1kInputUsd: 0.005,
      costPer1kOutputUsd: 0.025,
      contextWindow: 1_000_000,
      supportsStreaming: true,
      supportsVision: true
    },
    'hermes-fast': {
      id: 'anthropic/claude-opus-4.6',
      displayName: 'Claude Opus 4.6 (Hermes Fast)',
      provider: 'openai-compatible',
      providerType: 'openrouter',
      apiKeyEnv: 'OPENROUTER_API_KEY',
      baseUrl: openRouterBaseUrl,
      temperature: 0.25,
      maxTokens: 8192,
      timeoutMs: 90_000,
      costPer1kInputUsd: 0.005,
      costPer1kOutputUsd: 0.025,
      contextWindow: 1_000_000,
      supportsStreaming: true,
      supportsVision: true
    },
    'hermes-realtime': {
      id: 'anthropic/claude-opus-4.6',
      displayName: 'Claude Opus 4.6 (Hermes Realtime)',
      provider: 'openai-compatible',
      providerType: 'openrouter',
      apiKeyEnv: 'OPENROUTER_API_KEY',
      baseUrl: openRouterBaseUrl,
      temperature: 0.3,
      maxTokens: 8192,
      timeoutMs: 90_000,
      costPer1kInputUsd: 0.005,
      costPer1kOutputUsd: 0.025,
      contextWindow: 1_000_000,
      supportsStreaming: true,
      supportsVision: true
    },

    // GitHub Models (free via GitHub OAuth) — fallback model
    'github-deepseek': {
      id: getEnv('GITHUB_MODELS_MODEL_ID') ?? 'gpt-4o',
      displayName: 'GPT-4o (GitHub Models)',
      provider: 'openai-compatible',
      providerType: 'github-models',
      apiKeyEnv: 'GITHUB_TOKEN',
      baseUrl: githubModelsBaseUrl,
      temperature: 0.4,
      maxTokens: 4096,
      timeoutMs: 30_000,
      costPer1kInputUsd: 0,
      costPer1kOutputUsd: 0,
      contextWindow: 128_000,
      supportsStreaming: true,
      supportsVision: true
    },

    // Nous Research direct inference — fallback when OpenRouter DNS is unreachable
    'nous-direct': {
      id: 'nousresearch/hermes-4-405b',
      displayName: 'Hermes 4 405B (Nous Direct)',
      provider: 'openai-compatible',
      providerType: 'nous-direct',
      apiKeyEnv: 'NOUS_API_KEY',
      baseUrl: 'https://inference-api.nousresearch.com/v1',
      temperature: 0.4,
      maxTokens: 4096,
      timeoutMs: 60_000,
      costPer1kInputUsd: 0.001,
      costPer1kOutputUsd: 0.003,
      contextWindow: 128_000,
      supportsStreaming: true,
      supportsVision: false
    },

    // Claude Code SDK Bridge (free via Max subscription — $0 per-token cost)
    // [claude-code 2026-03-10] Local CLI bridge using claude --print --output-format stream-json
    'claude-local': {
      id: 'claude-opus-4-6',
      displayName: 'Claude Opus (Local SDK)',
      provider: 'openai-compatible',
      providerType: 'claude-local',
      apiKeyEnv: '', // No API key needed — uses Max subscription via CLI
      temperature: 0.4,
      maxTokens: 16384,
      timeoutMs: 120_000,
      costPer1kInputUsd: 0,
      costPer1kOutputUsd: 0,
      contextWindow: 200_000,
      supportsStreaming: true,
      supportsVision: true
    }
  },

  routing: {
    defaultModel,
    taskModelMap: {
      // All tasks through OpenRouter (Nous subscription) — Claude Opus 4.6
      analysis: 'openrouter-opus',
      research: 'openrouter-opus',
      reasoning: 'openrouter-opus',
      technical: 'openrouter-opus',
      'quick-fintheon': 'openrouter-opus',
      quickfintheon: 'openrouter-opus',
      news: 'openrouter-opus',
      sentiment: 'openrouter-opus',
      chat: 'openrouter-opus',
      general: 'openrouter-opus',
      'harper-cao': 'openrouter-opus',
      'cao-approval': 'openrouter-opus',
      'cao-consolidation': 'openrouter-opus',
      'pma-merged': 'openrouter-opus',
      'herald': 'openrouter-opus',
      'prediction-market': 'openrouter-opus',
      'futures-desk': 'openrouter-opus',
      'fa-rippers': 'openrouter-opus',
      'economic-analysis': 'openrouter-opus',
      'fundamentals-desk': 'openrouter-opus',
      'earnings-analysis': 'openrouter-opus',
      'tech-mega-cap': 'openrouter-opus'
    },
    // OpenRouter + Hermes fallback chain (Claude only, no llama)
    fallbackMap: {
      sonnet: 'openrouter-sonnet',
      grok: 'openrouter-grok',
      'openrouter-sonnet': 'openrouter-opus',
      'openrouter-opus': 'nous-direct',
      'openrouter-grok': 'openrouter-sonnet',
      // Hermes fallbacks (fall back to OpenRouter equivalents)
      'hermes-cao': 'openrouter-opus',
      'hermes-research': 'openrouter-sonnet',
      'hermes-fast': 'openrouter-sonnet',
      'hermes-realtime': 'openrouter-grok',
      // Claude Local SDK fallback to OpenRouter Opus
      'claude-local': 'openrouter-opus',
      // GitHub Models fallback to OpenRouter
      'github-deepseek': 'openrouter-sonnet',
      // Nous Direct is terminal — no further fallback
      'nous-direct': 'openrouter-sonnet'
    },
    // Cross-provider fallbacks (all within OpenRouter now)
    crossProviderFallbacks: []
  },

  providers: {
    primary: getPrimaryProvider(),
    enableFallback: enableProviderFallback,
    openRouter: {
      baseUrl: openRouterBaseUrl,
      appUrl: getEnv('OPENROUTER_APP_URL') ?? 'https://fintheon-solvys.vercel.app',
      appName: getEnv('OPENROUTER_APP_NAME') ?? 'Fintheon-AI-Gateway'
    },
    vercelGateway: {
      baseUrl: vercelGatewayBaseUrl
    },
    hermes: {
      baseUrl: getHermesOpenAIBaseUrl(),
      appName: getEnv('HERMES_APP_NAME') ?? 'Fintheon-PIC-Hermes'
    },
    githubModels: {
      baseUrl: githubModelsBaseUrl
    }
  },

  conversation: {
    maxHistoryMessages: Number.parseInt(getEnv('AI_MAX_HISTORY_MESSAGES') ?? '50', 10),
    maxContextTokens: Number.parseInt(getEnv('AI_MAX_CONTEXT_TOKENS') ?? '100000', 10),
    summarizationThreshold: Number.parseInt(getEnv('AI_SUMMARIZATION_THRESHOLD') ?? '80000', 10),
  },

  performance: {
    slowResponseMs: Number.parseInt(getEnv('AI_SLOW_RESPONSE_MS') ?? '3000', 10)
  },

  systemPrompt: priceSystemPrompt
}

// Helper to check if a model uses OpenRouter
export const isOpenRouterModel = (modelKey: AiModelKey): boolean => {
  return modelKey.startsWith('openrouter-')
}

// Hermes agent keys (routed to OpenRouter Opus 4.6)
export const isHermesModel = (modelKey: AiModelKey): boolean => {
  return modelKey.startsWith('hermes-')
}

// Helper to check if a model uses GitHub Models
export const isGitHubModelsModel = (modelKey: AiModelKey): boolean => {
  return modelKey.startsWith('github-')
}

// Helper to check if a model uses Claude Local SDK bridge
export const isClaudeLocalModel = (modelKey: AiModelKey): boolean => {
  return modelKey === 'claude-local'
}

// Helper to check if a model uses Nous Research direct inference
export const isNousDirectModel = (modelKey: AiModelKey): boolean => {
  return modelKey === 'nous-direct'
}

// Get the model ID for Hermes agent keys (OpenRouter Opus 4.6)
export const getHermesModelId = (modelKey: AiModelKey): string => {
  const config = defaultAiConfig.models[modelKey]
  return config?.id ?? 'anthropic/claude-opus-4.6'
}

// Helper to get equivalent model across providers
export const getCrossProviderEquivalent = (
  modelKey: AiModelKey,
  config: AiConfig = defaultAiConfig
): { model: AiModelKey; provider: AiProviderType } | null => {
  const fallback = config.routing.crossProviderFallbacks.find((f) => f.from === modelKey)
  if (fallback) {
    return { model: fallback.to as AiModelKey, provider: fallback.provider }
  }
  return null
}

// Get all models for a specific provider
export const getModelsByProvider = (
  providerType: AiProviderType,
  config: AiConfig = defaultAiConfig
): AiModelKey[] => {
  return (Object.keys(config.models) as AiModelKey[]).filter(
    (key) => config.models[key].providerType === providerType
  )
}
