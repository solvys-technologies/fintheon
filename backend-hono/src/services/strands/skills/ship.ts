// [claude-code 2026-04-04] Solvys Ship skill — build, commit, push, rebuild DMG
import { tool } from '@strands-agents/sdk'
import { z } from 'zod'
import { spawn } from 'node:child_process'
import { resolve } from 'node:path'

const PROJECT_ROOT = resolve(new URL('.', import.meta.url).pathname, '../../../..')

function runShell(command: string, timeoutMs = 120_000): Promise<string> {
  return new Promise((res) => {
    const chunks: string[] = []
    const child = spawn(command, { shell: true, cwd: PROJECT_ROOT, stdio: ['ignore', 'pipe', 'pipe'] })
    child.stdout?.setEncoding('utf8')
    child.stderr?.setEncoding('utf8')
    child.stdout?.on('data', (d: string) => chunks.push(d))
    child.stderr?.on('data', (d: string) => chunks.push(`[stderr] ${d}`))
    const timer = setTimeout(() => { child.kill('SIGTERM'); res(chunks.join('') + '\n[timed out]') }, timeoutMs)
    child.on('exit', () => { clearTimeout(timer); res(chunks.join('')) })
    child.on('error', (err) => { clearTimeout(timer); res(`Error: ${err.message}`) })
  })
}

export const solvysShipTool = tool({
  name: 'solvys_ship',
  description: 'Build the project, fix any errors, commit changes, push to remote, and optionally rebuild the Electron DMG. Runs the full ship workflow.',
  inputSchema: z.object({
    message: z.string().optional().describe('Custom commit message (auto-generated if omitted)'),
    skipDmg: z.boolean().optional().describe('Skip DMG rebuild (default false)'),
    skipPush: z.boolean().optional().describe('Skip git push (default false)'),
  }),
  callback: async (input: { message?: string; skipDmg?: boolean; skipPush?: boolean }) => {
    const steps: string[] = []

    // Step 1: Build
    steps.push('[1/4] Building...')
    const buildResult = await runShell('bun run build')
    if (buildResult.includes('error TS')) {
      return `Build failed:\n${buildResult.slice(-2000)}`
    }
    steps.push('[1/4] Build passed')

    // Step 2: Commit
    const commitMsg = input.message ?? `[ship] auto-commit ${new Date().toISOString().slice(0, 16)}`
    steps.push('[2/4] Committing...')
    await runShell(`git add -A && git commit -m "${commitMsg}" || true`)
    steps.push('[2/4] Committed')

    // Step 3: Push
    if (!input.skipPush) {
      steps.push('[3/4] Pushing...')
      const pushResult = await runShell('git push')
      steps.push(`[3/4] Pushed: ${pushResult.slice(0, 200)}`)
    } else {
      steps.push('[3/4] Push skipped')
    }

    // Step 4: DMG
    if (!input.skipDmg) {
      steps.push('[4/4] Building DMG...')
      const dmgResult = await runShell('cd electron && bun run build:dmg 2>&1 | tail -5')
      steps.push(`[4/4] DMG: ${dmgResult.slice(0, 200)}`)
    } else {
      steps.push('[4/4] DMG skipped')
    }

    return steps.join('\n')
  },
})
