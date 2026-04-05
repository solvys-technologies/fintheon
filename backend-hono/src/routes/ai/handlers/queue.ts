// [claude-code 2026-03-10] Queue management endpoints + cognition SSE stream
import type { Context } from 'hono'
import { streamSSE } from 'hono/streaming'
import {
  enqueue,
  cancelJob,
  getQueueStatus,
  getJob,
} from '../../../services/chat-queue.js'
import { onStep, onEnd } from '../../../services/cognition-emitter.js'

/**
 * POST /api/ai/queue/enqueue
 * Body: { conversationId, message, agentOverride?, thinkHarder? }
 * Returns: { jobId, position, status } or 429 if queue full
 */
export async function handleQueueEnqueue(c: Context) {
  const userId = c.get('userId') as string | undefined
  if (!userId) return c.json({ error: 'Unauthorized' }, 401)

  const body = await c.req.json<{
    conversationId: string
    message: string
    agentOverride?: string
    thinkHarder?: boolean
  }>().catch(() => null)

  if (!body?.conversationId || !body?.message?.trim()) {
    return c.json({ error: 'conversationId and message are required' }, 400)
  }

  const result = enqueue({
    conversationId: body.conversationId,
    userId,
    message: body.message.trim(),
    agentOverride: body.agentOverride,
    thinkHarder: body.thinkHarder,
  })

  if ('error' in result) {
    return c.json(
      { error: 'Queue full — max 2 messages in flight per conversation', depth: result.depth },
      429
    )
  }

  return c.json({
    jobId: result.job.jobId,
    position: result.job.position,
    status: result.job.status,
    conversationId: body.conversationId,
  }, 202)
}

/**
 * GET /api/ai/queue/status/:conversationId
 * Returns queue depth, active job, pending job.
 */
export async function handleQueueStatus(c: Context) {
  const userId = c.get('userId') as string | undefined
  if (!userId) return c.json({ error: 'Unauthorized' }, 401)

  const conversationId = c.req.param('conversationId')
  return c.json(getQueueStatus(conversationId))
}

/**
 * DELETE /api/ai/queue/:jobId
 * Cancel a pending or active job.
 */
export async function handleQueueCancel(c: Context) {
  const userId = c.get('userId') as string | undefined
  if (!userId) return c.json({ error: 'Unauthorized' }, 401)

  const jobId = c.req.param('jobId')
  const job = getJob(jobId)

  if (!job) return c.json({ error: 'Job not found' }, 404)
  if (job.userId !== userId) return c.json({ error: 'Forbidden' }, 403)

  const cancelled = cancelJob(job.conversationId, jobId)
  return c.json({ cancelled, jobId })
}

/**
 * GET /api/ai/cognition/stream?requestId=xxx
 * SSE stream of agent cognition steps for a given request.
 * Frontend connects before/as the chat request is initiated.
 */
export async function handleCognitionStream(c: Context) {
  const requestId = c.req.query('requestId')
  if (!requestId) return c.json({ error: 'requestId query param required' }, 400)

  return streamSSE(c, async (stream) => {
    // Send initial connection ack
    await stream.writeSSE({
      event: 'connected',
      data: JSON.stringify({ requestId }),
    })

    // Use a Promise that resolves when the stream is done, no polling
    await new Promise<void>((resolve) => {
      const cleanup = () => {
        clearTimeout(timeout)
        offStep()
        offEnd()
        resolve()
      }

      const offStep = onStep(requestId, async (step) => {
        await stream.writeSSE({
          event: 'step',
          data: JSON.stringify(step),
        })
      })

      const offEnd = onEnd(requestId, async (ev) => {
        await stream.writeSSE({
          event: 'done',
          data: JSON.stringify(ev),
        })
        cleanup()
      })

      // 90s safety timeout
      const timeout = setTimeout(() => {
        stream.writeSSE({
          event: 'done',
          data: JSON.stringify({ requestId, totalMs: 90_000 }),
        }).finally(cleanup)
      }, 90_000)
    })
  })
}
