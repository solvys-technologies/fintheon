// [claude-code 2026-04-04] Harper Autonomous Loop Manager — spawns and supervises Claude CLI subprocess turns

import { spawnClaudeProcess, checkHealth, type ClaudeStreamEvent } from '../claude-sdk/process-manager.js'
import { buildAutonomousContext, type HarperTask } from './context-builder.js'
import { writeJournalEntry } from './journal-store.js'
import { writeOpsEntry } from './ops-store.js'
import { appendToBoardroom } from '../hermes-sessions.js'
import { getSupabaseClient } from '../../config/supabase.js'
import { createLogger } from '../../lib/logger.js'

const log = createLogger('HarperLoop')

// ── Types ──────────────────────────────────────────────────────────────────

export interface LoopStatus {
  alive: boolean
  state: 'idle' | 'running' | 'degraded' | 'stopped'
  lastHeartbeat: string | null
  lastTaskCompleted: string | null
  queueDepth: number
  consecutiveFailures: number
  heartbeatCount: number
  totalTasksCompleted: number
}

interface QueuedTask {
  task: HarperTask
  enqueuedAt: number
}

// ── State ──────────────────────────────────────────────────────────────────

let state: LoopStatus = {
  alive: false,
  state: 'stopped',
  lastHeartbeat: null,
  lastTaskCompleted: null,
  queueDepth: 0,
  consecutiveFailures: 0,
  heartbeatCount: 0,
  totalTasksCompleted: 0,
}

const taskQueue: QueuedTask[] = []
let processing = false
let stopRequested = false

const MAX_CONSECUTIVE_FAILURES = 3
const FAILURE_BACKOFF_MS = [10_000, 30_000, 90_000] // exponential backoff
const MAX_QUEUE_DEPTH = 20

// ── Queue Management ───────────────────────────────────────────────────────

// [claude-code 2026-04-04] Dedup set for Level 4 items — prevents re-triggering the same item
const recentLevel4Items = new Map<string, number>() // itemId → timestamp
const LEVEL4_DEDUP_TTL = 4 * 60 * 60 * 1000 // 4 hours

function pruneLevel4Dedup(): void {
  const now = Date.now()
  for (const [key, ts] of recentLevel4Items) {
    if (now - ts > LEVEL4_DEDUP_TTL) recentLevel4Items.delete(key)
  }
}

export function enqueueTask(task: HarperTask): boolean {
  if (taskQueue.length >= MAX_QUEUE_DEPTH) {
    log.warn(`Queue full (${MAX_QUEUE_DEPTH}), dropping task: ${task.type}`)
    return false
  }

  // Dedup Level 4 items — same itemId should not re-trigger within TTL
  if (task.type === 'level4-item' && task.payload?.itemId) {
    const itemId = String(task.payload.itemId)
    pruneLevel4Dedup()
    if (recentLevel4Items.has(itemId)) {
      log.info(`Level 4 dedup: suppressing duplicate trigger for ${itemId}`)
      return false
    }
    recentLevel4Items.set(itemId, Date.now())
  }

  // Also dedup: don't enqueue if identical type+itemId already in queue
  if (task.payload?.itemId) {
    const isDupe = taskQueue.some(
      (q) => q.task.type === task.type && q.task.payload?.itemId === task.payload?.itemId,
    )
    if (isDupe) {
      log.info(`Queue dedup: ${task.type} for ${task.payload.itemId} already queued`)
      return false
    }
  }

  // Priority insertion: critical/high go to front, normal/low go to back
  const item: QueuedTask = { task, enqueuedAt: Date.now() }

  if (task.priority === 'critical' || task.priority === 'high') {
    // Insert after other high-priority items but before normal/low
    const insertIdx = taskQueue.findIndex(
      (q) => q.task.priority !== 'critical' && q.task.priority !== 'high',
    )
    if (insertIdx === -1) taskQueue.push(item)
    else taskQueue.splice(insertIdx, 0, item)
  } else {
    taskQueue.push(item)
  }

  state.queueDepth = taskQueue.length
  log.info(`Task enqueued: ${task.type} (priority: ${task.priority}, queue: ${taskQueue.length})`)

  // Kick the drain loop if idle
  if (!processing) drainQueue()

  return true
}

// ── Core Processing Loop ───────────────────────────────────────────────────

