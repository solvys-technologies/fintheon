// [claude-code 2026-04-04] Solvys Inform skill — generate handoff prompts for dependent agents
import { tool } from '@strands-agents/sdk'
import { z } from 'zod'
import { spawn } from 'node:child_process'
import { resolve } from 'node:path'

const PROJECT_ROOT = resolve(new URL('.', import.meta.url).pathname, '../../../..')

function runShell(command: string): Promise<string> {
  return new Promise((res) => {
    const chunks: string[] = []
    const child = spawn(command, { shell: true, cwd: PROJECT_ROOT, stdio: ['ignore', 'pipe', 'pipe'] })
    child.stdout?.setEncoding('utf8')
    child.stdout?.on('data', (d: string) => chunks.push(d))
    child.on('exit', () => res(chunks.join('')))
    child.on('error', (err) => res(`Error: ${err.message}`))
  })
}

export const solvysInformTool = tool({
  name: 'solvys_inform',
  description: 'Generate handoff prompts for external AI agents that depend on recent work. Summarizes changes and provides context for other Claude Code/Cursor instances.',
  inputSchema: z.object({
    agents: z.array(z.string()).describe('Agent names to inform (e.g., "harper", "cursor", "codex")'),
    summary: z.string().describe('What was changed and why'),
    filesChanged: z.array(z.string()).optional().describe('Key files that were modified'),
  }),
  callback: async (input: { agents: string[]; summary: string; filesChanged?: string[] }) => {
    const recentCommits = await runShell('git log --oneline -5')
    const prompts: string[] = []

    for (const agent of input.agents) {
      prompts.push([
        `--- Handoff to ${agent} ---`,
        '',
        `Context: ${input.summary}`,
        '',
        'Recent commits:',
        recentCommits,
        '',
        input.filesChanged?.length ? `Files changed:\n${input.filesChanged.map((f) => `- ${f}`).join('\n')}` : '',
        '',
        'Action: Review changes and update your context accordingly.',
        '---',
      ].join('\n'))
    }

    return prompts.join('\n\n')
  },
})
