// [claude-code 2026-04-04] Solvys Deploy skill — multi-target production deployment
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
    child.stderr?.on('data', (d: string) => chunks.push(d))
    const timer = setTimeout(() => { child.kill('SIGTERM'); res(chunks.join('') + '\n[timed out]') }, timeoutMs)
    child.on('exit', () => { clearTimeout(timer); res(chunks.join('')) })
    child.on('error', (err) => { clearTimeout(timer); res(`Error: ${err.message}`) })
  })
}

export const solvysDeployTool = tool({
  name: 'solvys_deploy',
  description: 'Deploy to production across targets: Electron DMG, Vercel, and/or Cloudflare Workers. Creates a GitHub release after successful deploy.',
  inputSchema: z.object({
    targets: z.array(z.enum(['dmg', 'vercel', 'workers'])).describe('Which deployment targets to hit'),
    version: z.string().optional().describe('Version tag (auto-detected from git if omitted)'),
    dryRun: z.boolean().optional().describe('Preview what would happen without deploying'),
  }),
  callback: async (input: { targets: string[]; version?: string; dryRun?: boolean }) => {
    const results: string[] = [`=== Solvys Deploy (${input.dryRun ? 'DRY RUN' : 'LIVE'}) ===`]
    const version = input.version ?? (await runShell('git describe --tags --always')).trim()

    for (const target of input.targets) {
      if (input.dryRun) {
        results.push(`[${target}] Would deploy ${version}`)
        continue
      }

      switch (target) {
        case 'dmg':
          results.push('[dmg] Building Electron DMG...')
          results.push(await runShell('cd electron && bun run build:dmg 2>&1 | tail -5'))
          break
        case 'vercel':
          results.push('[vercel] Deploying to Vercel...')
          results.push(await runShell('vercel --prod 2>&1 | tail -5'))
          break
        case 'workers':
          results.push('[workers] Deploying to Cloudflare Workers...')
          results.push(await runShell('wrangler deploy 2>&1 | tail -5'))
          break
      }
    }

    // GitHub release
    if (!input.dryRun) {
      results.push(`\n[release] Creating GitHub release ${version}...`)
      results.push(await runShell(`gh release create "${version}" --generate-notes 2>&1 | tail -3`))
    }

    return results.join('\n')
  },
})
