import { createAnthropic } from '@ai-sdk/anthropic'
import { generateText, streamText, tool, stepCountIs } from 'ai'
import { z } from 'zod'
import { spawn } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createLogger } from '../../lib/logger.js'

const log = createLogger('VProxyAnthropic')

const DEFAULT_BASE_URL = 'http://localhost:8317'
const DEFAULT_MODEL = 'claude-opus-4-6'
const DEFAULT_API_KEY = 'CLI_PROXY_API_KEY'
const HEALTH_CACHE_TTL_MS = 15_000

export interface VProxyHealth {
  enabled: boolean
  available: boolean
  baseUrl: string
  model: string
  checkedAt: number
  error: string | null
}

export interface VProxyTextOptions {
  prompt: string
  systemPrompt?: string
  model?: string
  maxOutputTokens?: number
  timeoutMs?: number
}

export interface VProxyStreamOptions extends VProxyTextOptions {
  abortSignal?: AbortSignal
}

let healthCache: VProxyHealth | null = null

function normalizeBaseUrl(raw: string): string {
  // @ai-sdk/anthropic appends /messages directly — base must end with /v1
  const stripped = raw.replace(/\/+$/, '')
  return stripped.endsWith('/v1') ? stripped : `${stripped}/v1`
}

function resolveModel(modelOverride?: string): string {
  const configured = modelOverride || process.env.VPROXY_ANTHROPIC_MODEL || DEFAULT_MODEL
  if (configured.startsWith('anthropic/')) {
    return configured.slice('anthropic/'.length)
  }
  if (configured === 'opus') {
    return process.env.VPROXY_ANTHROPIC_MODEL || DEFAULT_MODEL
  }
  return configured
}

function getClient(modelOverride?: string) {
  const baseUrl = normalizeBaseUrl(process.env.VPROXY_BASE_URL || DEFAULT_BASE_URL)
  const apiKey = process.env.VPROXY_API_KEY || DEFAULT_API_KEY
  const anthropic = createAnthropic({
    apiKey,
    baseURL: baseUrl,
  })
  return anthropic(resolveModel(modelOverride))
}

export function isVProxyAnthropicEnabled(): boolean {
  return process.env.USE_VPROXY_ANTHROPIC !== 'false'
}

export function getVProxyAnthropicBaseUrl(): string {
  return normalizeBaseUrl(process.env.VPROXY_BASE_URL || DEFAULT_BASE_URL)
}

