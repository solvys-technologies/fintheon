// [claude-code 2026-04-04] Tool test: verify Harper tools work via Strands Agent
// Run: cd backend-hono && bun run src/services/strands/tool-test.ts
import { createAgent } from './agent-factory.js'
import { createHarperTools } from './harper-tools.js'

async function main() {
  const requestId = `test-${Date.now()}`
  const tools = createHarperTools(requestId)

  const agent = createAgent({
    name: 'harper-tool-test',
    systemPrompt: 'You are Harper, the CAO. Use the get_fintheon_paths tool to show the user the project paths, then summarize what you see.',
    tools,
  })

  console.log('[Tool Test] Invoking agent with tools...')
  const result = await agent.invoke('Show me the Fintheon project paths.')
  console.log('[Response]', result.toString().slice(0, 500))
  console.log('[PASS] Harper tools working via Strands')
}

main().catch((err) => {
  console.error('[FAIL]', err)
  process.exit(1)
})
