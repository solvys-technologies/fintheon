// [claude-code 2026-03-14] Default: OpenRouter (Nous) + Claude Sonnet 4.6; Groq removed
// [claude-code 2026-03-14] Model routing fix: default chat→Sonnet 4.6, thinkHarder→Opus (in chat.ts)
/**
 * AI Model Selector
 * OpenRouter (Nous subscription) + Claude Sonnet 4.6 as default inference
 */

import { createOpenAI } from '@ai-sdk/openai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createXai } from '@ai-sdk/xai'
import {
  defaultAiConfig,
  type AiModelKey as ConfigAiModelKey,
  type AiModelConfig,
  resolveModelKey,
  getCrossProviderEquivalent,
  isOpenRouterModel,
  isHermesModel,
  isGitHubModelsModel,
  getHermesModelId,
} from '../../config/ai-config.js'

// Re-export for use by other modules
export type AiModelKey = ConfigAiModelKey
import type { AiProviderType, ModelSelectionContext, ModelSelectionResult } from '../../types/ai-types.js'

const isDev = process.env.NODE_ENV !== 'production'

// Provider availability cache (circuit breaker state)
const providerHealth: Map<AiProviderType, { healthy: boolean; lastCheck: number }> = new Map()
const HEALTH_CHECK_TTL_MS = 60_000

/**
 * Task type to model routing
 * All tasks through OpenRouter (Nous subscription) — Claude Sonnet 4.6 default
 */
const TASK_MODEL_PREFERENCES: Record<string, AiModelKey[]> = {
  news: ['openrouter-sonnet', 'openrouter-opus'],
  sentiment: ['openrouter-sonnet', 'openrouter-opus'],
  chat: ['openrouter-sonnet', 'openrouter-opus'],
  general: ['openrouter-sonnet', 'openrouter-opus'],
  technical: ['openrouter-sonnet', 'openrouter-opus'],
  quickpulse: ['openrouter-sonnet', 'openrouter-opus'],
  research: ['openrouter-sonnet', 'openrouter-opus'],
  reasoning: ['openrouter-sonnet', 'openrouter-opus'],
  'harper-cao': ['openrouter-sonnet', 'openrouter-opus'],
  'cao-approval': ['openrouter-sonnet', 'openrouter-opus'],
  'cao-consolidation': ['openrouter-sonnet', 'openrouter-opus'],
  'pma-merged': ['openrouter-sonnet', 'openrouter-opus'],
  'herald': ['openrouter-sonnet', 'openrouter-opus'],
  'prediction-market': ['openrouter-sonnet', 'openrouter-opus'],
  'futures-desk': ['openrouter-sonnet', 'openrouter-opus'],
  'fa-rippers': ['openrouter-sonnet', 'openrouter-opus'],
  'economic-analysis': ['openrouter-sonnet', 'openrouter-opus'],
  'fundamentals-desk': ['openrouter-sonnet', 'openrouter-opus'],
  'earnings-analysis': ['openrouter-sonnet', 'openrouter-opus'],
  'tech-mega-cap': ['openrouter-sonnet', 'openrouter-opus'],
  default: ['openrouter-sonnet', 'openrouter-opus'],
}

// Runtime token store for user-provided tokens (e.g. GitHub OAuth)
let _runtimeGitHubToken: string | undefined

/** Set the GitHub token for the current request context */
export function setRuntimeGitHubToken(token: string | undefined): void {
  _runtimeGitHubToken = token
}

/**
 * Check if a provider's API key is available
 */
function hasApiKey(modelKey: AiModelKey): boolean {
  const config = defaultAiConfig.models[modelKey]
  if (!config) return false

  // GitHub Models uses runtime OAuth token, not env var
  if (isGitHubModelsModel(modelKey)) {
    return Boolean(_runtimeGitHubToken)
  }

  const apiKey = process.env[config.apiKeyEnv]
  return Boolean(apiKey && apiKey.length > 0)
}

