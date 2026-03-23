// [claude-code 2026-03-14] thinkHarder maps to Claude Opus deep thought via OpenRouter (no reasoning param)
// [claude-code 2026-03-14] Model routing fix: default→Sonnet, thinkHarder→Opus
/**
 * AI Chat Handler
 * Handle chat messages and AI responses - Hermes Local Processing
 * Routes through P.I.C. agent network for local single-user mode
 *
 * Inference priority chain:
 *   1. OpenRouter Claude Opus 4.6 (deep thought) — when thinkHarder + OPENROUTER_API_KEY
 *   2. Hermes/OpenRouter (Sonnet 4.6, Nous subscription) — default for all chat
 *   3. Claude SDK Bridge (Opus, free via Max) — for thinkHarder or explicit claude-local model
 *   4. OpenRouter (Opus 4.6) — default when no Claude SDK
 * No 21st, Exa, or other agent API keys required beyond OpenRouter.
 */

import type { Context } from 'hono'
import { createUIMessageStreamResponse, streamText } from 'ai'
import { selectModel, createModelClient, logModelSelection, markProviderUnhealthy, getFallbackModel, setRuntimeGitHubToken, type AiModelKey } from '../../../services/ai/model-selector.js'
import * as conversationStore from '../../../services/ai/conversation-store.js'
import { defaultAiConfig } from '../../../config/ai-config.js'
import type { ChatRequest } from '../../../types/ai-chat.js'
import type { HermesAgentRole } from '../../../services/hermes-service.js'
import { handleHermesChat, detectAgent, type ContentPart } from '../../../services/hermes-handler.js'
import { getAgentSystemPrompt, extractSkillTag, buildFeedContext } from '../../../services/ai/agent-instructions/index.js'
import { extractSkillFromMessage, isSkillEnabled, getSkillDisabledReason } from '../../../config/feature-flags.js'
import { createRequestCognition } from '../../../services/cognition-emitter.js'
import { enqueue, completeJob } from '../../../services/chat-queue.js'
import { isBridgeAvailable, bridgeChat, type BridgeStreamEvent } from '../../../services/claude-sdk/bridge.js'
import { resolveModelKey } from '../../../config/ai-config.js'
import { takeScreenshot, isPlaywrightReady } from '../../../services/screenshot-service.js'

const OPENROUTER_HERMES_4_MODEL = 'anthropic/claude-opus-4.6'

// File attachment content part types
type FileContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }
  | { type: 'file'; file: { name: string; mimeType: string; data: string } }

// Timeout for streaming responses (60 seconds)
const STREAM_TIMEOUT_MS = 60_000
const LOCAL_STREAM_CHUNK_SIZE = 72
const LOCAL_STREAM_CHUNK_DELAY_MS = Number(process.env.HERMES_STREAM_CHUNK_DELAY_MS ?? '18')
const LOCAL_REASONING_CHUNK_SIZE = 52
const LOCAL_REASONING_CHUNK_DELAY_MS = Number(process.env.HERMES_REASONING_CHUNK_DELAY_MS ?? '14')

// Check if we should use local Hermes processing
const USE_LOCAL_HERMES = process.env.USE_LOCAL_HERMES !== 'false'

function toAgentLabel(agent: HermesAgentRole | string): string {
  switch (agent) {
    case 'harper-cao':
      return 'Harper-Hermes / CAO'
    case 'pma-merged':
      return 'Oracle (All-Seer)'
    case 'futures-desk':
      return 'Feucht (Futures & Risk)'
    case 'fundamentals-desk':
      return 'Consul (Fundamentals)'
    case 'herald':
      return 'Herald (News & Sentiment)'
    default:
      return 'PIC Analyst'
  }
}

function buildLocalReasoningTrace(options: {
  agent: HermesAgentRole
  intent?: string
  userMessage: string
  symbols?: string[]
}): string {
  const { agent, intent, userMessage, symbols } = options
  const compactInput = userMessage.replace(/\s+/g, ' ').trim()
  const promptPreview = compactInput.length > 96 ? `${compactInput.slice(0, 96)}...` : compactInput
  const symbolText = symbols && symbols.length > 0 ? symbols.join(', ') : 'none detected'
  const intentText = intent || 'general'

  return [
    `Routing request to ${toAgentLabel(agent)} (${intentText}).`,
    `Context scan: symbols = ${symbolText}.`,
    `Applying P.I.C. risk and execution framework before final answer.`,
    `User prompt focus: "${promptPreview}".`,
  ].join('\n')
}

