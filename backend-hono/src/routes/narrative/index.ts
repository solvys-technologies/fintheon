// [claude-code 2026-03-06] Narrative scoring route factory
import { Hono } from 'hono'
import { scoreRiskflow, scoreBrief, researchDrill } from './handlers.js'

export function createNarrativeRoutes(): Hono {
  const app = new Hono()
  app.post('/score-riskflow', scoreRiskflow)
  app.post('/score-brief', scoreBrief)
  app.post('/research-drill', researchDrill)
  return app
}
