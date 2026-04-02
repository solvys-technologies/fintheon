// [claude-code 2026-04-01] S13-T3: Agentic editor sidebar routes

import { Hono } from 'hono'
import {
  executeSidebarAction,
  listAvailableActions,
  type SidebarAction,
} from '../../services/editor/agentic-sidebar.js'

export function createEditorRoutes(): Hono {
  const app = new Hono()

  // POST /api/editor/sidebar/action — execute a sidebar action
  app.post('/sidebar/action', async (c) => {
    const body = await c.req.json<SidebarAction>()
    if (!body.type || !body.documentId) {
      return c.json({ error: 'type and documentId are required' }, 400)
    }
    const result = await executeSidebarAction(body)
    return c.json({ action: result })
  })

  // GET /api/editor/sidebar/actions — list available action types
  app.get('/sidebar/actions', (c) => {
    const actions = listAvailableActions()
    return c.json({ actions })
  })

  return app
}