/**
 * Check provider health with caching
 */
function isProviderHealthy(provider: AiProviderType): boolean {
  const cached = providerHealth.get(provider)
  if (cached && Date.now() - cached.lastCheck < HEALTH_CHECK_TTL_MS) {
    return cached.healthy
  }
  // Assume healthy if no recent check
  return true
}

/**
 * Mark a provider as unhealthy
 */
export function markProviderUnhealthy(provider: AiProviderType): void {
  providerHealth.set(provider, { healthy: false, lastCheck: Date.now() })
}

/**
 * Mark a provider as healthy
 */
export function markProviderHealthy(provider: AiProviderType): void {
  providerHealth.set(provider, { healthy: true, lastCheck: Date.now() })
}

/**
 * Select the best model based on task context
 */
export function selectModel(context: ModelSelectionContext = {}): ModelSelectionResult {
  const taskType = context.taskType?.toLowerCase() ?? 'default'
  const preferredChain = TASK_MODEL_PREFERENCES[taskType] ?? TASK_MODEL_PREFERENCES.default

  // If user specified a preferred model, try that first
  if (context.preferredModel) {
    const resolved = resolveModelKey(context.preferredModel)
    if (resolved && hasApiKey(resolved)) {
      const config = defaultAiConfig.models[resolved]
      if (isProviderHealthy(config.providerType)) {
        return {
          model: resolved,
          provider: config.providerType,
          reason: `User preference: ${context.preferredModel}`,
          fallbackChain: preferredChain.filter(m => m !== resolved),
        }
      }
    }
  }

  // Find first available model from preference chain
  for (const modelKey of preferredChain) {
    if (!hasApiKey(modelKey)) continue

    const config = defaultAiConfig.models[modelKey]
    if (!isProviderHealthy(config.providerType)) continue

    // Check budget constraints
    if (context.maxBudgetUsd !== undefined) {
      const estimatedCost = estimateCost(modelKey, context.inputChars ?? 500)
      if (estimatedCost > context.maxBudgetUsd) continue
    }

    // Speed requirements
    if (context.requiresSpeed && config.timeoutMs > 20_000) continue

    const remainingFallbacks = preferredChain
      .slice(preferredChain.indexOf(modelKey) + 1)
      .filter(m => hasApiKey(m))

    return {
      model: modelKey,
      provider: config.providerType,
      reason: `Task: ${taskType}, available model from preference chain`,
      fallbackChain: remainingFallbacks,
    }
  }

  // Last resort: any available model
  const allModels = Object.keys(defaultAiConfig.models) as AiModelKey[]
  for (const modelKey of allModels) {
    if (hasApiKey(modelKey)) {
      const config = defaultAiConfig.models[modelKey]
      return {
        model: modelKey,
        provider: config.providerType,
        reason: 'Fallback to any available model',
        fallbackChain: [],
      }
    }
  }

  throw new Error('No AI models available - check API key configuration')
}

/**
 * Estimate cost for a given model and input size
 */
function estimateCost(modelKey: AiModelKey, inputChars: number): number {
  const config = defaultAiConfig.models[modelKey]
  const inputTokens = Math.ceil(inputChars / 4) // rough estimate
  const outputTokens = 500 // assume moderate response

  return (inputTokens / 1000) * config.costPer1kInputUsd +
         (outputTokens / 1000) * config.costPer1kOutputUsd
}

/**
 * Get fallback model when primary fails
 */
