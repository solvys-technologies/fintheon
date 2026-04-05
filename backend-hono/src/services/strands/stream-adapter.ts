// [claude-code 2026-04-04] Strands → UIMessageStream adapter
// Transforms Strands agent stream events into the UIMessageStream protocol
// that @assistant-ui/react's DefaultChatTransport expects.
import type { Agent } from '@strands-agents/sdk'
import { createLogger } from '../../lib/logger.js'

const log = createLogger('StrandsStream')

/**
 * UIMessageStream event types expected by @assistant-ui/react
 */
type UIEvent =
  | { type: 'start'; messageId: string }
  | { type: 'start-step' }
  | { type: 'text-start'; id: string }
  | { type: 'text-delta'; id: string; delta: string }
  | { type: 'text-end'; id: string }
  | { type: 'reasoning-start'; id: string }
  | { type: 'reasoning-delta'; id: string; delta: string }
  | { type: 'reasoning-end'; id: string }
  | { type: 'finish-step' }
  | { type: 'finish'; finishReason: string }
  | { type: 'error'; errorText: string }

/**
 * Convert a Strands agent stream into a ReadableStream of UIMessageStream events.
 * Bridges Strands' async generator to the SSE format the frontend consumes.
 *
 * Strands event types (from hooks/events.d.ts):
 * - modelStreamUpdateEvent: wraps ModelStreamEvent (message start/stop, content block start/delta/stop)
 * - contentBlockEvent: completed content block (TextBlock, ToolUseBlock, ReasoningBlock)
 * - toolResultEvent: tool execution result
 * - beforeToolCallEvent / afterToolCallEvent: tool lifecycle
 * - agentResultEvent: final agent result
 */
export function strandsToUIStream(
  agent: Agent,
  input: string,
  options?: { messageId?: string; onFinish?: (text: string) => Promise<void> },
): ReadableStream<UIEvent> {
  const messageId = options?.messageId ?? `msg-${Date.now()}`
  let cancelled = false

  return new ReadableStream<UIEvent>({
    start(controller) {
      ;(async () => {
        let fullText = ''
        let stepCount = 0
        let textStarted = false
        let reasoningStarted = false
        let reasoningEnded = false
        let currentTextId = ''
        let currentReasoningId = ''
        let inToolPhase = false

        /** Close the current text block if open */
        function closeText() {
          if (textStarted) {
            controller.enqueue({ type: 'text-end', id: currentTextId })
            textStarted = false
          }
        }

        /** Close the current reasoning block if open */
        function closeReasoning() {
          if (reasoningStarted && !reasoningEnded) {
            reasoningEnded = true
            controller.enqueue({ type: 'reasoning-end', id: currentReasoningId })
          }
        }

        /** Close the current step (text + reasoning + finish-step) */
        function closeStep() {
          closeReasoning()
          closeText()
          if (stepCount > 0) {
            controller.enqueue({ type: 'finish-step' })
          }
        }

        /** Open a new step with fresh IDs */
        function openStep() {
          stepCount++
          currentTextId = `text-${Date.now()}-${stepCount}`
          currentReasoningId = `reasoning-${Date.now()}-${stepCount}`
          textStarted = false
          reasoningStarted = false
          reasoningEnded = false
          controller.enqueue({ type: 'start-step' })
        }

        // Protocol framing
        controller.enqueue({ type: 'start', messageId })
        openStep()

        try {
          for await (const event of agent.stream(input)) {
            if (cancelled) break

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const ev = event as any

            if (ev.type === 'modelStreamUpdateEvent' && ev.event) {
              const inner = ev.event

              if (inner.type === 'modelContentBlockDeltaEvent' && inner.delta) {
                const delta = inner.delta

                if (delta.type === 'textDelta' && delta.text) {
                  // If returning from a tool phase, close old step and open new one
                  if (inToolPhase) {
                    inToolPhase = false
                    closeStep()
                    openStep()
                  }
                  // Close reasoning before first text in this step
                  closeReasoning()
                  if (!textStarted) {
                    textStarted = true
                    controller.enqueue({ type: 'text-start', id: currentTextId })
                  }
                  fullText += delta.text
                  controller.enqueue({ type: 'text-delta', id: currentTextId, delta: delta.text })
                } else if (delta.type === 'reasoningContentDelta' && delta.text) {
                  if (!reasoningStarted) {
                    reasoningStarted = true
                    controller.enqueue({ type: 'reasoning-start', id: currentReasoningId })
                  }
                  controller.enqueue({ type: 'reasoning-delta', id: currentReasoningId, delta: delta.text })
                }
              }
            } else if (ev.type === 'toolResultEvent') {
              log.info('Tool result', { tool: ev.result?.toolName })
              inToolPhase = true
            }
          }
        } catch (err) {
          const errorText = err instanceof Error ? err.message : String(err)
          log.error('Stream error', { error: errorText })

          closeStep()
          controller.enqueue({ type: 'error', errorText })
          controller.enqueue({ type: 'finish-step' })
          controller.enqueue({ type: 'finish', finishReason: 'error' })

          if (!cancelled) controller.close()
          return
        }

        // Clean close
        closeStep()
        controller.enqueue({ type: 'finish', finishReason: 'stop' })

        if (options?.onFinish) {
          await options.onFinish(fullText)
        }

        if (!cancelled) controller.close()
      })().catch((error) => {
        log.error('Fatal stream error', { error: String(error) })
        try {
          controller.enqueue({
            type: 'error',
            errorText: error instanceof Error ? error.message : String(error),
          })
          controller.enqueue({ type: 'finish-step' })
          controller.enqueue({ type: 'finish', finishReason: 'error' })
          controller.close()
        } catch {
          controller.error(error)
        }
      })
    },
    cancel() {
      cancelled = true
    },
  })
}

/**
 * Convert the UIEvent ReadableStream into an SSE Response for Hono.
 * Writes proper `data:` framing with newline-delimited JSON.
 */
export function uiStreamToSSEResponse(
  stream: ReadableStream<UIEvent>,
  headers?: Record<string, string>,
): Response {
  const encoder = new TextEncoder()

  const sseStream = stream.pipeThrough(
    new TransformStream<UIEvent, Uint8Array>({
      transform(event, controller) {
        const json = JSON.stringify(event)
        controller.enqueue(encoder.encode(`data: ${json}\n\n`))
      },
    }),
  )

  return new Response(sseStream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
      'x-vercel-ai-ui-message-stream': 'v1',
      ...headers,
    },
  })
}
