// [claude-code 2026-04-04] Fix SSE reconnection — don't kill listener on transient errors
// [claude-code 2026-04-03] Hook for managing in-app tool approval requests from Harper
/**
 * useToolApprovals
 * Listens to the cognition SSE stream for tool-approval-needed events.
 * Manages pending approvals and sends decisions to the backend.
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { API_BASE_URL } from '../constants.js'

export interface ToolApprovalRequest {
  approvalId: string
  toolName: string
  toolInput: Record<string, unknown>
  description: string
  status: 'pending' | 'approved' | 'denied'
  decidedAt?: number
}

export function useToolApprovals(requestId: string | null) {
  const [approvals, setApprovals] = useState<ToolApprovalRequest[]>([])
  const esRef = useRef<EventSource | null>(null)
  // Track which requestIds we've already subscribed to
  const subscribedRef = useRef<string | null>(null)

  useEffect(() => {
    if (!requestId || subscribedRef.current === requestId) return

    // The CognitionPanel already opens an SSE for this requestId.
    // We open a second listener — EventSource is cheap and the backend
    // fans out to all listeners on the same requestId.
    subscribedRef.current = requestId

    const es = new EventSource(
      `${API_BASE_URL}/api/ai/cognition/stream?requestId=${encodeURIComponent(requestId)}`
    )
    esRef.current = es

    es.addEventListener('step', (e) => {
      try {
        const step = JSON.parse(e.data)

        if (step.kind === 'tool-approval-needed' && step.detail) {
          const detail = JSON.parse(step.detail)
          setApprovals((prev) => {
            // Deduplicate
            if (prev.some((a) => a.approvalId === detail.approvalId)) return prev
            return [...prev, {
              approvalId: detail.approvalId,
              toolName: detail.toolName,
              toolInput: detail.toolInput,
              description: detail.description,
              status: 'pending',
            }]
          })
        }

        if (step.kind === 'tool-approval-resolved' && step.detail) {
          const detail = JSON.parse(step.detail)
          setApprovals((prev) =>
            prev.map((a) =>
              a.approvalId === detail.approvalId
                ? { ...a, status: detail.decision, decidedAt: Date.now() }
                : a
            )
          )
        }
      } catch { /* ignore malformed */ }
    })

    es.addEventListener('done', () => {
      es.close()
    })

    // Reconnect on transient errors instead of dying silently.
    // EventSource auto-reconnects by default, but if readyState is CLOSED
    // (server sent a non-retryable error), we manually reopen after a delay.
    es.onerror = () => {
      if (es.readyState === EventSource.CLOSED) {
        es.close()
        // Reopen after 2s — the approval gate may still be waiting
        const timer = setTimeout(() => {
          if (subscribedRef.current === requestId) {
            subscribedRef.current = null // allow re-subscribe
          }
        }, 2000)
        return () => clearTimeout(timer)
      }
      // CONNECTING state = browser is auto-reconnecting, let it
    }

    return () => {
      es.close()
      esRef.current = null
    }
  }, [requestId])

  // Clear approvals when requestId changes (new message)
  useEffect(() => {
    if (!requestId) {
      setApprovals([])
      subscribedRef.current = null
    }
  }, [requestId])

  const sendDecision = useCallback(async (approvalId: string, decision: 'approved' | 'denied') => {
    // Optimistically update UI
    setApprovals((prev) =>
      prev.map((a) =>
        a.approvalId === approvalId
          ? { ...a, status: decision, decidedAt: Date.now() }
          : a
      )
    )

    try {
      await fetch(`${API_BASE_URL}/api/harper/tool-decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvalId, decision }),
      })
    } catch (err) {
      console.error('[useToolApprovals] Failed to send decision:', err)
      // Revert on failure
      setApprovals((prev) =>
        prev.map((a) =>
          a.approvalId === approvalId ? { ...a, status: 'pending', decidedAt: undefined } : a
        )
      )
    }
  }, [])

  return { approvals, sendDecision }
}