export function getFallbackModel(failedModel: AiModelKey): ModelSelectionResult | null {
  const config = defaultAiConfig.models[failedModel]

  // Try same-provider fallback first
  const sameProviderFallback = defaultAiConfig.routing.fallbackMap[failedModel]
  if (sameProviderFallback && hasApiKey(sameProviderFallback)) {
    const fallbackConfig = defaultAiConfig.models[sameProviderFallback]
    if (isProviderHealthy(fallbackConfig.providerType)) {
      return {
        model: sameProviderFallback,
        provider: fallbackConfig.providerType,
        reason: `Same-provider fallback from ${failedModel}`,
        fallbackChain: [],
      }
    }
  }

  // Try cross-provider fallback
  if (defaultAiConfig.providers.enableFallback) {
    const crossProvider = getCrossProviderEquivalent(failedModel)
    if (crossProvider && hasApiKey(crossProvider.model as AiModelKey)) {
      if (isProviderHealthy(crossProvider.provider)) {
        return {
          model: crossProvider.model as AiModelKey,
          provider: crossProvider.provider,
          reason: `Cross-provider fallback from ${failedModel}`,
          fallbackChain: [],
        }
      }
    }
  }

  return null
}

/**
 * Create AI SDK client for the selected model
 */
export function createModelClient(modelKey: AiModelKey) {
  const config = defaultAiConfig.models[modelKey]
  const apiKey = process.env[config.apiKeyEnv]

  if (!apiKey) {
    throw new Error(`Missing API key for model ${modelKey} (env: ${config.apiKeyEnv})`)
  }

  // OpenRouter models use OpenAI-compatible client
  if (isOpenRouterModel(modelKey)) {
    const client = createOpenAI({
      apiKey,
      baseURL: config.baseUrl,
      headers: {
        'HTTP-Referer': process.env.OPENROUTER_APP_URL ?? 'https://pulse-solvys.vercel.app',
        'X-Title': process.env.OPENROUTER_APP_NAME ?? 'Pulse-AI-Gateway',
      },
    })
    return client(config.id)
  }

  // GitHub Models use OpenAI-compatible client with user's OAuth token
  if (isGitHubModelsModel(modelKey)) {
    const ghToken = _runtimeGitHubToken
    if (!ghToken) {
      throw new Error('GitHub Models requires authentication — sign in with GitHub first')
    }
    const client = createOpenAI({
      apiKey: ghToken,
      baseURL: config.baseUrl,
    })
    return client(config.id)
  }

  // Hermes P.I.C. agent keys — OpenRouter (Nous) + Sonnet 4.6
  if (isHermesModel(modelKey)) {
    const client = createOpenAI({
      apiKey,
      baseURL: config.baseUrl,
      headers: {
        'HTTP-Referer': process.env.OPENROUTER_APP_URL ?? 'https://pulse-solvys.vercel.app',
        'X-Title': process.env.OPENROUTER_APP_NAME ?? 'Pulse-AI-Gateway',
      },
    })
    return client(config.id)
  }

  // Vercel Gateway models - route based on provider type in model ID
  if (config.providerType === 'vercel-gateway') {
    if (config.id.startsWith('anthropic/')) {
      const client = createAnthropic({ apiKey })
      return client(config.id.replace('anthropic/', ''))
    }
    if (config.id.startsWith('xai/')) {
      const client = createXai({ apiKey })
      return client(config.id.replace('xai/', ''))
    }

    // Fallback to OpenAI-compatible client
    const client = createOpenAI({
      apiKey,
      baseURL: config.baseUrl,
    })
    return client(config.id)
  }

  throw new Error(`Unknown provider type for model ${modelKey}`)
}

/**
 * Get model configuration
 */
export function getModelConfig(modelKey: AiModelKey): AiModelConfig {
  return defaultAiConfig.models[modelKey]
}

/**
 * Get available models
 */
export function getAvailableModels(): AiModelKey[] {
  return (Object.keys(defaultAiConfig.models) as AiModelKey[]).filter(hasApiKey)
}

/**
 * Log model selection for debugging
 */
export function logModelSelection(result: ModelSelectionResult, context: ModelSelectionContext): void {
  if (isDev) {
    console.log('[AI] Model selected:', {
      model: result.model,
      provider: result.provider,
      reason: result.reason,
      fallbacks: result.fallbackChain.length,
      context: {
        task: context.taskType,
        preferred: context.preferredModel,
        budget: context.maxBudgetUsd,
      },
    })
  }
}