async function drainQueue(): Promise<void> {
  if (processing || stopRequested) return
  processing = true

  while (taskQueue.length > 0 && !stopRequested) {
    const { task } = taskQueue.shift()!
    state.queueDepth = taskQueue.length

    try {
      await executeTask(task)
      state.consecutiveFailures = 0
      state.totalTasksCompleted++
      state.lastTaskCompleted = new Date().toISOString()

      if (task.type === 'heartbeat') {
        state.heartbeatCount++
        state.lastHeartbeat = new Date().toISOString()
      }
    } catch (err) {
      state.consecutiveFailures++
      const message = err instanceof Error ? err.message : String(err)
      log.error(`Task failed: ${task.type}`, { error: message, failures: state.consecutiveFailures })

      await writeOpsEntry({
        actionType: 'error',
        title: `Task failed: ${task.type}`,
        detail: message,
        severity: 'warning',
        metadata: { taskType: task.type, failures: state.consecutiveFailures },
      }).catch(() => {})

      if (state.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        state.state = 'degraded'
        log.error(`Entering degraded mode after ${MAX_CONSECUTIVE_FAILURES} consecutive failures`)
        await writeOpsEntry({
          actionType: 'alert',
          title: 'Harper entering degraded mode',
          detail: `${MAX_CONSECUTIVE_FAILURES} consecutive task failures. Only heartbeat monitoring active until manual intervention.`,
          severity: 'critical',
        }).catch(() => {})

        // In degraded mode, flush all non-heartbeat tasks
        const heartbeats = taskQueue.filter((q) => q.task.type === 'heartbeat')
        taskQueue.length = 0
        taskQueue.push(...heartbeats)
        state.queueDepth = taskQueue.length
      }

      // Backoff before next task
      const backoffMs = FAILURE_BACKOFF_MS[Math.min(state.consecutiveFailures - 1, FAILURE_BACKOFF_MS.length - 1)]
      await sleep(backoffMs)
    }
  }

  processing = false
}

// ── Task Execution ─────────────────────────────────────────────────────────

async function executeTask(task: HarperTask): Promise<void> {
  // In degraded mode, only allow heartbeats
  if (state.state === 'degraded' && task.type !== 'heartbeat') {
    log.warn(`Skipping ${task.type} in degraded mode`)
    return
  }

  log.info(`Executing task: ${task.type} (priority: ${task.priority})`)
  state.state = 'running'

  // Build context
  const { systemPrompt, taskPrompt } = await buildAutonomousContext(task)

  // Check CLI health
  const health = await checkHealth()
  if (!health.available) {
    throw new Error(`Claude CLI unavailable: ${health.error}`)
  }

  // Spawn Claude CLI process
  const { process: proc, abort } = spawnClaudeProcess(taskPrompt, {
    systemPrompt,
    model: 'opus',
    maxTurns: 25,
    timeoutMs: 300_000, // 5 minutes
    dangerouslySkipPermissions: true,
    cwd: process.env.FINTHEON_PROJECT_ROOT ?? process.cwd(),
  })

  // Collect output
  const fullOutput = await collectProcessOutput(proc, abort)

  // Parse output for journal entries and ops feed items
  await processOutput(fullOutput, task)

  state.state = 'idle'
}

async function collectProcessOutput(
  proc: import('node:child_process').ChildProcess,
  abort: () => void,
): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    let stdout = ''
    let lastText = ''
    const timeout = setTimeout(() => {
      abort()
      reject(new Error('Task timed out after 5 minutes'))
    }, 300_000)

    proc.stdout?.on('data', (chunk: Buffer) => {
      const raw = chunk.toString()
      stdout += raw

      // Parse stream-json events to extract text
      for (const line of raw.split('\n')) {
        if (!line.trim()) continue
        try {
          const event = JSON.parse(line) as ClaudeStreamEvent
          if (event.type === 'content_block_delta' && event.delta?.text) {
            lastText += event.delta.text
          } else if (event.type === 'result') {
            lastText = event.result || lastText
          }
        } catch {
          // Not JSON, ignore
        }
      }
    })

    proc.on('close', (code) => {
      clearTimeout(timeout)
      if (code === 0 || code === null) {
        resolve(lastText || stdout)
      } else {
        reject(new Error(`Claude CLI exited with code ${code}`))
      }
    })

    proc.on('error', (err) => {
      clearTimeout(timeout)
      reject(err)
    })
  })
}

// ── Output Processing ──────────────────────────────────────────────────────

