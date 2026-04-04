// [claude-code 2026-04-04] Harper Heartbeat Scheduler — cron-based autonomous check-ins

import cron from 'node-cron'
import { enqueueTask } from './loop-manager.js'
import { createLogger } from '../../lib/logger.js'

const log = createLogger('HarperHeartbeat')

let marketHoursJob: cron.ScheduledTask | null = null
let offHoursJob: cron.ScheduledTask | null = null
let heartbeatCount = 0

const TIMEZONE = 'America/New_York'

/**
 * Start the heartbeat scheduler.
 * - Every 5 minutes during market hours (6AM-7PM ET, weekdays)
 * - Every 15 minutes outside market hours
 */
export function startHeartbeat(): void {
  if (marketHoursJob) {
    log.warn('Heartbeat already running')
    return
  }

  // Market hours: every 5 min, 6AM-7PM ET, Mon-Fri
  marketHoursJob = cron.schedule('*/5 6-18 * * 1-5', () => {
    heartbeatCount++
    const task = getHeartbeatTask(heartbeatCount)
    enqueueTask(task)
  }, { timezone: TIMEZONE })

  // Off hours: every 15 min (all other times)
  offHoursJob = cron.schedule('*/15 19-23,0-5 * * 1-5', () => {
    heartbeatCount++
    enqueueTask({
      type: 'heartbeat',
      payload: { heartbeatNumber: heartbeatCount, offHours: true },
      priority: 'low',
    })
  }, { timezone: TIMEZONE })

  // Weekend: every 30 min
  cron.schedule('*/30 * * * 0,6', () => {
    heartbeatCount++
    enqueueTask({
      type: 'heartbeat',
      payload: { heartbeatNumber: heartbeatCount, weekend: true },
      priority: 'low',
    })
  }, { timezone: TIMEZONE })

  log.info('Heartbeat scheduler started (5min market hours, 15min off-hours, 30min weekends)')
}

/**
 * Determine the heartbeat task type based on count.
 * Every 3rd heartbeat (15 min): also run narrative synthesis
 * Every 6th heartbeat (30 min): also run scoring QA
 */
function getHeartbeatTask(count: number): {
  type: 'heartbeat' | 'scoring-qa' | 'narrative-synthesis'
  payload: Record<string, unknown>
  priority: 'low' | 'normal' | 'high' | 'critical'
} {
  if (count % 6 === 0) {
    // Every 30 min: scoring QA (also includes heartbeat in the prompt)
    return {
      type: 'heartbeat',
      payload: { heartbeatNumber: count, includesScoringQA: true, includesNarrativeSynthesis: true },
      priority: 'normal',
    }
  }
  if (count % 3 === 0) {
    // Every 15 min: narrative synthesis
    return {
      type: 'heartbeat',
      payload: { heartbeatNumber: count, includesNarrativeSynthesis: true },
      priority: 'normal',
    }
  }
  // Standard heartbeat
  return {
    type: 'heartbeat',
    payload: { heartbeatNumber: count },
    priority: 'low',
  }
}

export function stopHeartbeat(): void {
  marketHoursJob?.stop()
  offHoursJob?.stop()
  marketHoursJob = null
  offHoursJob = null
  log.info('Heartbeat scheduler stopped')
}

export function getHeartbeatCount(): number {
  return heartbeatCount
}
