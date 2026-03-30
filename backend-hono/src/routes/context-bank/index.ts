// [claude-code 2026-03-28] Context Bank API routes — unified snapshot + desk reports + briefs + agent memory bank
import { Hono } from 'hono'
import {
  handleGetSnapshot,
  handleGetMeta,
  handleSubmitDeskReport,
  handleGetDeskReports,
  handleGetDeskHistory,
  handleGetBrief,
  handleSubmitBrief,
} from './handlers.js'
import {
  handleGetAgentMemories,
  handleSaveMemory,
  handleSyncMemories,
  handleGetProtocol,
  handleDeleteMemory,
} from './memory-handlers.js'

export function createContextBankRoutes(): Hono {
  const app = new Hono()

  // GET / — current snapshot (or ?version=N)
  app.get('/', handleGetSnapshot)

  // GET /meta — lightweight version + timestamp only
  app.get('/meta', handleGetMeta)

  // POST /desk-reports — agent submits desk report
  app.post('/desk-reports', handleSubmitDeskReport)

  // GET /desk-reports — latest report per desk
  app.get('/desk-reports', handleGetDeskReports)

  // GET /desk-reports/:desk — history for specific desk
  app.get('/desk-reports/:desk', handleGetDeskHistory)

  // GET /brief — Harper's latest consolidated brief
  app.get('/brief', handleGetBrief)

  // POST /brief — Harper submits consolidated brief
  app.post('/brief', handleSubmitBrief)

  // ─── Agent Memory Bank (S8-T8) ──────────────────────────────
  // GET /memories?agent=harper-opus&type=observation — get context for agent
  app.get('/memories', handleGetAgentMemories)

  // POST /memories — save a single memory entry
  app.post('/memories', handleSaveMemory)

  // POST /memories/sync — bulk sync from CLI memory
  app.post('/memories/sync', handleSyncMemories)

  // GET /memories/protocol — shared soul + protocol entries
  app.get('/memories/protocol', handleGetProtocol)

  // DELETE /memories/:id — remove a memory entry
  app.delete('/memories/:id', handleDeleteMemory)

  return app
}
