// [claude-code 2026-03-11] Track 3: Autopilot Dashboard shell — polls status/signals/proposals, grid layout
import { useState, useEffect, useCallback } from 'react'
import { Activity } from 'lucide-react'
import { AutopilotControls } from './AutopilotControls'
import { SignalFeed } from './SignalFeed'
import { SessionStatusBar } from './SessionStatusBar'
import { ProposalModal, type TradingProposal } from './ProposalModal'

const API_BASE = 'http://localhost:8080'

// Types matching backend response shapes
export interface AutopilotStatus {
  enabled: boolean
  isRTH: boolean
  activeSession: string | null
  signalsToday: number
  tradesToday: number
  maxTradesPerDay: number
  dailyPnL: number
  dailyDrawdownLimit: number
  confidenceThreshold: number
}

export interface SignalEvent {
  source: 'quantconnect' | 'tradingview' | 'manual'
  strategy: string
  direction: 'long' | 'short'
  instrument: string
  confidence: number
  entryPrice: number
  stopLoss: number
  takeProfit: number[]
  signals: string[]
  htfContext?: string
  volumeDelta?: number
  rsiValue?: number
  timestamp: string
  sessionWindow?: string
  processedAt?: string
  result?: string
  proposalId?: string
}

export interface StoredProposal {
  id: string
  strategyName: string
  instrument: string
  direction: 'long' | 'short' | 'flat'
  entryPrice?: number
  stopLoss?: number
  takeProfit?: number[]
  positionSize: number
  riskRewardRatio: number
  confidenceScore: number
  rationale: string
  status: string
  expiresAt: string
  createdAt: string
}

async function fetchJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}${path}`)
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

async function postJson<T>(path: string, body: Record<string, unknown>): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

export function AutopilotDashboard() {
  const [status, setStatus] = useState<AutopilotStatus | null>(null)
  const [signals, setSignals] = useState<SignalEvent[]>([])
  const [proposals, setProposals] = useState<StoredProposal[]>([])
  const [selectedProposal, setSelectedProposal] = useState<StoredProposal | null>(null)

  // Poll status every 5s
  useEffect(() => {
    const poll = async () => {
      const data = await fetchJson<AutopilotStatus>('/api/autopilot/status')
      if (data) setStatus(data)
    }
    poll()
    const id = setInterval(poll, 5000)
    return () => clearInterval(id)
  }, [])

  // Poll signals every 10s
  useEffect(() => {
    const poll = async () => {
      const data = await fetchJson<{ signals: SignalEvent[]; total: number }>('/api/autopilot/signals?limit=50')
      if (data?.signals) setSignals(data.signals)
    }
    poll()
    const id = setInterval(poll, 10000)
    return () => clearInterval(id)
  }, [])

  // Poll proposals every 5s
  useEffect(() => {
    const poll = async () => {
      const data = await fetchJson<{ proposals: StoredProposal[]; total: number }>('/api/autopilot/proposals')
      if (data?.proposals) setProposals(data.proposals)
    }
    poll()
    const id = setInterval(poll, 5000)
    return () => clearInterval(id)
  }, [])

  const handleToggle = useCallback(async (enabled: boolean) => {
    // Optimistic update
    setStatus(prev => prev ? { ...prev, enabled } : null)
    // The toggle endpoint would be POST /api/autopilot/toggle or similar
    // For v1, the controls display only — toggle is informational
  }, [])

  const handleProposalClick = useCallback((proposal: StoredProposal) => {
    setSelectedProposal(proposal)
  }, [])

  const handleApprove = useCallback(async (proposal: TradingProposal) => {
    await postJson('/api/autopilot/acknowledge', {
      proposalId: proposal.id,
      decision: 'approved',
    })
    // Remove from local list
    setProposals(prev => prev.filter(p => p.id !== proposal.id))
    setSelectedProposal(null)
  }, [])

  const handleReject = useCallback(async (proposal: TradingProposal) => {
    await postJson('/api/autopilot/acknowledge', {
      proposalId: proposal.id,
      decision: 'rejected',
    })
    setProposals(prev => prev.filter(p => p.id !== proposal.id))
    setSelectedProposal(null)
  }, [])

  // Convert StoredProposal to TradingProposal for the modal
  const modalProposal: TradingProposal | null = selectedProposal
    ? {
        id: selectedProposal.id,
        tradeRecommended: selectedProposal.direction !== 'flat',
        strategyName: selectedProposal.strategyName,
        instrument: selectedProposal.instrument,
        direction: selectedProposal.direction,
        entryPrice: selectedProposal.entryPrice,
        stopLoss: selectedProposal.stopLoss,
        takeProfit: selectedProposal.takeProfit,
        positionSize: selectedProposal.positionSize,
        riskRewardRatio: selectedProposal.riskRewardRatio,
        confidence: selectedProposal.confidenceScore,
        rationale: selectedProposal.rationale,
        analystInputs: {
          marketData: '--',
          sentiment: '--',
          technical: '--',
          researchConsensus: '--',
        },
        timeframe: 'Intraday',
        setupType: selectedProposal.strategyName,
        createdAt: selectedProposal.createdAt,
      }
    : null

  return (
    <div className="flex flex-col h-full font-mono">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[#c79f4a20]">
        <Activity className="w-5 h-5 text-[#c79f4a]" />
        <h1 className="text-lg font-bold text-[#c79f4a]">Autopilot</h1>
      </div>

      {/* Session Status Bar */}
      <SessionStatusBar status={status} />

      {/* Grid: Controls (1/3) | Signal Feed (2/3) */}
      <div className="flex-1 grid grid-cols-3 gap-0 min-h-0 overflow-hidden">
        <div className="col-span-1 border-r border-[#c79f4a20] overflow-y-auto p-3">
          <AutopilotControls status={status} onToggle={handleToggle} />
        </div>
        <div className="col-span-2 overflow-y-auto p-3">
          <SignalFeed
            signals={signals}
            proposals={proposals}
            onProposalClick={handleProposalClick}
          />
        </div>
      </div>

      {/* Proposal Modal */}
      {modalProposal && (
        <ProposalModal
          proposal={modalProposal}
          onClose={() => setSelectedProposal(null)}
          onApprove={handleApprove}
          onReject={handleReject}
        />
      )}
    </div>
  )
}
