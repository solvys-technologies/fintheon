// [claude-code 2026-03-22] Source of Truth fusion — lockout protocol with escalation

/**
 * Lockout Protocol
 *
 * Loss streak escalation:
 * - 1st occurrence (3+ consecutive losses): SOFT lockout
 *   Popup modal with debrief questions. Acknowledgeable.
 * - 2nd occurrence (same session): HARD lockout
 *   Popup modal requiring debrief answers. Blocks new trade proposals.
 *
 * Both are popup modals, NOT briefing window notifications.
 */

export type LockoutLevel = 'none' | 'soft' | 'hard'

export interface LockoutState {
  level: LockoutLevel
  reason: string
  triggeredAt: string
  commandmentRefs: number[]
  requiresDebrief: boolean
  debriefQuestions: string[]
  debriefAnswers?: Record<string, string>
}

export interface LockoutSessionState {
  /** Number of lockouts triggered this session */
  lockoutCount: number
  /** Current active lockout (if any) */
  activeLockout: LockoutState | null
  /** Previous lockout debriefs this session */
  completedDebriefs: LockoutState[]
}

const DEBRIEF_QUESTIONS = [
  'What was your thesis for the last trade?',
  'Which commandment was broken?',
  'What would you do differently?',
]

/**
 * Evaluate whether a lockout should be triggered
 */
export function evaluateLockout(context: {
  consecutiveLosses: number
  previousLockoutsToday: number
  currentPnL: number
  accountResetsToday: number
}): LockoutState | null {
  // No lockout needed if losses are manageable
  if (context.consecutiveLosses < 3 && context.accountResetsToday < 3) {
    return null
  }

  // Determine lockout level based on escalation
  const isSecondOccurrence = context.previousLockoutsToday >= 1
  const level: LockoutLevel = isSecondOccurrence ? 'hard' : 'soft'

  const reason = context.accountResetsToday >= 3
    ? `${context.accountResetsToday} account resets this session. Trading under this pressure violates the Source of Truth.`
    : `${context.consecutiveLosses} consecutive losses. ${
        isSecondOccurrence
          ? 'Second lockout this session — full debrief required.'
          : 'First lockout — acknowledge and reflect before continuing.'
      }`

  return {
    level,
    reason,
    triggeredAt: new Date().toISOString(),
    commandmentRefs: [1, 6, 13], // always another trade, anti-revenge, bookend
    requiresDebrief: true,
    debriefQuestions: DEBRIEF_QUESTIONS,
  }
}

/**
 * Check if a lockout blocks new trade proposals
 */
export function isTradeBlocked(session: LockoutSessionState): boolean {
  if (!session.activeLockout) return false

  // Soft lockout: blocks until acknowledged (debrief submitted or dismissed)
  // Hard lockout: blocks until debrief is fully answered
  if (session.activeLockout.level === 'hard') {
    return !session.activeLockout.debriefAnswers
  }

  // Soft lockout is always blocking until dismissed
  return true
}

/**
 * Dismiss a lockout (soft only — hard requires debrief)
 */
export function dismissLockout(session: LockoutSessionState): LockoutSessionState {
  if (!session.activeLockout) return session

  if (session.activeLockout.level === 'hard') {
    // Hard lockout cannot be dismissed without debrief
    return session
  }

  return {
    ...session,
    completedDebriefs: [...session.completedDebriefs, session.activeLockout],
    activeLockout: null,
  }
}

/**
 * Submit debrief answers (works for both soft and hard)
 */
export function submitDebrief(
  session: LockoutSessionState,
  answers: Record<string, string>
): LockoutSessionState {
  if (!session.activeLockout) return session

  const completedLockout: LockoutState = {
    ...session.activeLockout,
    debriefAnswers: answers,
  }

  return {
    ...session,
    completedDebriefs: [...session.completedDebriefs, completedLockout],
    activeLockout: null,
  }
}

/**
 * Create initial session state
 */
export function createLockoutSession(): LockoutSessionState {
  return {
    lockoutCount: 0,
    activeLockout: null,
    completedDebriefs: [],
  }
}
