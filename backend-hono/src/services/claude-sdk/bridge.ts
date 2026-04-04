// [claude-code 2026-04-04] Switch VProxy from textStream→fullStream to capture text across multi-step tool calls
// [claude-code 2026-03-10] Claude SDK Bridge — relays Fintheon chat to Claude Code CLI stream-json
/**
 * Claude SDK Bridge
 * Converts between Fintheon chat interface and Claude Code CLI's stream-json protocol.
 * Streams Claude Opus responses back through existing SSE infrastructure.
 *
 * Flow:
 *   1. Fintheon chat sends message + history
 *   2. Bridge formats prompt with conversation context
 *   3. Spawns Claude Code CLI with --print --output-format stream-json
 *   4. Parses streaming JSON events from stdout
 *   5. Yields UI-compatible stream events (reasoning-delta, text-delta, etc.)
 */

import {
  spawnClaudeProcess,
  isAvailable,
  getHealth,
  type ClaudeStreamEvent,
  type ClaudeSDKConfig,
} from './process-manager.js'
import { getSessionManager } from './session-manager.js'
import {
  getVProxyHealth,
  isVProxyAnthropicEnabled,
  streamTextViaVProxy,
} from '../vproxy/anthropic-client.js'

const LOG_PREFIX = '[ClaudeSDK:Bridge]'

// ── Types ──────────────────────────────────────────────────────────────────

export interface BridgeChatRequest {
  message: string
  conversationId: string
  history: Array<{ role: 'user' | 'assistant'; content: string }>
  thinkHarder?: boolean
  /** Additional context (e.g. Exa research results) */
  researchContext?: string
  /** Request ID for cognition events (tool approval gating) */
  requestId?: string
}

export interface BridgeStreamEvent {
  type: 'reasoning-start' | 'reasoning-delta' | 'reasoning-end' |
        'text-start' | 'text-delta' | 'text-end' |
        'tool-use' | 'error'
  id: string
  delta?: string
  metadata?: Record<string, unknown>
}

export interface BridgeChatResult {
  /** Async iterator of stream events */
  stream: AsyncGenerator<BridgeStreamEvent>
  /** Abort the request */
  abort: () => void
  /** Final collected text (available after stream completes) */
  getFullText: () => string
}

// ── Bridge ─────────────────────────────────────────────────────────────────

/**
 * Check if Claude SDK bridge is available for use.
 */
export async function isBridgeAvailable(): Promise<boolean> {
  if (isVProxyAnthropicEnabled()) {
    const vproxy = await getVProxyHealth()
    if (vproxy.available) return true
  }

  if (!isAvailable()) {
    const h = await getHealth()
    return h.available
  }
  return true
}

/**
 * Send a chat message through Claude Code CLI and get a streaming response.
 * Routes through the persistent session manager when available,
 * falls back to per-request spawnClaudeProcess if session is down.
 */
export function bridgeChat(request: BridgeChatRequest, configOverrides?: Partial<ClaudeSDKConfig>): BridgeChatResult {
  const { message, history, researchContext, thinkHarder, requestId } = request

  // Build the prompt with conversation context
  const prompt = buildPrompt(message, history, researchContext)

  // Configure effort based on thinkHarder
  const effort = thinkHarder ? 'high' : 'medium'
  const maxTurns = thinkHarder ? 5 : 3

  const spawnOpts: Partial<ClaudeSDKConfig> = { effort, maxTurns, ...configOverrides }

  // Preferred route: Anthropic via local VProxy gateway.
  if (isVProxyAnthropicEnabled()) {
    console.log(`${LOG_PREFIX} Routing through VProxy Anthropic stream`)
    let fullText = ''
    let aborted = false
    const controller = new AbortController()

    const vproxyStream = wrapVProxyStream(
      prompt,
      spawnOpts,
      (text) => { fullText += text },
      () => aborted,
      controller.signal,
      true,
      requestId,
    )

    return {
      stream: vproxyStream,
      abort: () => {
        aborted = true
        controller.abort()
      },
      getFullText: () => fullText,
    }
  }

  // Try persistent session for streaming
  const session = getSessionManager()
  if (session.isSessionAlive()) {
    console.log(`${LOG_PREFIX} Routing through persistent session`)
    let fullText = ''
    let aborted = false

    const sessionStream = wrapSessionStream(
      session.sendPrompt(prompt, spawnOpts),
      (text) => { fullText += text },
      () => aborted,
    )

    return {
      stream: sessionStream,
      abort: () => { aborted = true },
      getFullText: () => fullText,
    }
  }

  // Fallback: per-request spawn
  console.log(`${LOG_PREFIX} Session unavailable, using per-request spawn`)
  const { process: proc, abort } = spawnClaudeProcess(prompt, spawnOpts)

  let fullText = ''
  let aborted = false

  const stream = parseClaudeStream(proc, (text) => { fullText += text }, () => aborted, abort)

  return {
    stream,
    abort: () => { aborted = true; abort() },
    getFullText: () => fullText,
  }
}

// ── Session Stream Wrapper ────────────────────────────────────────────────

