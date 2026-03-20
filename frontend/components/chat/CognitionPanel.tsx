// [claude-code 2026-03-10] Agent cognition visualization — real-time step-by-step process panel
// Connects to /api/ai/cognition/stream SSE and renders agent pipeline steps as they arrive.
// Solvys Gold palette: BG #050402, Accent #c79f4a, Text #f0ead6. No gradients, no colored emojis.

import { useEffect, useRef, useState } from 'react'
import { API_BASE_URL } from './constants.js'

export type CognitionStepKind =
  | 'agent-route'
  | 'context-build'
  | 'skill-check'
  | 'tool-dispatch'
  | 'gateway-call'
  | 'gateway-fallback'
  | 'response-ready'
  | 'error'

export interface CognitionStep {
  kind: CognitionStepKind
  label: string
  detail?: string
  durationMs?: number
  ts: number
}

interface Props {
  requestId: string | null
  isStreaming: boolean
}

// Icon per step kind — text-based, no colored emojis
function StepIcon({ kind }: { kind: CognitionStepKind }) {
  const glyphs: Record<CognitionStepKind, string> = {
    'agent-route':      '→',
    'context-build':    '≡',
    'skill-check':      '✓',
    'tool-dispatch':    '⊙',
    'gateway-call':     '⇌',
    'gateway-fallback': '↩',
    'response-ready':   '◆',
    'error':            '✕',
  }
  return (
    <span className="text-[var(--fintheon-accent)] font-mono text-[10px] w-3 shrink-0 select-none">
      {glyphs[kind] ?? '·'}
    </span>
  )
}

function StepRow({ step, idx }: { step: CognitionStep; idx: number }) {
  return (
    <div
      className="flex items-start gap-2 py-0.5 animate-[fadeSlideIn_0.2s_ease-out_forwards]"
      style={{ animationDelay: `${idx * 30}ms`, opacity: 0 }}
    >
      <StepIcon kind={step.kind} />
      <div className="min-w-0 flex-1">
        <span className="text-[11px] text-[var(--fintheon-text)]/80 leading-tight">{step.label}</span>
        {step.detail && (
          <span className="text-[10px] text-[var(--fintheon-text)]/40 ml-1.5">{step.detail}</span>
        )}
      </div>
      {step.durationMs !== undefined && (
        <span className="text-[9px] text-[var(--fintheon-text)]/25 tabular-nums shrink-0">
          {step.durationMs}ms
        </span>
      )}
    </div>
  )
}

/**
 * Hook: opens SSE connection to cognition stream for a given requestId.
 * Collects steps until `done` event or requestId changes.
 */
export function useCognitionStream(requestId: string | null) {
  const [steps, setSteps] = useState<CognitionStep[]>([])
  const [done, setDone] = useState(false)
  const esRef = useRef<EventSource | null>(null)

  useEffect(() => {
    if (!requestId) {
      setSteps([])
      setDone(false)
      return
    }

    // Close previous connection
    esRef.current?.close()
    setSteps([])
    setDone(false)

    const es = new EventSource(
      `${API_BASE_URL}/api/ai/cognition/stream?requestId=${encodeURIComponent(requestId)}`
    )
    esRef.current = es

    es.addEventListener('step', (e) => {
      try {
        const step = JSON.parse(e.data) as CognitionStep
        setSteps((s) => [...s, step])
      } catch { /* ignore malformed */ }
    })

    es.addEventListener('done', () => {
      setDone(true)
      es.close()
    })

    es.onerror = () => {
      es.close()
    }

    return () => {
      es.close()
      esRef.current = null
    }
  }, [requestId])

  return { steps, done }
}

/**
 * CognitionPanel — collapsible panel showing live agent cognition steps.
 * Renders below the thinking indicator during processing, stays visible after.
 */
export function CognitionPanel({ requestId, isStreaming }: Props) {
  const { steps, done } = useCognitionStream(requestId)
  const [collapsed, setCollapsed] = useState(false)

  // Auto-collapse when done + no errors
  useEffect(() => {
    if (done && steps.length > 0 && !steps.some((s) => s.kind === 'error')) {
      const t = setTimeout(() => setCollapsed(true), 4_000)
      return () => clearTimeout(t)
    }
  }, [done, steps])

  // Re-expand on new request
  useEffect(() => {
    if (requestId) setCollapsed(false)
  }, [requestId])

  if (!requestId || steps.length === 0) return null

  const hasError = steps.some((s) => s.kind === 'error')

  return (
    <div
      className="rounded-xl border bg-[var(--fintheon-bg)]/90 overflow-hidden transition-all"
      style={{ borderColor: hasError ? 'rgba(239,68,68,0.25)' : 'rgba(199,159,74,0.15)' }}
    >
      {/* Header */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-white/3 transition-colors"
      >
        <div className="flex items-center gap-2">
          {/* Pulse dot while streaming, static when done */}
          {isStreaming && !done ? (
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--fintheon-accent)] animate-pulse" />
          ) : (
            <span
              className="inline-block w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: hasError ? '#ef4444' : 'var(--fintheon-accent)', opacity: 0.6 }}
            />
          )}
          <span className="text-[10px] font-medium tracking-wider uppercase text-[var(--fintheon-accent)]/70">
            Agent Mind
          </span>
          <span className="text-[9px] text-[var(--fintheon-text)]/25">
            {steps.length} step{steps.length !== 1 ? 's' : ''}
          </span>
        </div>
        <span className="text-[var(--fintheon-text)]/25 text-[10px] transition-transform" style={{ display: 'inline-block', transform: collapsed ? 'rotate(-90deg)' : 'rotate(0)' }}>
          ▾
        </span>
      </button>

      {/* Steps */}
      {!collapsed && (
        <div className="px-3 pb-2.5 space-y-0.5">
          {steps.map((step, idx) => (
            <StepRow key={`${step.ts}-${idx}`} step={step} idx={idx} />
          ))}

          {/* Live indicator while streaming and not yet done */}
          {isStreaming && !done && (
            <div className="flex items-center gap-2 pt-0.5">
              <span className="text-[var(--fintheon-accent)] font-mono text-[10px] w-3">·</span>
              <span className="text-[10px] text-[var(--fintheon-text)]/30 animate-pulse">processing…</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
