// [claude-code 2026-04-08] Nous provider tries arcee trinity-large first, then qwen3.6-plus
// [claude-code 2026-04-07] Strands agent factory — VProxy, OpenRouter, or Nous Direct provider selection
import { Agent, tool, type ConversationManager } from '@strands-agents/sdk'
import { OpenAIModel } from '@strands-agents/sdk/models/openai'
import { createVProxyModel, checkVProxyHealth, type VProxyModelOptions } from './provider.js'
import { createLogger } from '../../lib/logger.js'

const log = createLogger('StrandsFactory')

/** Provider override — which backend to route through */
export type HarperProvider = 'local' | 'nous' | 'orouter' | 'grok'

/** Nous fallback model chain — tried in order */
export const NOUS_MODELS = [
  'arcee-ai/trinity-large-preview:free',
  'qwen/qwen3.6-plus',
]

export interface CreateAgentOptions {
  name: string
  description?: string
  systemPrompt: string
  model?: VProxyModelOptions
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tools?: any[]
  printer?: boolean
  conversationManager?: ConversationManager
  /** Override the AI provider (default: local VProxy) */
  provider?: HarperProvider
  /** Override model ID when provider is 'nous' */
  nousModelId?: string
}

/** Create an OpenRouter model for Strands */
function createOpenRouterModel(modelId: string, temperature = 0.3, maxTokens = 16384): OpenAIModel {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) throw new Error('OPENROUTER_API_KEY not set')
  return new OpenAIModel({
    api: 'chat',
    apiKey,
    clientConfig: { baseURL: 'https://openrouter.ai/api/v1' },
    modelId,
    temperature,
    maxTokens,
  })
}

/** Create a Nous/Hermes model for Strands — Qwen3-Coder via OpenRouter (Nous subscription) */
function createNousModel(temperature = 0.3, maxTokens = 16384): OpenAIModel {
  return createNousModelWithId('qwen/qwen3-coder-480b-a35b', temperature, maxTokens)
}

/** Create any model via Nous/OpenRouter subscription */
function createNousModelWithId(modelId: string, temperature = 0.3, maxTokens = 16384): OpenAIModel {
  const apiKey = process.env.OPENROUTER_API_KEY || process.env.NOUS_API_KEY
  if (!apiKey) throw new Error('NOUS_API_KEY / OPENROUTER_API_KEY not set')
  return new OpenAIModel({
    api: 'chat',
    apiKey,
    clientConfig: { baseURL: 'https://openrouter.ai/api/v1' },
    modelId,
    temperature,
    maxTokens,
  })
}

/** Create a Strands Agent configured with the selected provider */
export function createAgent(options: CreateAgentOptions): Agent {
  const provider = options.provider ?? 'local'
  let model: OpenAIModel

  switch (provider) {
    case 'orouter':
      log.info('Creating Strands agent (OpenRouter Opus)', { name: options.name })
      model = createOpenRouterModel('anthropic/claude-opus-4.6', options.model?.temperature, options.model?.maxTokens)
      break
    case 'nous':
      // eslint-disable-next-line no-case-declarations
      const nousId = options.nousModelId ?? NOUS_MODELS[0]
      log.info(`Creating Strands agent (Nous: ${nousId})`, { name: options.name })
      model = createNousModelWithId(nousId, options.model?.temperature, options.model?.maxTokens)
      break
    case 'grok':
      log.info('Creating Strands agent (Grok 4.20 via Nous/OpenRouter)', { name: options.name })
      model = createNousModelWithId('x-ai/grok-4.20', options.model?.temperature ?? 0.25, options.model?.maxTokens ?? 4096)
      break
    default:
      log.info('Creating Strands agent (VProxy local)', { name: options.name })
      model = createVProxyModel(options.model)
      break
  }

  return new Agent({
    model,
    name: options.name,
    description: options.description,
    systemPrompt: options.systemPrompt,
    tools: options.tools,
    printer: options.printer ?? false,
    conversationManager: options.conversationManager,
  })
}

/** Check if the Strands + VProxy stack is operational */
export async function isStrandsAvailable(): Promise<boolean> {
  const health = await checkVProxyHealth()
  return health.available
}

export { tool } from '@strands-agents/sdk'
export { z } from 'zod'
