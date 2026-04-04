// [claude-code 2026-03-10] Real-time agent cognition event emitter
// Instruments the chat pipeline and streams step-by-step agent observability
// to the frontend via SSE. Each requestId gets its own event scope.

import { EventEmitter } from 'events'

export type CognitionStepKind =
  | 'agent-route'           // Which agent was selected and why
  | 'context-build'         // Conversation history loaded, context assembled
  | 'skill-check'           // Skill permission enforcement
  | 'tool-dispatch'         // External tool call (Exa, Notion, market data)
  | 'tool-approval-needed'  // Tool requires user approval before execution
  | 'tool-approval-resolved'// User approved or denied a tool request
  | 'gateway-call'          // OpenRouter (Opus 4.6) API request
  | 'gateway-fallback'      // Gateway failed → local fallback
  | 'response-ready'        // Full response assembled, streaming begins
  | 'error'                 // Processing error

export interface CognitionStep {
  kind: CognitionStepKind
  label: string          // Short human-readable label
  detail?: string        // Optional extra context
  durationMs?: number    // Time taken for this step
  ts: number             // Unix timestamp ms
}

export interface CognitionStartEvent {
  requestId: string
  conversationId: string
}

export interface CognitionEndEvent {
  requestId: string
  totalMs: number
}

// Global emitter — all active requests share one emitter, scoped by requestId
const emitter = new EventEmitter()
emitter.setMaxListeners(100) // Up to 100 concurrent active requests

/**
 * Emit a cognition step for a given request.
 */
export function emitStep(requestId: string, step: Omit<CognitionStep, 'ts'>): void {
  const event: CognitionStep = { ...step, ts: Date.now() }
  emitter.emit(`step:${requestId}`, event)
}

/**
 * Signal that a request's cognition stream is done.
 */
export function emitEnd(requestId: string, totalMs: number): void {
  emitter.emit(`end:${requestId}`, { requestId, totalMs })
  // Clean up listeners after a short delay
  setTimeout(() => {
    emitter.removeAllListeners(`step:${requestId}`)
    emitter.removeAllListeners(`end:${requestId}`)
  }, 5_000)
}

/**
 * Subscribe to cognition steps for a request.
 * Returns an unsubscribe function.
 */
export function onStep(requestId: string, handler: (step: CognitionStep) => void): () => void {
  emitter.on(`step:${requestId}`, handler)
  return () => emitter.off(`step:${requestId}`, handler)
}

/**
 * Subscribe to cognition end for a request.
 */
export function onEnd(requestId: string, handler: (ev: CognitionEndEvent) => void): () => void {
  emitter.once(`end:${requestId}`, handler)
  return () => emitter.off(`end:${requestId}`, handler)
}

/**
 * Helper: create a scoped emitter for a single request pipeline.
 * Returns step() and done() bound to the requestId.
 */
export function createRequestCognition(requestId: string, startTime: number) {
  let lastStep = startTime

  return {
    step(kind: CognitionStepKind, label: string, detail?: string) {
      const now = Date.now()
      emitStep(requestId, { kind, label, detail, durationMs: now - lastStep })
      lastStep = now
    },
    done() {
      emitEnd(requestId, Date.now() - startTime)
    },
  }
}