/**
 * Wraps the raw ClaudeStreamEvent generator from the session manager
 * into BridgeStreamEvents that the chat handler expects.
 */
async function* wrapSessionStream(
  rawStream: AsyncGenerator<ClaudeStreamEvent>,
  onText: (text: string) => void,
  isAborted: () => boolean,
): AsyncGenerator<BridgeStreamEvent> {
  const messageId = `claude-sdk-${Date.now()}`
  const reasoningId = `claude-sdk-reasoning-${Date.now()}`
  let hasStartedText = false
  let hasStartedReasoning = false

  yield { type: 'reasoning-start', id: reasoningId }
  hasStartedReasoning = true

  try {
    for await (const event of rawStream) {
      if (isAborted()) break

      const result = processStreamEvent(event, messageId, reasoningId, hasStartedText, hasStartedReasoning, onText)
      if (result) {
        for (const evt of result.events) {
          yield evt
        }
        hasStartedText = result.hasStartedText
        hasStartedReasoning = result.hasStartedReasoning
      }
    }
  } catch (err) {
    if (!isAborted()) {
      yield {
        type: 'error',
        id: messageId,
        delta: err instanceof Error ? err.message : 'Session stream error',
      }
    }
  }

  if (hasStartedReasoning) {
    yield { type: 'reasoning-end', id: reasoningId }
  }
  if (!hasStartedText) {
    yield { type: 'text-start', id: messageId }
    hasStartedText = true
  }
  yield { type: 'text-end', id: messageId }
}

async function* wrapVProxyStream(
  prompt: string,
  options: Partial<ClaudeSDKConfig>,
  onText: (text: string) => void,
  isAborted: () => boolean,
  abortSignal: AbortSignal,
  enableTools = false,
  requestId?: string,
): AsyncGenerator<BridgeStreamEvent> {
  const messageId = `vproxy-${Date.now()}`
  let textStarted = false

  try {
    const result = streamTextViaVProxy({
      prompt,
      systemPrompt: options.systemPrompt,
      model: options.model,
      maxOutputTokens: 8192,
      abortSignal,
      enableTools,
      requestId,
    })

    let deltaCount = 0
    let toolCallCount = 0
    let stepCount = 0
    // Use fullStream to capture text across multi-step tool calling.
    // textStream only yields text-type content and misses text generated
    // after tool results are sent back to the model.
    for await (const part of result.fullStream) {
      if (isAborted()) break

      if (part.type === 'step-start') stepCount++

      switch (part.type) {
        case 'text-delta':
          if (part.text) {
            deltaCount++
            if (!textStarted) {
              textStarted = true
              yield { type: 'text-start', id: messageId }
            }
            onText(part.text)
            yield { type: 'text-delta', id: messageId, delta: part.text }
          }
          break
        case 'tool-call':
          toolCallCount++
          yield {
            type: 'tool-use',
            id: messageId,
            metadata: { toolName: part.toolName, toolCallId: part.toolCallId },
          }
          break
        case 'error':
          console.error(`${LOG_PREFIX} fullStream error event:`, (part as any).error)
          yield {
            type: 'error',
            id: messageId,
            delta: (part as any).error?.message ?? 'VProxy stream error',
          }
          break
        // tool-result, step-start, step-finish, etc. — skip
      }
    }
    console.log(`${LOG_PREFIX} VProxy fullStream ended (${deltaCount} text deltas, ${toolCallCount} tool calls, textStarted=${textStarted})`)
  } catch (err) {
    if (isAborted()) return
    console.error(`${LOG_PREFIX} VProxy stream error:`, err)
    console.warn(`${LOG_PREFIX} Falling back to Claude CLI`)
    const { process: proc, abort } = spawnClaudeProcess(prompt, options)
    yield* parseClaudeStream(proc, onText, isAborted, abort)
    return
  }

  if (!textStarted) {
    yield { type: 'text-start', id: messageId }
  }
  yield { type: 'text-end', id: messageId }
}

// ── Prompt Building ────────────────────────────────────────────────────────

function buildPrompt(
  message: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }>,
  researchContext?: string,
): string {
  const parts: string[] = []

  // Add conversation history as context (last 10 messages max)
  const recentHistory = history.slice(-10)
  if (recentHistory.length > 0) {
    parts.push('<conversation_history>')
    for (const msg of recentHistory) {
      parts.push(`<${msg.role}>${msg.content}</${msg.role}>`)
    }
    parts.push('</conversation_history>')
    parts.push('')
  }

  // Add research context if available
  if (researchContext) {
    parts.push('<research_context>')
    parts.push(researchContext)
    parts.push('</research_context>')
    parts.push('')
  }

  // Current message
  parts.push(message)

  return parts.join('\n')
}

// ── Stream Parser ──────────────────────────────────────────────────────────

