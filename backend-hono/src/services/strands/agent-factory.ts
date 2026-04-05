// [claude-code 2026-04-04] Strands agent factory — creates configured Agent instances with VProxy
import { Agent, tool, type ConversationManager } from '@strands-agents/sdk'
import { createVProxyModel, checkVProxyHealth, type VProxyModelOptions } from './provider.js'
import { createLogger } from '../../lib/logger.js'

const log = createLogger('StrandsFactory')

export interface CreateAgentOptions {
  name: string
  description?: string
  systemPrompt: string
  model?: VProxyModelOptions
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tools?: any[]
  printer?: boolean
  conversationManager?: ConversationManager
}

/** Create a Strands Agent configured with VProxy */
export function createAgent(options: CreateAgentOptions): Agent {
  const model = createVProxyModel(options.model)

  log.info('Creating Strands agent', { name: options.name })

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
