// [claude-code 2026-03-23] Added assess, dismiss-lockout, and debrief routes
import { Hono } from 'hono'
import type { Context } from 'hono'
import { authMiddleware } from '../middleware/auth.js'
import { createPsychAssistService } from '../services/psych-assist-service.js'
import type { TiltDetectorContext } from '../services/psych-assist-service.js'

const service = createPsychAssistService()

interface AuthPayload {
  sub?: string
  user_id?: string
  userId?: string
}

const getUserId = (c: Context): string | null => {
  const payload = c.get('auth') as AuthPayload | undefined
  return payload?.sub ?? payload?.user_id ?? payload?.userId ?? null
}

export const createPsychAssistRoutes = () => {
  const router = new Hono()

  router.use('*', authMiddleware)

  router.get('/profile', async (c) => {
    const userId = getUserId(c)
    if (!userId) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const profile = await service.getProfile(userId)
    return c.json({ profile })
  })

  router.put('/profile', async (c) => {
    const userId = getUserId(c)
    if (!userId) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    let body: Record<string, unknown> = {}
    try {
      body = await c.req.json()
    } catch {
      body = {}
    }

    const blindSpots = Array.isArray(body.blindSpots) ? (body.blindSpots as string[]) : undefined
    const goal = typeof body.goal === 'string' ? body.goal : undefined
    const orientationComplete =
      body.orientationComplete === true || body.source === 'orientation'

    const profile = await service.updateProfile(userId, {
      blindSpots,
      goal,
      orientationComplete
    })

    return c.json({ profile })
  })

  router.post('/scores', async (c) => {
    const userId = getUserId(c)
    if (!userId) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    let body: Record<string, unknown> = {}
    try {
      body = await c.req.json()
    } catch {
      body = {}
    }

    const profile = await service.updateScores(userId, body as Record<string, unknown>)
    return c.json({ profile })
  })

  // --- Tilt Detection + Lockout Protocol ---

  router.post('/assess', async (c) => {
    const userId = getUserId(c)
    if (!userId) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    let body: Record<string, unknown> = {}
    try {
      body = await c.req.json()
    } catch {
      body = {}
    }

    const context: TiltDetectorContext = {
      accountResetsToday: Number(body.accountResetsToday ?? 0),
      morningRoutineDone: body.morningRoutineDone === true,
      consecutiveLosses: Number(body.consecutiveLosses ?? 0),
      currentPnL: Number(body.currentPnL ?? 0),
      lastBigWin: typeof body.lastBigWin === 'string' ? body.lastBigWin : null,
      evalBehavior: body.evalBehavior as TiltDetectorContext['evalBehavior'],
      fundedBehavior: body.fundedBehavior as TiltDetectorContext['fundedBehavior'],
    }

    const result = await service.assessTradingReadiness(userId, context)
    return c.json(result)
  })

  router.post('/dismiss-lockout', async (c) => {
    const userId = getUserId(c)
    if (!userId) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const session = service.dismissLockout(userId)
    return c.json({ session })
  })

  router.post('/debrief', async (c) => {
    const userId = getUserId(c)
    if (!userId) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    let body: Record<string, unknown> = {}
    try {
      body = await c.req.json()
    } catch {
      body = {}
    }

    const answers = (body.answers ?? {}) as Record<string, string>
    if (Object.keys(answers).length === 0) {
      return c.json({ error: 'Debrief answers required' }, 400)
    }

    const session = service.submitDebrief(userId, answers)
    return c.json({ session })
  })

  return router
}

export default createPsychAssistRoutes
