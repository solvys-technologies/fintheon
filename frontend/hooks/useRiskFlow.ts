import { useEffect, useRef } from 'react'
import type { RiskFlowItem } from '../types/api'

/**
 * useRiskFlow Hook
 * Connects to RiskFlow SSE stream for real-time Level 4 news alerts
 * Simplified for local single-user mode - no authentication
 */
export function useRiskFlow(onItem: (item: RiskFlowItem) => void) {
  const sourceRef = useRef<EventSource | null>(null)

  useEffect(() => {
    let mounted = true

    const connectSSE = async () => {
      try {
        if (!mounted) return

        const baseUrl = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')
        const streamUrl = `${baseUrl}/api/riskflow/stream`

        const source = new EventSource(streamUrl)
        sourceRef.current = source

        source.onopen = () => {
          console.log('[RiskFlow] SSE connection opened')
        }

        source.onmessage = (event) => {
          try {
            // Skip heartbeat messages
            if (event.data.trim() === '' || event.data.startsWith(':')) {
              return
            }
            const item = JSON.parse(event.data) as RiskFlowItem
            onItem(item)
          } catch (error) {
            console.warn('[RiskFlow] Failed to parse SSE payload', error)
          }
        }

        source.onerror = (event) => {
          console.warn('[RiskFlow] SSE error, letting browser retry', event)
          if (source.readyState === EventSource.CLOSED) {
            console.warn('[RiskFlow] SSE connection closed, will retry automatically')
          }
        }
      } catch (error) {
        console.error('[RiskFlow] Failed to establish SSE connection', error)
      }
    }

    connectSSE()

    return () => {
      mounted = false
      if (sourceRef.current) {
        sourceRef.current.close()
        sourceRef.current = null
      }
    }
  }, [onItem])
}

// Backward compatibility alias
export const useBreakingNews = useRiskFlow