async function* parseClaudeStream(
  proc: import('node:child_process').ChildProcess,
  onText: (text: string) => void,
  isAborted: () => boolean,
  abort: () => void,
): AsyncGenerator<BridgeStreamEvent> {
  const messageId = `claude-sdk-${Date.now()}`
  const reasoningId = `claude-sdk-reasoning-${Date.now()}`

  let buffer = ''
  let hasStartedText = false
  let hasStartedReasoning = false

  // Create async iterator from stdout
  const stdout = proc.stdout
  if (!stdout) {
    yield { type: 'error', id: messageId, delta: 'No stdout from Claude process' }
    return
  }

  // Yield reasoning start — real Claude thinking will populate this
  yield { type: 'reasoning-start', id: reasoningId }
  hasStartedReasoning = true

  try {
    for await (const chunk of stdout) {
      if (isAborted()) break

      buffer += chunk.toString()

      // Parse newline-delimited JSON
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? '' // Keep incomplete last line

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed) continue

        let event: ClaudeStreamEvent
        try {
          event = JSON.parse(trimmed)
        } catch {
          // Not JSON — might be a log line from Claude, skip
          continue
        }

        const result = processStreamEvent(event, messageId, reasoningId, hasStartedText, hasStartedReasoning, onText)
        if (result) {
          for (const evt of result.events) {
            yield evt
          }
          hasStartedText = result.hasStartedText
          hasStartedReasoning = result.hasStartedReasoning
        }
      }
    }

    // Process any remaining buffer
    if (buffer.trim()) {
      try {
        const event: ClaudeStreamEvent = JSON.parse(buffer.trim())
        const result = processStreamEvent(event, messageId, reasoningId, hasStartedText, hasStartedReasoning, onText)
        if (result) {
          for (const evt of result.events) {
            yield evt
          }
          hasStartedText = result.hasStartedText
        }
      } catch {
        // Ignore incomplete JSON
      }
    }
  } catch (err) {
    if (!isAborted()) {
      console.error(`${LOG_PREFIX} Stream error:`, err)
      yield {
        type: 'error',
        id: messageId,
        delta: err instanceof Error ? err.message : 'Stream error',
      }
    }
  }

  // Close open streams
  if (hasStartedReasoning) {
    yield { type: 'reasoning-end', id: reasoningId }
  }
  if (!hasStartedText) {
    yield { type: 'text-start', id: messageId }
    hasStartedText = true
  }
  yield { type: 'text-end', id: messageId }
}

function processStreamEvent(
  event: ClaudeStreamEvent,
  messageId: string,
  reasoningId: string,
  hasStartedText: boolean,
  hasStartedReasoning: boolean,
  onText: (text: string) => void,
): { events: BridgeStreamEvent[]; hasStartedText: boolean; hasStartedReasoning: boolean } | null {
  const events: BridgeStreamEvent[] = []

  switch (event.type) {
    case 'system':
      // System message from Claude CLI — add as reasoning (skip if no message)
      if (hasStartedReasoning && event.message) {
        events.push({
          type: 'reasoning-delta',
          id: reasoningId,
          delta: `${event.message}\n`,
        })
      }
      break

    case 'content_block_delta':
      if (event.delta?.text) {
        // End reasoning if still open, start text
        if (hasStartedReasoning && !hasStartedText) {
          events.push({ type: 'reasoning-end', id: reasoningId })
          hasStartedReasoning = false
          events.push({ type: 'text-start', id: messageId })
          hasStartedText = true
        } else if (!hasStartedText) {
          events.push({ type: 'text-start', id: messageId })
          hasStartedText = true
        }

        events.push({
          type: 'text-delta',
          id: messageId,
          delta: event.delta.text,
        })
        onText(event.delta.text)
      }
      break

    case 'content_block_start':
      if (event.content_block?.type === 'tool_use') {
        events.push({
          type: 'tool-use',
          id: messageId,
          metadata: {
            toolName: (event.content_block as { name?: string }).name,
            toolId: (event.content_block as { id?: string }).id,
          },
        })
        // Add reasoning about tool use
        if (hasStartedReasoning) {
          events.push({
            type: 'reasoning-delta',
            id: reasoningId,
            delta: `Using tool: ${(event.content_block as { name?: string }).name}\n`,
          })
        }
      }
      break

    case 'assistant':
      // Full message — extract text from content blocks
      if (event.message?.content) {
        for (const block of event.message.content) {
          if (block.type === 'text' && block.text) {
            if (!hasStartedText) {
              if (hasStartedReasoning) {
                events.push({ type: 'reasoning-end', id: reasoningId })
                hasStartedReasoning = false
              }
              events.push({ type: 'text-start', id: messageId })
              hasStartedText = true
            }
            events.push({ type: 'text-delta', id: messageId, delta: block.text })
            onText(block.text)
          }
        }
      }
      break

    case 'result':
      // Final result — add metadata as reasoning
      if (hasStartedReasoning) {
        events.push({
          type: 'reasoning-delta',
          id: reasoningId,
          delta: `Completed in ${event.duration_ms}ms (${event.num_turns} turn${event.num_turns !== 1 ? 's' : ''}).`,
        })
      }
      break

    case 'error':
      events.push({
        type: 'error',
        id: messageId,
        delta: event.error?.message ?? 'Unknown Claude SDK error',
      })
      break

    default:
      // message_start, message_delta, message_stop, content_block_stop — ignore
      break
  }

  if (events.length === 0) return null
  return { events, hasStartedText, hasStartedReasoning }
}
