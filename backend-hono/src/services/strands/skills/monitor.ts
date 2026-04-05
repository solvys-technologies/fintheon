// [claude-code 2026-04-04] Solvys Monitor skill — watch parallel track execution
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

export const solvysMonitorTool = tool({
  name: 'solvys_monitor',
  description: 'Monitor parallel track execution during orchestrated sprints. Shows git activity, running processes, and build status across tracks.',
  inputSchema: z.object({
    trackIds: z.array(z.string()).optional().describe('Specific track IDs to monitor (default: all)'),
  }),
  callback: async (input: { trackIds?: string[] }) => {
    const results: string[] = ['=== Track Monitor ===']

    // Recent git activity
    const gitLog = await runShell('git log --oneline --all -15 --format="%h %s (%an, %ar)"')
    results.push('\n[Recent Git Activity]', gitLog)

    // Active branches
    const branches = await runShell('git branch --list --format="%(refname:short) %(upstream:track)"')
    results.push('\n[Active Branches]', branches)

    // Build status
    const buildCheck = await runShell('bun run build 2>&1 | tail -3')
    const buildOk = !buildCheck.includes('error')
    results.push(`\n[Build Status] ${buildOk ? 'PASS' : 'FAIL'}`)

    // Running processes
    const procs = await runShell('ps aux | grep -E "bun|node|claude" | grep -v grep | head -10')
    results.push('\n[Running Processes]', procs || '(none detected)')

    return results.join('\n')
  },
})
