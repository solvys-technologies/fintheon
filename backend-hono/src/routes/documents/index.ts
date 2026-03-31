// [claude-code 2026-03-31] S12-T2: Document CRUD routes

import { Hono } from 'hono'
import type { Context } from 'hono'
import {
  createDocument,
  getDocument,
  listDocuments,
  updateDocument,
  deleteDocument,
} from '../../services/documents/doc-store.js'

function getUserId(c: Context): string | null {
  const userId = c.get('userId') as string | undefined
  if (!userId || userId === 'anon') return null
  return userId
}

export function createDocumentRoutes(): Hono {
  const app = new Hono()

  // POST / — create document
  app.post('/', async (c) => {
    const userId = getUserId(c)
    if (!userId) return c.json({ error: 'Unauthorized' }, 401)

    const body = await c.req.json<{ title?: string; deskId?: string; tags?: string[] }>()
    const doc = await createDocument(
      body.title || 'Untitled',
      userId,
      body.deskId,
      body.tags
    )
    return c.json({ document: doc }, 201)
  })

  // GET / — list documents
  app.get('/', async (c) => {
    const search = c.req.query('search') || undefined
    const deskId = c.req.query('deskId') || undefined
    const tagsRaw = c.req.query('tags')
    const tags = tagsRaw ? tagsRaw.split(',').map((t) => t.trim()).filter(Boolean) : undefined
    const limit = parseInt(c.req.query('limit') || '50', 10)
    const offset = parseInt(c.req.query('offset') || '0', 10)

    const documents = await listDocuments({ search, deskId, tags, limit, offset })
    return c.json({ documents })
  })

  // GET /:id — get document with full content
  app.get('/:id', async (c) => {
    const doc = await getDocument(c.req.param('id'))
    if (!doc) return c.json({ error: 'Not found' }, 404)
    return c.json({ document: doc })
  })

  // PUT /:id — update document
  app.put('/:id', async (c) => {
    const userId = getUserId(c)
    if (!userId) return c.json({ error: 'Unauthorized' }, 401)

    const body = await c.req.json<{ title?: string; content?: Record<string, unknown>; tags?: string[] }>()
    const doc = await updateDocument(c.req.param('id'), body)
    if (!doc) return c.json({ error: 'Not found' }, 404)
    return c.json({ document: doc })
  })

  // DELETE /:id — delete document (author only)
  app.delete('/:id', async (c) => {
    const userId = getUserId(c)
    if (!userId) return c.json({ error: 'Unauthorized' }, 401)

    const ok = await deleteDocument(c.req.param('id'), userId)
    if (!ok) return c.json({ error: 'Not found or not authorized' }, 404)
    return c.json({ ok: true })
  })

  return app
}
