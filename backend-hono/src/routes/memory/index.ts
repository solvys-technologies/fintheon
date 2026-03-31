// [claude-code 2026-04-01] S13-T3: Shared memory + analysis history routes

import { Hono } from 'hono'
import {
  getSharedMemory,
  setSharedMemory,
  listSharedMemory,
  deleteSharedMemory,
} from '../../services/peers/shared-memory.js'
import {
  searchAnalysisHistory,
  getAgentAnalysisHistory,
  getAnalysisByInstrument,
} from '../../services/peers/analysis-history.js'

export function createMemoryRoutes(): Hono {
  const app = new Hono()

  // ── Shared Memory ─────────────────────────────────────────────────────

  // GET /api/memory/shared — list with optional category/search filter
  app.get('/shared', async (c) => {
    const category = c.req.query('category') || undefined
    const search = c.req.query('search') || undefined
    const entries = await listSharedMemory({ category, search })
    return c.json({ entries })
  })

  // GET /api/memory/shared/:key — get single entry
  app.get('/shared/:key', async (c) => {
    const key = c.req.param('key')
    const entry = await getSharedMemory(key)
    return c.json({ entry })
  })

  // PUT /api/memory/shared/:key — set/upsert
  app.put('/shared/:key', async (c) => {
    const key = c.req.param('key')
    const body = await c.req.json<{
      value: Record<string, unknown>
      category?: string
      ttlHours?: number
      agentName?: string
    }>()
    const entry = await setSharedMemory(key, body.value, {
      category: body.category,
      ttlHours: body.ttlHours,
      agentName: body.agentName,
    })
    return c.json({ entry })
  })

  // DELETE /api/memory/shared/:key
  app.delete('/shared/:key', async (c) => {
    const key = c.req.param('key')
    const ok = await deleteSharedMemory(key)
    return c.json({ ok })
  })

  // ── Analysis History ──────────────────────────────────────────────────

  // GET /api/memory/analysis/search?q=...&agent=...&limit=...
  app.get('/analysis/search', async (c) => {
    const q = c.req.query('q') || ''
    const agent = c.req.query('agent') || undefined
    const limit = Number(c.req.query('limit')) || 20
    if (!q.trim()) return c.json({ results: [] })
    const results = await searchAnalysisHistory(q, { agent, limit })
    return c.json({ results })
  })

  // GET /api/memory/analysis/agent/:name
  app.get('/analysis/agent/:name', async (c) => {
    const name = c.req.param('name')
    const limit = Number(c.req.query('limit')) || 20
    const thoughts = await getAgentAnalysisHistory(name, limit)
    return c.json({ thoughts })
  })

  // GET /api/memory/analysis/instrument/:sym
  app.get('/analysis/instrument/:sym', async (c) => {
    const sym = c.req.param('sym')
    const limit = Number(c.req.query('limit')) || 20
    const thoughts = await getAnalysisByInstrument(sym, limit)
    return c.json({ thoughts })
  })

  return app
}
