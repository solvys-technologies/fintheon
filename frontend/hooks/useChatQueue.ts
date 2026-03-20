// [claude-code 2026-03-10] Bounded chat message queue state — max 2 in-flight per conversation
// Mirrors the backend ChatQueue service. Gives the UI awareness of queue position and depth.

import { useCallback, useRef, useState } from 'react'
import { API_BASE_URL } from '../components/chat/constants.js'

export type QueueJobStatus = 'pending' | 'processing' | 'done' | 'failed' | 'cancelled'

export interface QueueJob {
  jobId: string
  position: number   // 0 = active, 1 = waiting
  status: QueueJobStatus
  conversationId: string
}

export interface QueueState {
  jobs: QueueJob[]
  isQueueFull: boolean   // depth >= 2
  depth: number
}

type EnqueueResult = {
  jobId: string
  position: number
  status: QueueJobStatus
} | null

/**
 * useChatQueue — manages per-conversation queue state.
 *
 * Usage:
 *   const { queueState, enqueueMessage, cancelJob } = useChatQueue(conversationId)
 *
 * When queueState.isQueueFull, don't allow new sends — show position indicator instead.
 */
export function useChatQueue(conversationId: string | undefined) {
  const [queueState, setQueueState] = useState<QueueState>({
    jobs: [],
    isQueueFull: false,
    depth: 0,
  })

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  /**
   * Enqueue a message — returns the created job or null if full/error.
   */
  const enqueueMessage = useCallback(async (params: {
    message: string
    agentOverride?: string
    thinkHarder?: boolean
  }): Promise<EnqueueResult> => {
    if (!conversationId) return null

    try {
      const res = await fetch(`${API_BASE_URL}/api/ai/queue/enqueue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId, ...params }),
      })

      if (res.status === 429) {
        const data = await res.json()
        setQueueState((s) => ({ ...s, isQueueFull: true, depth: data.depth ?? 2 }))
        return null
      }

      if (!res.ok) return null

      const job = await res.json() as { jobId: string; position: number; status: QueueJobStatus }
      const newJob: QueueJob = { ...job, conversationId }

      setQueueState((s) => {
        const jobs = [...s.jobs.filter((j) => j.jobId !== job.jobId), newJob]
        return { jobs, isQueueFull: jobs.length >= 2, depth: jobs.length }
      })

      return job
    } catch {
      return null
    }
  }, [conversationId])

  /**
   * Poll queue status from backend and sync local state.
   */
  const syncQueueStatus = useCallback(async () => {
    if (!conversationId) return

    try {
      const res = await fetch(`${API_BASE_URL}/api/ai/queue/status/${conversationId}`)
      if (!res.ok) return
      const data = await res.json() as {
        depth: number
        active: { jobId: string; status: QueueJobStatus } | null
        pending: { jobId: string; status: QueueJobStatus } | null
      }

      const jobs: QueueJob[] = []
      if (data.active) jobs.push({ ...data.active, position: 0, conversationId })
      if (data.pending) jobs.push({ ...data.pending, position: 1, conversationId })

      setQueueState({ jobs, isQueueFull: data.depth >= 2, depth: data.depth })
    } catch {
      // ignore
    }
  }, [conversationId])

  /**
   * Cancel a job by ID.
   */
  const cancelJob = useCallback(async (jobId: string): Promise<boolean> => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/ai/queue/${jobId}`, { method: 'DELETE' })
      if (res.ok) {
        setQueueState((s) => ({
          ...s,
          jobs: s.jobs.filter((j) => j.jobId !== jobId),
          depth: Math.max(0, s.depth - 1),
          isQueueFull: Math.max(0, s.depth - 1) >= 2,
        }))
        return true
      }
    } catch { /* ignore */ }
    return false
  }, [])

  /**
   * Mark a job as done locally (call after chat response finishes).
   */
  const markJobDone = useCallback((jobId: string) => {
    setQueueState((s) => {
      const jobs = s.jobs
        .map((j) => j.jobId === jobId ? { ...j, status: 'done' as QueueJobStatus } : j)
        .filter((j) => j.status !== 'done')
      return { jobs, isQueueFull: jobs.length >= 2, depth: jobs.length }
    })
  }, [])

  return {
    queueState,
    enqueueMessage,
    syncQueueStatus,
    cancelJob,
    markJobDone,
  }
}
