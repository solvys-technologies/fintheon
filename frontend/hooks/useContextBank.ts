// [claude-code 2026-03-11] Hook for Unified Context Bank polling
import { useState, useEffect, useCallback, useRef } from 'react'
import baseBackend from '../lib/backend'
import type { ContextBankSnapshot, DeskReportSummary } from '../types/context-bank'

const POLL_INTERVAL_MS = 30_000 // Poll every 30s (snapshot updates every 120s)

export function useContextBank() {
  const [snapshot, setSnapshot] = useState<ContextBankSnapshot | null>(null)
  const [deskReports, setDeskReports] = useState<DeskReportSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const lastVersionRef = useRef<number>(0)

  const fetchSnapshot = useCallback(async () => {
    try {
      const data = await baseBackend.contextBank.getSnapshot()
      if (data.version !== lastVersionRef.current) {
        setSnapshot(data)
        lastVersionRef.current = data.version
        setDeskReports(data.deskReports ?? [])
      }
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch context bank')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSnapshot()
    const interval = setInterval(fetchSnapshot, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [fetchSnapshot])

  return { snapshot, deskReports, loading, error, refresh: fetchSnapshot }
}
