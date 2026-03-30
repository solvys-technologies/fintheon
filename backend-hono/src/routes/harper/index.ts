// [claude-code 2026-03-28] S8-T7: Harper-Opus routes — Claude CLI chat endpoint
/**
 * Harper-Opus Routes
 * POST /api/harper/chat — streaming SSE chat via Claude Code CLI
 * GET  /api/harper/status — check if Claude CLI is available
 */

import { Hono } from 'hono'
import { createUIMessageStreamResponse } from 'ai'
import { harperChat, isHarperAvailable, type HarperChatRequest } from '../../services/harper-handler.js'
import { createRequestCognition } from '../../services/cognition-emitter.js'
import * as conversationStore from '../../services/ai/conversation-store.js'
import type { BridgeStreamEvent } from '../../services/claude-sdk/bridge.js'

export function createHarperRoutes() {
  const app = new Hono()

  // ── Status check ─────────────────────────────────────────────────────────
  app.get('/status', async (c) => {
    const available = await isHarperAvailable()
    return c.json({ available, agent: 'harper-opus', model: 'claude-opus-local' })
  })

  // ── Chat (streaming SSE) ─────────────────────────────────────────────────
  app.post('/chat', async (c) => {
    const startTime = Date.now()
    const requestId = `harper-${Date.now()}-${Math.random().toString(36).substring(7)}`
    const cognition = createRequestCognition(requestId, startTime)

    c.header('X-Request-Id', requestId)

    // Check availability
    const available = await isHarperAvailable()
    if (!available) {
      cognition.step('error', 'Claude CLI unavailable', 'Claude Code CLI not found or at capacity')
      cognition.done()
      return c.json({ error: 'Harper-Opus unavailable — Claude CLI not detected' }, 503)
    }

    try {
      const body = await c.req.json<{
        message: string
        conversationId?: string
        history?: Array<{ role: 'user' | 'assistant'; content: string }>
        thinkHarder?: boolean
        persona?: string
        riskFlowContext?: string
      }>()

      const message = body.message?.trim()
      if (!message) {
        return c.json({ error: 'Message is required' }, 400)
      }

      // Get or create conversation
      const userId = (c.get('userId' as never) as string) || 'anonymous'
      const reqConversationId = body.conversationId ?? undefined
      let conversation = reqConversationId
        ? await conversationStore.getConversation(reqConversationId, userId)
        : null
      if (!conversation) {
        conversation = await conversationStore.createConversation(userId, {
          title: message.slice(0, 60),
          model: 'harper-opus',
        })
      }

      // Store user message
      await conversationStore.addMessage(conversation.id, {
        conversationId: conversation.id,
        role: 'user',
        content: message,
        model: 'harper-opus',
      })

      cognition.step('agent-route', 'Harper-Opus (Claude CLI)', `Persona: ${body.persona ?? 'harper-opus'}`)

      const request: HarperChatRequest = {
        message,
        conversationId: conversation.id,
        history: body.history ?? [],
        thinkHarder: body.thinkHarder,
        persona: body.persona,
        riskFlowContext: body.riskFlowContext,
      }

      const result = await harperChat(request)

      cognition.step('gateway-call', 'Streaming from Claude Opus', 'Local CLI bridge, MCP tools available')

      // Stream bridge events → AI SDK UIMessageStream format (matches DefaultChatTransport)
      const uiMessageId = `harper-${Date.now()}`
      const uiReasoningId = `reasoning-${Date.now()}`
      let cancelled = false

      const stream = new ReadableStream({
        start(controller) {
          ;(async () => {
            let fullText = ''
            let reasoningStarted = false
            let reasoningEnded = false
            let textStarted = false
            let textEnded = false

            for await (const event of result.stream) {
              if (cancelled) break

              switch (event.type) {
                case 'reasoning-start':
                  if (!reasoningStarted) {
                    reasoningStarted = true
                    controller.enqueue({ type: 'reasoning-start', id: uiReasoningId })
                  }
                  break
                case 'reasoning-delta':
                  if (event.delta) {
                    if (!reasoningStarted) {
                      reasoningStarted = true
                      controller.enqueue({ type: 'reasoning-start', id: uiReasoningId })
                    }
                    controller.enqueue({ type: 'reasoning-delta', id: uiReasoningId, delta: event.delta })
                  }
                  break
                case 'reasoning-end':
                  if (reasoningStarted && !reasoningEnded) {
                    reasoningEnded = true
                    controller.enqueue({ type: 'reasoning-end', id: uiReasoningId })
                  }
                  break
                case 'text-start':
                  // Handled by first text-delta
                  break
                case 'text-delta':
                  if (event.delta) {
                    // Close reasoning before first text
                    if (reasoningStarted && !reasoningEnded) {
                      reasoningEnded = true
                      controller.enqueue({ type: 'reasoning-end', id: uiReasoningId })
                    }
                    if (!textStarted) {
                      textStarted = true
                      controller.enqueue({ type: 'text-start', id: uiMessageId })
                    }
                    fullText += event.delta
                    controller.enqueue({ type: 'text-delta', id: uiMessageId, delta: event.delta })
                  }
                  break
                case 'text-end':
                  if (textStarted && !textEnded) {
                    textEnded = true
                    controller.enqueue({ type: 'text-end', id: uiMessageId })
                  }
                  break
                case 'tool-use':
                  // Pass through tool events for cognition visibility
                  break
                case 'error':
                  cognition.step('error', 'Harper-Opus error', event.delta ?? 'Unknown error')
                  break
              }
            }

            // Close any open streams
            if (reasoningStarted && !reasoningEnded) {
              controller.enqueue({ type: 'reasoning-end', id: uiReasoningId })
            }
            if (textStarted && !textEnded) {
              controller.enqueue({ type: 'text-end', id: uiMessageId })
            }

            // Store assistant response
            if (fullText) {
              await conversationStore.addMessage(conversation.id, {
                conversationId: conversation.id,
                role: 'assistant',
                content: fullText,
                model: 'harper-opus',
              })
            }

            const duration = Date.now() - startTime
            console.log(`[HarperOpus][${requestId}] Complete (${duration}ms, ${fullText.length} chars)`)
            cognition.step('response-ready', 'Response complete', `${fullText.length} chars in ${duration}ms`)
            cognition.done()
            if (!cancelled) controller.close()
          })().catch((error) => {
            console.error(`[HarperOpus][${requestId}] Fatal stream error:`, error)
            cognition.step('error', 'Stream error', error instanceof Error ? error.message : String(error))
            cognition.done()
            if (!cancelled) controller.error(error)
          })
        },
        cancel() {
          cancelled = true
          result.abort()
        },
      })

      c.header('X-Conversation-Id', conversation.id)
      c.header('X-Request-Id', requestId)
      c.header('X-Hermes-Agent', 'harper-opus')

      return createUIMessageStreamResponse({
        stream,
        headers: {
          'X-Conversation-Id': conversation.id,
          'X-Request-Id': requestId,
          'X-Hermes-Agent': 'harper-opus',
          'Access-Control-Allow-Origin': c.req.header('Origin') || '*',
          'Access-Control-Allow-Credentials': 'true',
          'Access-Control-Expose-Headers': 'X-Conversation-Id, X-Request-Id, X-Hermes-Agent',
        },
      })
    } catch (error) {
      console.error(`[HarperOpus][${requestId}] Handler error:`, error)
      cognition.done()
      return c.json({
        error: 'Harper-Opus request failed',
        details: error instanceof Error ? error.message : String(error),
      }, 500)
    }
  })

  return app
}