export async function getVProxyHealth(force = false): Promise<VProxyHealth> {
  const enabled = isVProxyAnthropicEnabled()
  const baseUrl = getVProxyAnthropicBaseUrl()
  const model = resolveModel()

  if (!enabled) {
    const disabledState: VProxyHealth = {
      enabled: false,
      available: false,
      baseUrl,
      model,
      checkedAt: Date.now(),
      error: 'USE_VPROXY_ANTHROPIC=false',
    }
    healthCache = disabledState
    return disabledState
  }

  if (!force && healthCache && Date.now() - healthCache.checkedAt < HEALTH_CACHE_TTL_MS) {
    return healthCache
  }

  try {
    const apiKey = process.env.VPROXY_API_KEY || DEFAULT_API_KEY
    const response = await fetch(`${baseUrl}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(8_000),
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`models endpoint returned ${response.status}: ${text.slice(0, 160)}`)
    }

    const payload = await response.json() as { data?: Array<{ id?: string }> }
    const hasClaude = (payload.data ?? []).some((entry) => (entry.id ?? '').includes('claude'))
    if (!hasClaude) {
      throw new Error('no Claude models reported by VProxy')
    }

    healthCache = {
      enabled: true,
      available: true,
      baseUrl,
      model,
      checkedAt: Date.now(),
      error: null,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    healthCache = {
      enabled: true,
      available: false,
      baseUrl,
      model,
      checkedAt: Date.now(),
      error: message,
    }
    log.warn('VProxy health check failed', { error: message, baseUrl })
  }

  return healthCache
}

export async function generateTextViaVProxy(options: VProxyTextOptions): Promise<string> {
  const health = await getVProxyHealth()
  if (!health.available) {
    throw new Error(`VProxy unavailable: ${health.error ?? 'unknown error'}`)
  }

  const call = generateText({
    model: getClient(options.model),
    system: options.systemPrompt,
    prompt: options.prompt,
    maxOutputTokens: options.maxOutputTokens ?? 8192,
  })

  if (!options.timeoutMs || options.timeoutMs <= 0) {
    const { text } = await call
    return text
  }

  let timeoutHandle: ReturnType<typeof setTimeout> | null = null
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new Error(`VProxy request timed out after ${options.timeoutMs}ms`))
    }, options.timeoutMs)
    timeoutHandle.unref?.()
  })

  const result = await Promise.race([call, timeoutPromise])
  if (timeoutHandle) {
    clearTimeout(timeoutHandle)
  }
  return result.text
}

// ── Shell tool for Harper CAO ─────────────────────────────────────────────

const PROJECT_ROOT = resolve(new URL('.', import.meta.url).pathname, '../../..')

function runShell(command: string, timeoutMs = 30_000): Promise<{ stdout: string; stderr: string; exitCode: number | null }> {
  return new Promise((res) => {
    const chunks: string[] = []
    const errChunks: string[] = []
    const child = spawn(command, {
      shell: true,
      cwd: PROJECT_ROOT,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    child.stdout?.setEncoding('utf8')
    child.stderr?.setEncoding('utf8')
    child.stdout?.on('data', (d: string) => chunks.push(d))
    child.stderr?.on('data', (d: string) => errChunks.push(d))

    const timer = setTimeout(() => {
      child.kill('SIGTERM')
      res({ stdout: chunks.join(''), stderr: errChunks.join('') + '\n[timed out]', exitCode: null })
    }, timeoutMs)

    child.on('exit', (code) => {
      clearTimeout(timer)
      res({ stdout: chunks.join(''), stderr: errChunks.join(''), exitCode: code })
    })
    child.on('error', (err) => {
      clearTimeout(timer)
      res({ stdout: '', stderr: err.message, exitCode: null })
    })
  })
}

const harperTools = {
  run_command: tool({
    description: 'Run a shell command on the local machine. The working directory is the Fintheon project root. Use this to inspect files, grep code, check logs, run scripts, query the database, or execute any CLI tool.',
    inputSchema: z.object({
      command: z.string().describe('The shell command to execute (bash)'),
    }) as z.ZodType<{ command: string }>,
    execute: async ({ command }) => {
      log.info('Harper tool: run_command', { command: command.slice(0, 120) })
      const result = await runShell(command)
      return (result.stdout + (result.stderr ? `\n[stderr] ${result.stderr}` : '')).slice(0, 12_000)
    },
  }),
  read_file: tool({
    description: 'Read the contents of a file from the Fintheon codebase or system. Returns the full text content.',
    inputSchema: z.object({
      path: z.string().describe('Absolute path or path relative to the Fintheon project root'),
    }) as z.ZodType<{ path: string }>,
    execute: async ({ path: filePath }) => {
      const abs = filePath.startsWith('/') ? filePath : resolve(PROJECT_ROOT, filePath)
      log.info('Harper tool: read_file', { path: abs })
      try {
        const content = await readFile(abs, 'utf8')
        return content.slice(0, 20_000) + (content.length > 20_000 ? '\n[truncated]' : '')
      } catch (err) {
        return `Error: ${err instanceof Error ? err.message : String(err)}`
      }
    },
  }),
}

// ── Stream (with optional tools) ──────────────────────────────────────────

export function streamTextViaVProxy(options: VProxyStreamOptions & { enableTools?: boolean }): { textStream: AsyncIterable<string> } {
  return streamText({
    model: getClient(options.model),
    system: options.systemPrompt,
    prompt: options.prompt,
    maxOutputTokens: options.maxOutputTokens ?? 8192,
    abortSignal: options.abortSignal,
    ...(options.enableTools ? { tools: harperTools, stopWhen: stepCountIs(10) } : {}),
  }) as { textStream: AsyncIterable<string> }
}