async function processOutput(output: string, task: HarperTask): Promise<void> {
  if (!output.trim()) {
    log.warn(`Empty output for task: ${task.type}`)
    return
  }

  // Always write the output as a journal entry
  const journalEntry = await writeJournalEntry({
    entryType: task.type === 'heartbeat' ? 'observation' : task.type === 'scoring-qa' ? 'scoring_qa' : task.type === 'narrative-synthesis' ? 'narrative' : 'observation',
    content: output.slice(0, 5000), // Cap at 5K chars
    tags: [task.type, task.priority],
    context: { trigger: task.type, payload: task.payload },
  }).catch((err) => { log.error('Failed to write journal from output', { error: String(err) }); return null })

  // Write to ops feed
  const severity = task.priority === 'critical' ? 'critical' : task.priority === 'high' ? 'warning' : 'info'
  await writeOpsEntry({
    actionType: task.type === 'heartbeat' ? 'heartbeat' : 'analysis',
    title: `${task.type}: ${output.slice(0, 55)}...`,
    detail: output.slice(0, 2000),
    severity: severity as 'info' | 'warning' | 'critical',
    metadata: { taskType: task.type },
  }).catch((err) => log.error('Failed to write ops entry from output', { error: String(err) }))

  // [claude-code 2026-04-05] Write to boardroom for non-heartbeat, non-regime-memo tasks
  const BOARDROOM_TASK_LABELS: Record<string, string> = {
    'level4-item': 'Level 4 Analysis', 'vix-spike': 'Regime Shift', 'scoring-qa': 'Scoring QA',
    'narrative-synthesis': 'Narrative Synthesis', 'pipeline-stall': 'Pipeline Alert',
    'brief-review': 'Brief Review', 'consilium-intervention': 'Consilium Response', 'manual': 'Manual Analysis',
  }
  const taskLabel = BOARDROOM_TASK_LABELS[task.type]
  if (taskLabel) {
    await appendToBoardroom(
      `[HARPER-AUTO: ${taskLabel}] ${output.slice(0, 3000)}`,
      'assistant',
      { autonomous: true, taskType: task.type, priority: task.priority },
    ).catch((err) => log.error('Failed to write boardroom from output', { error: String(err) }))
  }

  // [claude-code 2026-04-05] Narrative synthesis → timeline card links
  if (task.type === 'narrative-synthesis' && journalEntry?.id) {
    const THREAD_MATCHERS: Array<{ slug: string; patterns: RegExp }> = [
      { slug: 'middle-east-conflict', patterns: /middle.?east|israel|iran|gaza|hezbollah/i },
      { slug: 'liquidity-credit-contraction', patterns: /liquidity|credit.?contract|lending|tighten/i },
      { slug: 'ai-singularity', patterns: /singularity|artificial.?intelligence|ai.?(?:boom|bubble|revolution)/i },
      { slug: 'usd-jpy-carry-trade', patterns: /usd.?jpy|carry.?trade|yen/i },
      { slug: 'trade-war', patterns: /trade.?war|tariff|protectionism/i },
      { slug: 'us-china-relations', patterns: /us.?china|sino.?american|decoupling/i },
      { slug: 'rate-cut-cycle', patterns: /rate.?cut|fed.?cut|easing.?cycle|dovish/i },
      { slug: 'trump-presidency', patterns: /trump|maga|executive.?order/i },
      { slug: 'price-stability', patterns: /price.?stability|inflation|cpi|pce|deflation/i },
      { slug: 'maximum-employment', patterns: /max.?employment|nfp|payroll|unemployment|labor.?market/i },
    ]
    const matchedSlugs = THREAD_MATCHERS.filter(m => m.patterns.test(output)).map(m => m.slug)
    if (matchedSlugs.length > 0) {
      const links = matchedSlugs.map(slug => ({ card_id: journalEntry.id, thread_slug: slug, confidence: 0.85 }))
      const sb = getSupabaseClient()
      await sb.from('narrative_card_links')
        .upsert(links, { onConflict: 'card_id,thread_slug', ignoreDuplicates: true })
        .then(({ error }) => { if (error) log.warn('Failed to upsert narrative card links', { error: error.message }) })
    }
  }
}

// ── Lifecycle ──────────────────────────────────────────────────────────────

export async function startLoop(): Promise<void> {
  if (state.alive) {
    log.warn('Loop already running')
    return
  }

  const health = await checkHealth()
  if (!health.available) {
    log.warn(`Cannot start loop: Claude CLI unavailable (${health.error})`)
    return
  }

  stopRequested = false
  state.alive = true
  state.state = 'idle'
  state.consecutiveFailures = 0

  log.info('Harper autonomous loop started')

  await writeOpsEntry({
    actionType: 'execution',
    title: 'Harper autonomous loop started',
    severity: 'info',
  }).catch(() => {})
}

export function stopLoop(): void {
  stopRequested = true
  state.alive = false
  state.state = 'stopped'
  log.info('Harper autonomous loop stopped')
}

export function isAlive(): boolean {
  return state.alive
}

export function getStatus(): LoopStatus {
  return { ...state, queueDepth: taskQueue.length }
}

export function triggerHeartbeat(): void {
  enqueueTask({
    type: 'heartbeat',
    payload: { manual: true, timestamp: new Date().toISOString() },
    priority: 'normal',
  })
}

// ── Helpers ────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
