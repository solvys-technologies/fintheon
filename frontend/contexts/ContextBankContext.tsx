// [claude-code 2026-03-11] Context Bank React context — shares polling across components
import React, { createContext, useContext } from 'react'
import { useContextBank } from '../hooks/useContextBank'
import type { ContextBankSnapshot, DeskReportSummary, VixRegime } from '../types/context-bank'

interface ContextBankContextValue {
  snapshot: ContextBankSnapshot | null
  deskReports: DeskReportSummary[]
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  // Convenience derivations
  vixRegime: VixRegime
  ivScore: number
  systemicScore: number
  snapshotVersion: number
}

const ContextBankContext = createContext<ContextBankContextValue>({
  snapshot: null,
  deskReports: [],
  loading: true,
  error: null,
  refresh: async () => {},
  vixRegime: 'normal',
  ivScore: 0,
  systemicScore: 0,
  snapshotVersion: 0,
})

export function ContextBankProvider({ children }: { children: React.ReactNode }) {
  const { snapshot, deskReports, loading, error, refresh } = useContextBank()

  const vixRegime = snapshot?.vix?.regime ?? 'normal'
  const ivScore = snapshot?.ivScores?.['/ES']?.score ?? 0
  const systemicScore = snapshot?.systemic?.score ?? 0
  const snapshotVersion = snapshot?.version ?? 0

  return (
    <ContextBankContext.Provider
      value={{
        snapshot,
        deskReports,
        loading,
        error,
        refresh,
        vixRegime,
        ivScore,
        systemicScore,
        snapshotVersion,
      }}
    >
      {children}
    </ContextBankContext.Provider>
  )
}

export function useContextBankContext() {
  return useContext(ContextBankContext)
}
