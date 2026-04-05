// [claude-code 2026-04-04] Herald — Strands agent for news & sentiment
import { createAgent } from '../agent-factory.js'
import { BASE_PROMPTS } from '../../ai/agent-instructions/base-prompts.js'

export function createHeraldAgent() {
  return createAgent({
    name: 'herald',
    description: 'News & sentiment — headlines, social signals, AAII survey, breaking news',
    systemPrompt: BASE_PROMPTS['herald'],
    model: { temperature: 0.3, maxTokens: 4096 },
  })
}
