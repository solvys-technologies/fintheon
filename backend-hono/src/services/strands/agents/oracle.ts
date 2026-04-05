// [claude-code 2026-04-04] Oracle (All-Seer) — Strands agent for prediction markets + macro
import { createAgent } from '../agent-factory.js'
import { BASE_PROMPTS } from '../../ai/agent-instructions/base-prompts.js'

export function createOracleAgent() {
  return createAgent({
    name: 'oracle',
    description: 'Prediction markets, S&P, Crypto, macro analysis — sees across all domains',
    systemPrompt: BASE_PROMPTS['pma-merged'],
    model: { temperature: 0.3, maxTokens: 4096 },
  })
}