/**
 * POST /api/ai/chat
 * Hermes Local Processing - Routes through P.I.C. agent network
 */
export async function handleChat(c: Context) {
  const startTime = Date.now()
  const requestId = `chat-${Date.now()}-${Math.random().toString(36).substring(7)}`
  const userId = c.get('userId') as string | undefined

  // Pass user's GitHub OAuth token for GitHub Models (GPT-4o)
  const githubToken = c.req.header('X-GitHub-Token')
  setRuntimeGitHubToken(githubToken || undefined)

  // Create scoped cognition emitter — frontend subscribes via /api/ai/cognition/stream?requestId=
  const cognition = createRequestCognition(requestId, startTime)

  console.log(`[Hermes][${requestId}] Request started (local mode: ${USE_LOCAL_HERMES}, github: ${Boolean(githubToken)})`)

  // Expose requestId so frontend can open cognition SSE stream
  c.header('X-Request-Id', requestId)

  if (!userId) {
    console.warn(`[Hermes][${requestId}] Unauthorized - no userId`)
    return c.json({ error: 'Unauthorized' }, 401)
  }

  try {
    const body = await c.req.json<ChatRequest & { messages?: { role: string; content: string }[] }>().catch((err) => {
      console.error(`[Hermes][${requestId}] Failed to parse request body:`, err)
      return null
    })

    // Support both 'message' (string) and 'messages' (array from Vercel AI SDK)
    // Content can be string or multimodal array [{type:'text',text:''},{type:'image_url',image_url:{url:''}}]
    let message = body?.message?.trim() ?? ''
    let multimodalContent: ContentPart[] | undefined
    if (!message && body?.messages?.length) {
      const lastUserMsg = [...body.messages].reverse().find(m => m.role === 'user')
      const rawContent = lastUserMsg?.content
      if (typeof rawContent === 'string') {
        message = rawContent.trim()
      } else if (Array.isArray(rawContent)) {
        // Multimodal content array — supports text, images, and file attachments
        const textParts: string[] = []
        const fileParts: string[] = []
        const imageParts: ContentPart[] = []

        for (const part of rawContent as FileContentPart[]) {
          if (part.type === 'text') {
            textParts.push(part.text)
          } else if (part.type === 'image_url') {
            imageParts.push(part as ContentPart)
          } else if (part.type === 'file' && part.file) {
            const { name, mimeType, data } = part.file
            if (mimeType.startsWith('image/')) {
              // Images → base64 vision input
              imageParts.push({ type: 'image_url', image_url: { url: `data:${mimeType};base64,${data}` } })
            } else if (
              mimeType.startsWith('text/') ||
              mimeType === 'application/json' ||
              mimeType === 'application/javascript' ||
              mimeType === 'application/typescript' ||
              mimeType === 'application/xml'
            ) {
              // Text/code → inline context
              const decoded = Buffer.from(data, 'base64').toString('utf-8')
              fileParts.push(`--- File: ${name} ---\n${decoded}\n--- End: ${name} ---`)
            } else if (mimeType === 'application/pdf') {
              // PDFs → extract text (base64 decode, best-effort UTF-8)
              const decoded = Buffer.from(data, 'base64').toString('utf-8')
              const cleaned = decoded.replace(/[^\x20-\x7E\n\r\t]/g, ' ').replace(/\s{3,}/g, '\n')
              fileParts.push(`--- PDF: ${name} ---\n${cleaned.slice(0, 50_000)}\n--- End: ${name} ---`)
            }
          }
        }

        message = textParts.join('').trim()
        if (fileParts.length > 0) {
          message = `${fileParts.join('\n\n')}\n\n${message}`
        }
        if (imageParts.length > 0) {
          multimodalContent = [
            ...imageParts,
            { type: 'text' as const, text: message },
          ]
        }
      }
    }

    if (!message) {
      console.warn(`[Hermes][${requestId}] Empty message`)
      return c.json({ error: 'Message is required' }, 400)
    }

    // Enforce skill permissions
    const detectedSkill = extractSkillFromMessage(message)
    if (detectedSkill && !isSkillEnabled(detectedSkill)) {
      const reason = getSkillDisabledReason(detectedSkill) || 'This skill is currently disabled.'
      console.warn(`[Hermes][${requestId}] Blocked disabled skill: ${detectedSkill}`)
      cognition.step('skill-check', `Skill blocked: ${detectedSkill}`, reason)
      cognition.done()
      return c.json({ error: 'Skill unavailable', reason }, 403)
    }
    if (detectedSkill) {
      cognition.step('skill-check', `Skill active: ${detectedSkill}`)
    }

    // Auto-screenshot for QUICKFINTHEON when no image parts present
    if (detectedSkill === 'QUICKFINTHEON' && !multimodalContent?.some(p => p.type === 'image_url')) {
      try {
        if (await isPlaywrightReady()) {
          cognition.step('tool-dispatch', 'Playwright screenshot', 'Auto-capturing dashboard for QuickFintheon')
          const shot = await takeScreenshot()
          const imgPart: ContentPart = { type: 'image_url', image_url: { url: `data:image/png;base64,${shot.base64}` } }
          if (multimodalContent) {
            multimodalContent.push(imgPart)
          } else {
            multimodalContent = [
              { type: 'text' as const, text: message },
              imgPart,
            ]
          }
          console.log(`[Hermes][${requestId}] QuickFintheon auto-screenshot captured`)
        }
      } catch (err) {
        console.warn(`[Hermes][${requestId}] QuickFintheon auto-screenshot failed, proceeding without:`, err)
      }
    }

    console.log(`[Hermes][${requestId}] Message: "${message.substring(0, 50)}..." (${message.length} chars)`)

    const { conversationId, model, taskType, agentOverride, thinkHarder } = body ?? {} as any

    // Get or create conversation
    let conversation = conversationId
      ? await conversationStore.getConversation(conversationId, userId)
      : null

    if (conversationId && !conversation) {
      console.log(`[Hermes][${requestId}] Conversation ${conversationId} not found, creating new`)
      conversation = null
    }

    if (!conversation) {
      const title = conversationStore.generateTitle(message)
      conversation = await conversationStore.createConversation(userId, { title, model })
      console.log(`[Hermes][${requestId}] Created conversation: ${conversation.id}`)
    } else {
      console.log(`[Hermes][${requestId}] Using existing conversation: ${conversation.id}`)
    }

    // Store user message
    await conversationStore.addMessage(conversation.id, {
      conversationId: conversation.id,
      role: 'user',
      content: message,
    })
    console.log(`[Hermes][${requestId}] User message saved`)

    // Get conversation history
    const history = await conversationStore.getRecentContext(conversation.id)
    console.log(`[Hermes][${requestId}] History: ${history.length} messages`)
    cognition.step('context-build', `Context assembled`, `${history.length} messages in history`)

    // Detect which P.I.C. agent should handle this
    const agentInfo = detectAgent(message)
    console.log(`[Hermes][${requestId}] Routed to agent: ${agentInfo.agent} (intent: ${agentInfo.intent}, confidence: ${agentInfo.confidence})`)
    cognition.step(
      'agent-route',
      `Routed → ${toAgentLabel(agentInfo.agent)}`,
      `intent: ${agentInfo.intent}, confidence: ${Math.round(agentInfo.confidence * 100)}%`
    )

    // LOCAL HERMES is always the primary path.
    // GitHub Models (GPT-4o) is available as a fallback when OpenRouter is down.
    // Only use GitHub Models if explicitly requested via model param.
    const useGitHubModel = Boolean(githubToken) && model === 'github-deepseek'

    const bridgeAvailable = await isBridgeAvailable()
    const preferClaudeSDK = thinkHarder && bridgeAvailable
    const openRouterKey = process.env.OPENROUTER_API_KEY
    const useNousHermesReasoning = thinkHarder && Boolean(openRouterKey?.trim())

    // PATH 1: OpenRouter Claude Opus deep thought (thinking toggle)
    if (useNousHermesReasoning && !useGitHubModel) {
      console.log(`[Hermes][${requestId}] Using OpenRouter Claude Opus 4.6 (deep thought)`)
      cognition.step('agent-route', 'Claude Opus Deep', 'Deep thought via OpenRouter')

      const augmentedMessage = message

      const skillTag = extractSkillTag(message)
      const basePrompt = getAgentSystemPrompt(agentInfo.agent, { skillTag, thinkHarder: true })
      // Inject live RiskFlow headlines so agents can reference real-time data
      const feedContext = await buildFeedContext()
      const systemPrompt = basePrompt + feedContext
      const openRouterMessages: { role: string; content: string | unknown[] }[] = [
        { role: 'system', content: systemPrompt },
        ...history.map(h => ({ role: h.role, content: h.content })),
      ]
      if (multimodalContent?.length) {
        openRouterMessages.push({ role: 'user', content: multimodalContent })
      } else {
        openRouterMessages.push({ role: 'user', content: augmentedMessage })
      }

      try {
        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openRouterKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': process.env.OPENROUTER_APP_URL ?? 'https://fintheon-solvys.vercel.app',
            'X-Title': process.env.OPENROUTER_APP_NAME ?? 'Fintheon-AI-Gateway',
          },
          body: JSON.stringify({
            model: OPENROUTER_HERMES_4_MODEL,
            messages: openRouterMessages,
            stream: true,
            max_tokens: 8192,
          }),
        })

        if (!res.ok || !res.body) {
          const errText = await res.text()
          console.warn(`[Hermes][${requestId}] OpenRouter Opus deep failed ${res.status}, falling through: ${errText.slice(0, 200)}`)
        } else {
          const uiMessageId = `assistant-${Date.now()}`
          const uiReasoningId = `reasoning-${Date.now()}`
          let fullText = ''
          let reasoningOpened = false
          let reasoningClosed = false
          let textEndSent = false

          const stream = new ReadableStream({
            async start(controller) {
              try {
                const reader = res.body!.getReader()
                const decoder = new TextDecoder()
                let buffer = ''
                // Don't emit reasoning-start until we see actual reasoning deltas.
                // Emitting it unconditionally with no reasoning-end breaks the AI SDK
                // stream parser (it stays in "reasoning mode" and swallows text events).
                while (true) {
                  const { value, done } = await reader.read()
                  if (done) break
                  buffer += decoder.decode(value, { stream: true })
                  const lines = buffer.split('\n')
                  buffer = lines.pop() ?? ''
                  for (const line of lines) {
                    if (line.startsWith('data: ') && line !== 'data: [DONE]') {
                      try {
                        const json = JSON.parse(line.slice(6)) as {
                          choices?: { delta?: { content?: string; reasoning?: string }; finish_reason?: string }[]
                        }
                        const delta = json.choices?.[0]?.delta
                        if (delta?.reasoning) {
                          if (!reasoningOpened) {
                            controller.enqueue({ type: 'reasoning-start', id: uiReasoningId })
                            reasoningOpened = true
                          }
                          controller.enqueue({ type: 'reasoning-delta', id: uiReasoningId, delta: delta.reasoning })
                        }
                        if (delta?.content) {
                          // Close reasoning before first text content
                          if (reasoningOpened && !reasoningClosed) {
                            controller.enqueue({ type: 'reasoning-end', id: uiReasoningId })
                            reasoningClosed = true
                          }
                          if (fullText === '') controller.enqueue({ type: 'text-start', id: uiMessageId })
                          fullText += delta.content
                          controller.enqueue({ type: 'text-delta', id: uiMessageId, delta: delta.content })
                        }
                        if (json.choices?.[0]?.finish_reason) {
                          if (reasoningOpened && !reasoningClosed) {
                            controller.enqueue({ type: 'reasoning-end', id: uiReasoningId })
                            reasoningClosed = true
                          }
                          if (!textEndSent) {
                            controller.enqueue({ type: 'text-end', id: uiMessageId })
                            textEndSent = true
                          }
                        }
                      } catch (_) { /* skip malformed chunk */ }
                    }
                  }
                }
                if (reasoningOpened && !reasoningClosed) controller.enqueue({ type: 'reasoning-end', id: uiReasoningId })
                if (fullText && !textEndSent) controller.enqueue({ type: 'text-end', id: uiMessageId })
                if (fullText) {
                  await conversationStore.addMessage(conversation.id, {
                    conversationId: conversation.id,
                    role: 'assistant',
                    content: fullText,
                    model: 'claude-opus-deep',
                  })
                }
                cognition.step('response-ready', 'Claude Opus deep complete', `${fullText.length} chars`)
                cognition.done()
                controller.close()
              } catch (err) {
                console.error(`[Hermes][${requestId}] OpenRouter stream error:`, err)
                cognition.step('error', 'Stream error', err instanceof Error ? err.message : String(err))
                cognition.done()
                controller.error(err)
              }
            },
          })

          c.header('X-Conversation-Id', conversation.id)
          c.header('X-Request-Id', requestId)
          c.header('X-Hermes-Agent', 'claude-opus-deep')
          return createUIMessageStreamResponse({
            stream,
            headers: {
              'X-Conversation-Id': conversation.id,
              'X-Request-Id': requestId,
              'X-Hermes-Agent': 'claude-opus-deep',
              'Access-Control-Allow-Origin': c.req.header('Origin') || '*',
              'Access-Control-Allow-Credentials': 'true',
              'Access-Control-Expose-Headers': 'X-Conversation-Id, X-Request-Id, X-Hermes-Agent, X-Research-Sources',
            },
          })
        }
      } catch (err) {
        console.warn(`[Hermes][${requestId}] OpenRouter Opus deep error, falling through:`, err)
      }
    }

    // PRIMARY PATH: Local Hermes processing via P.I.C. agent network
    // Skip when thinkHarder is enabled AND Claude SDK bridge is available (prefer Opus)
    if (USE_LOCAL_HERMES && !useGitHubModel && !preferClaudeSDK) {
      console.log(`[Hermes][${requestId}] Using LOCAL processing via P.I.C. agents`)

      const augmentedMessage = message

      // Generate response locally through Hermes
      cognition.step('gateway-call', 'Calling OpenRouter (Sonnet 4.6)', `agent: ${agentInfo.agent}`)
      const hermesResponse = await handleHermesChat({
        message: augmentedMessage,
        multimodalContent,
        conversationId: conversation.id,
        history: history.map(h => ({ role: h.role as 'user' | 'assistant', content: h.content })),
        agentOverride: agentOverride as HermesAgentRole | undefined,
        thinkHarder,
      })

      console.log(`[Hermes][${requestId}] Local response generated by ${hermesResponse.agent}`)
      cognition.step('response-ready', 'Response assembled', `${hermesResponse.content.length} chars, streaming now`)

      // Store assistant message
      await conversationStore.addMessage(conversation.id, {
        conversationId: conversation.id,
        role: 'assistant',
        content: hermesResponse.content,
        model: `hermes-${hermesResponse.agent}`,
      })

      const duration = Date.now() - startTime
      console.log(`[Hermes][${requestId}] Response complete (${duration}ms, ${hermesResponse.content.length} chars)`)

      // Set conversation ID header
      c.header('X-Conversation-Id', conversation.id)
      c.header('X-Request-Id', requestId)
      c.header('X-Hermes-Agent', hermesResponse.agent)

      // Stream using AI SDK UI message event stream (SSE with JSON payloads).
      // This matches `DefaultChatTransport` on the frontend, which expects SSE JSON events.
      const uiMessageId = `assistant-${Date.now()}`
      const uiReasoningId = `reasoning-${Date.now()}`
      const content = hermesResponse.content
      const reasoningTrace = buildLocalReasoningTrace({
        agent: hermesResponse.agent,
        intent: hermesResponse.metadata?.intent,
        userMessage: message,
        symbols: hermesResponse.metadata?.symbols,
      })

      let cancelled = false
      const stream = new ReadableStream({
        start(controller) {
          ;(async () => {
            controller.enqueue({ type: 'reasoning-start', id: uiReasoningId })
            for (let i = 0; i < reasoningTrace.length; i += LOCAL_REASONING_CHUNK_SIZE) {
              if (cancelled) return
              controller.enqueue({
                type: 'reasoning-delta',
                id: uiReasoningId,
                delta: reasoningTrace.slice(i, i + LOCAL_REASONING_CHUNK_SIZE),
              })
              await new Promise((resolve) => setTimeout(resolve, LOCAL_REASONING_CHUNK_DELAY_MS))
            }
            controller.enqueue({ type: 'reasoning-end', id: uiReasoningId })

            controller.enqueue({ type: 'text-start', id: uiMessageId })
            for (let i = 0; i < content.length; i += LOCAL_STREAM_CHUNK_SIZE) {
              if (cancelled) return
              controller.enqueue({
                type: 'text-delta',
                id: uiMessageId,
                delta: content.slice(i, i + LOCAL_STREAM_CHUNK_SIZE),
              })
              // Keep deltas incremental so UI renders as a stream.
              await new Promise((resolve) => setTimeout(resolve, LOCAL_STREAM_CHUNK_DELAY_MS))
            }

            if (!cancelled) {
              controller.enqueue({ type: 'text-end', id: uiMessageId })
              cognition.done()
              controller.close()
            }
          })().catch((error) => {
            console.error(`[Hermes][${requestId}] Local stream error:`, error)
            cognition.step('error', 'Stream error', error instanceof Error ? error.message : String(error))
            cognition.done()
            if (!cancelled) controller.error(error)
          })
        },
        cancel() {
          cancelled = true
        },
      })

      return createUIMessageStreamResponse({
        stream,
        headers: {
          'X-Conversation-Id': conversation.id,
          'X-Request-Id': requestId,
          'X-Hermes-Agent': hermesResponse.agent,
          'Access-Control-Allow-Origin': c.req.header('Origin') || '*',
          'Access-Control-Allow-Credentials': 'true',
          'Access-Control-Expose-Headers': 'X-Conversation-Id, X-Request-Id, X-Hermes-Agent, X-Research-Sources',
        }
      })
    }

    // ── PATH 2: Claude SDK Bridge (Opus via Max subscription, $0 cost) ──────
    // Triggered by: thinkHarder=true OR model='claude-local'/'claude-sdk'/'claude-max'
    const useClaudeSDK = model === 'claude-local' || resolveModelKey(model) === 'claude-local'
    const shouldUseClaudeSDK = (thinkHarder || useClaudeSDK) && !useGitHubModel

    if (shouldUseClaudeSDK && await isBridgeAvailable()) {
      console.log(`[ClaudeSDK][${requestId}] Routing through Claude SDK bridge (thinkHarder: ${thinkHarder}, model: ${model ?? 'auto'})`)
      cognition.step('agent-route', 'Claude SDK Bridge', 'Opus via Max subscription ($0 API cost)')

      const bridgeResult = bridgeChat({
        message,
        conversationId: conversation.id,
        history: history.map(h => ({ role: h.role as 'user' | 'assistant', content: h.content })),
        thinkHarder,
        researchContext: undefined,
      })

      cognition.step('gateway-call', 'Streaming from Claude Opus', 'Local CLI bridge, MCP tools available')

      let cancelled = false
      const stream = new ReadableStream({
        start(controller) {
          ;(async () => {
            let fullText = ''
            for await (const event of bridgeResult.stream) {
              if (cancelled) break
              if (event.type === 'text-delta' && event.delta) {
                fullText += event.delta
              }
              if (event.type === 'error') {
                console.error(`[ClaudeSDK][${requestId}] Stream error: ${event.delta}`)
                cognition.step('error', 'Claude SDK error', event.delta ?? 'Unknown error')
              }
              // Pass through all events — they match the UI message stream format
              controller.enqueue(event)
            }

            // Store the full response
            if (fullText) {
              await conversationStore.addMessage(conversation!.id, {
                conversationId: conversation!.id,
                role: 'assistant',
                content: fullText,
                model: 'claude-local',
              })
            }

            const duration = Date.now() - startTime
            console.log(`[ClaudeSDK][${requestId}] Complete (${duration}ms, ${fullText.length} chars)`)
            cognition.step('response-ready', 'Response complete', `${fullText.length} chars in ${duration}ms`)
            cognition.done()
            if (!cancelled) controller.close()
          })().catch((error) => {
            console.error(`[ClaudeSDK][${requestId}] Fatal stream error:`, error)
            cognition.step('error', 'Stream error', error instanceof Error ? error.message : String(error))
            cognition.done()
            if (!cancelled) controller.error(error)
          })
        },
        cancel() {
          cancelled = true
          bridgeResult.abort()
        },
      })

      c.header('X-Conversation-Id', conversation.id)
      c.header('X-Request-Id', requestId)
      c.header('X-Hermes-Agent', 'claude-opus-local')

      return createUIMessageStreamResponse({
        stream,
        headers: {
          'X-Conversation-Id': conversation.id,
          'X-Request-Id': requestId,
          'X-Hermes-Agent': 'claude-opus-local',
          'Access-Control-Allow-Origin': c.req.header('Origin') || '*',
          'Access-Control-Allow-Credentials': 'true',
          'Access-Control-Expose-Headers': 'X-Conversation-Id, X-Request-Id, X-Hermes-Agent, X-Research-Sources',
        },
      })
    }

    // ── PATH 3: External API — GitHub Models (optional) / OpenRouter (Opus 4.6) ──
    const preferredModel = useGitHubModel ? 'github-deepseek' : model
    console.log(`[Hermes][${requestId}] Using external API (preferred: ${preferredModel ?? 'auto'})`)

    // Select model based on agent task type
    const selection = selectModel({
      preferredModel,
      taskType: agentInfo.intent || taskType || 'chat',
      messageCount: history.length,
      inputChars: message.length,
    })

    logModelSelection(selection, { preferredModel, taskType })
    console.log(`[Hermes][${requestId}] Selected model: ${selection.model} (provider: ${selection.provider})`)

    const systemPrompt = defaultAiConfig.systemPrompt ?? 'You are a helpful AI trading assistant.'

    let aiModel
    try {
      aiModel = createModelClient(selection.model as AiModelKey)
      console.log(`[Hermes][${requestId}] Model client created successfully`)
    } catch (err) {
      console.error(`[Hermes][${requestId}] Failed to create model client:`, err)

      // When GitHub model was explicitly selected, don't silently fallback — return clean error
      if (useGitHubModel) {
        return c.json({
          error: 'Connected but error — GPT-4o via GitHub Models is unavailable right now.',
          requestId,
        }, 503)
      }

      // Try fallback model for non-GitHub routes
      const fallback = getFallbackModel(selection.model as AiModelKey)
      if (fallback) {
        console.log(`[Hermes][${requestId}] Trying fallback model: ${fallback.model}`)
        markProviderUnhealthy(selection.provider)
        aiModel = createModelClient(fallback.model as AiModelKey)
      } else {
        throw err
      }
    }

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      ...history,
      { role: 'user' as const, content: message },
    ]

    console.log(`[Hermes][${requestId}] Calling streamText with ${messages.length} messages`)

    // Track streaming progress
    let chunksReceived = 0
    let totalChars = 0
    let lastChunkTime = Date.now()

    // Stream response using Vercel AI SDK
    const result = streamText({
      model: aiModel,
      messages,
      temperature: 0.4,
      maxOutputTokens: 4096,
      abortSignal: AbortSignal.timeout(STREAM_TIMEOUT_MS),
      onChunk: ({ chunk }) => {
        chunksReceived++
        const now = Date.now()
        const timeSinceLastChunk = now - lastChunkTime
        lastChunkTime = now

        if (chunksReceived % 10 === 0 || timeSinceLastChunk > 5000) {
          console.log(`[Hermes][${requestId}] Chunk #${chunksReceived}, gap: ${timeSinceLastChunk}ms`)
        }

        if (chunk.type === 'text-delta' && chunk.text) {
          totalChars += chunk.text.length
        }
      },
      onFinish: async ({ text, finishReason, usage }) => {
        const duration = Date.now() - startTime
        console.log(`[Hermes][${requestId}] Stream finished (${duration}ms, ${text.length} chars)`)

        // Store assistant message
        try {
          await conversationStore.addMessage(conversation!.id, {
            conversationId: conversation!.id,
            role: 'assistant',
            content: text,
            model: selection.model,
          })
        } catch (saveErr) {
          console.error(`[Hermes][${requestId}] Failed to save message:`, saveErr)
        }
      },
    })

    c.header('X-Conversation-Id', conversation.id)

    return result.toUIMessageStreamResponse({
      headers: {
        'X-Conversation-Id': conversation.id,
        'X-Request-Id': requestId,
      },
    })
  } catch (error) {
    const duration = Date.now() - startTime
    console.error(`[Hermes][${requestId}] Fatal error after ${duration}ms:`, error)
    cognition.step('error', 'Fatal error', error instanceof Error ? error.message : String(error))
    cognition.done()

    // Clean error messages — no raw fallback info
    let errorMessage = 'Connected but error — try again in a moment.'
    if (error instanceof Error) {
      if (error.name === 'AbortError' || error.message.includes('timeout')) {
        errorMessage = 'Request timed out. Please try again.'
      } else if (error.message.includes('API key') || error.message.includes('authentication')) {
        errorMessage = 'Connected but error — check model configuration.'
      } else if (error.message.includes('rate limit')) {
        errorMessage = 'Rate limit exceeded. Please wait a moment.'
      } else if (error.message.includes('GitHub Models')) {
        errorMessage = 'Connected but error — GPT-4o is temporarily unavailable.'
      }
    }

    return c.json({
      error: errorMessage,
      requestId,
      duration: `${duration}ms`,
    }, 500)
  }
}

/**
 * POST /api/ai/chat/stream (legacy SSE endpoint)
 */
export async function handleChatStream(c: Context) {
  // Redirect to main handler - it's now streaming
  return handleChat(c)
}
