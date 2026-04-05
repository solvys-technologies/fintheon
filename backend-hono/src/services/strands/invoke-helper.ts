// [claude-code 2026-04-05] Strands Phase 8: Drop-in replacement for Vercel AI SDK generateText()
// Creates a lightweight Strands agent, invokes once, and returns { text }.
import { createAgent } from './agent-factory.js'
import type { VProxyModelOptions } from './provider.js'

export interface InvokeAgentOptions {
  systemPrompt: string
  userPrompt: string
  model?: VProxyModelOptions
}

/**
 * One-shot text generation via a Strands agent.
 * Replaces: `const { text } = await generateText({ model, messages, temperature, maxOutputTokens })`
 * With:     `const { text } = await invokeAgent({ systemPrompt, userPrompt, model: { temperature, maxTokens } })`
 */
export async function invokeAgent(options: InvokeAgentOptions): Promise<{ text: string }> {
  const agent = createAgent({
    name: 'one-shot',
    systemPrompt: options.systemPrompt,
    model: options.model,
    printer: false,
  })

  const result = await agent.invoke(options.userPrompt)
  return { text: result.toString() }
}
