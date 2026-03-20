// [claude-code 2026-03-11] Track 3: Signal feed — scrollable signal list + pending proposals with countdown
import { useState, useEffect } from 'react'
import { Radio, Clock, ArrowUp, ArrowDown } from 'lucide-react'
import type { SignalEvent, StoredProposal } from './AutopilotDashboard'

interface SignalFeedProps {
  signals: SignalEvent[]
  proposals: StoredProposal[]
  onProposalClick?: (proposal: StoredProposal) => void
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
  } catch {
    return '--:--:--'
  }
}

function Countdown({ expiresAt }: { expiresAt: string }) {
  const [remaining, setRemaining] = useState('')

  useEffect(() => {
    const update = () => {
      const diff = new Date(expiresAt).getTime() - Date.now()
      if (diff <= 0) {
        setRemaining('EXPIRED')
        return
      }
      const mins = Math.floor(diff / 60000)
      const secs = Math.floor((diff % 60000) / 1000)
      setRemaining(`${mins}:${secs.toString().padStart(2, '0')}`)
    }
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [expiresAt])

  const isExpired = remaining === 'EXPIRED'
  return (
    <span className={`text-[10px] font-mono ${isExpired ? 'text-red-400' : 'text-[#c79f4a]'}`}>
      {remaining}
    </span>
  )
}

function SignalPill({ label }: { label: string }) {
  // Normalize label for display
  const display = label
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
    .substring(0, 18)

  return (
    <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#c79f4a10] text-[#f0ead680] border border-[#c79f4a15]">
      {display}
    </span>
  )
}

function ResultBadge({ result }: { result?: string }) {
  if (!result) return null

  const upper = result.toUpperCase()
  if (upper === 'AUTO' || upper === 'EXECUTED') {
    return (
      <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#c79f4a20] text-[#c79f4a] border border-[#c79f4a30] font-bold">
        AUTO
      </span>
    )
  }
  if (upper === 'PENDING') {
    return (
      <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#f0ead610] text-[#f0ead680] border border-[#f0ead620]">
        PENDING
      </span>
    )
  }
  if (upper === 'REJECTED' || upper === 'DENIED') {
    return (
      <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">
        REJECTED
      </span>
    )
  }
  return (
    <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#f0ead610] text-[#f0ead680]">
      {upper}
    </span>
  )
}

export function SignalFeed({ signals, proposals, onProposalClick }: SignalFeedProps) {
  const pendingProposals = proposals.filter(p => p.status === 'pending' || p.status === 'pending_approval')
  const hasContent = signals.length > 0 || pendingProposals.length > 0

  return (
    <div className="space-y-2">
      {/* Section Header */}
      <div className="flex items-center gap-2 mb-2">
        <Radio className="w-4 h-4 text-[#c79f4a]" />
        <span className="text-xs font-medium text-[#f0ead6] uppercase tracking-wider">Signal Feed</span>
        {signals.length > 0 && (
          <span className="text-[10px] text-[#f0ead680] ml-auto">{signals.length} signals</span>
        )}
      </div>

      {/* Pending Proposals */}
      {pendingProposals.map((proposal) => (
        <button
          key={proposal.id}
          onClick={() => onProposalClick?.(proposal)}
          className="w-full text-left bg-[#0a0906] border border-[#c79f4a40] rounded-lg p-3 hover:border-[#c79f4a60] transition-colors"
        >
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#c79f4a20] text-[#c79f4a] border border-[#c79f4a30] font-bold animate-pulse">
                PENDING
              </span>
              <span className="text-xs font-bold text-[#c79f4a]">{proposal.instrument}</span>
              {proposal.direction === 'long' ? (
                <ArrowUp className="w-3 h-3 text-green-400" />
              ) : proposal.direction === 'short' ? (
                <ArrowDown className="w-3 h-3 text-red-400" />
              ) : null}
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="w-3 h-3 text-[#f0ead680]" />
              <Countdown expiresAt={proposal.expiresAt} />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-[#f0ead680]">{proposal.strategyName.replace(/_/g, ' ')}</span>
            <span className={`text-xs font-bold font-mono ${proposal.confidenceScore >= 80 ? 'text-[#c79f4a]' : 'text-[#f0ead680]'}`}>
              {proposal.confidenceScore}%
            </span>
          </div>
          {proposal.rationale && (
            <div className="mt-1.5 text-[10px] text-[#f0ead650] truncate">{proposal.rationale}</div>
          )}
        </button>
      ))}

      {/* Signal Rows */}
      {signals.map((signal, idx) => {
        const isLong = signal.direction === 'long'
        return (
          <div
            key={`${signal.timestamp}-${idx}`}
            className="bg-[#0a0906] border border-[#c79f4a20] rounded-lg p-3"
          >
            {/* Top Row */}
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[10px] text-[#f0ead680] font-mono w-16 shrink-0">
                {formatTime(signal.timestamp)}
              </span>
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#c79f4a20] text-[#c79f4a] border border-[#c79f4a30]">
                {signal.strategy.replace(/_/g, ' ')}
              </span>
              <span className={isLong ? 'text-green-400 text-sm' : 'text-red-400 text-sm'}>
                {isLong ? '\u2191' : '\u2193'}
              </span>
              <span className="text-xs font-bold text-[#f0ead6]">{signal.instrument}</span>
              <span className={`text-xs font-mono ml-auto ${signal.confidence >= 80 ? 'font-bold text-[#c79f4a]' : 'text-[#f0ead680]'}`}>
                {signal.confidence}%
              </span>
              <ResultBadge result={signal.result} />
            </div>

            {/* Signal Pills */}
            {signal.signals.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {signal.signals.map((s, i) => (
                  <SignalPill key={`${s}-${i}`} label={s} />
                ))}
              </div>
            )}
          </div>
        )
      })}

      {/* Empty State */}
      {!hasContent && (
        <div className="flex flex-col items-center justify-center py-16">
          <Radio className="w-8 h-8 text-[#f0ead620] mb-3" />
          <div className="text-sm text-[#f0ead640] animate-pulse">
            Waiting for signals...
          </div>
        </div>
      )}
    </div>
  )
}
