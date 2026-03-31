// [claude-code 2026-03-31] S12-T1: Bulletin board routes — CRUD + voting
import { Hono } from 'hono'
import type { Context } from 'hono'
import * as bulletinStore from '../../services/bulletin/bulletin-store.js'
import * as voteCounter from '../../services/bulletin/vote-counter.js'
import type { VoteType } from '../../types/bulletin.js'

function getUserId(c: Context): string | null {
  const userId = c.get('userId') as string | undefined
  if (!userId || userId === 'anon') return null
  return userId
}

export function createBulletinRoutes(): Hono {
  const app = new Hono()

  // POST / — create post
  app.post('/', async (c) => {
    const userId = getUserId(c)
    if (!userId) return c.json({ error: 'Authentication required' }, 401)

    const body = await c.req.json()
    const post = await bulletinStore.createPost({
      authorId: userId,
      authorAgent: body.authorAgent ?? null,
      deskId: body.deskId ?? null,
      content: body.content,
      contentParts: body.contentParts ?? null,
      parentId: body.parentId ?? null,
    })
    return c.json({ post })
  })

  // GET / — list posts
  app.get('/', async (c) => {
    const deskId = c.req.query('deskId')
    const limit = parseInt(c.req.query('limit') ?? '50', 10)
    const offset = parseInt(c.req.query('offset') ?? '0', 10)
    const posts = await bulletinStore.listPosts({ deskId, limit, offset })
    return c.json({ posts })
  })

  // GET /:id — get single post
  app.get('/:id', async (c) => {
    const post = await bulletinStore.getPost(c.req.param('id'))
    if (!post) return c.json({ error: 'Post not found' }, 404)
    return c.json({ post })
  })

  // GET /:id/replies — get threaded replies
  app.get('/:id/replies', async (c) => {
    const replies = await bulletinStore.getPostReplies(c.req.param('id'))
    return c.json({ replies })
  })

  // DELETE /:id — delete post (author only)
  app.delete('/:id', async (c) => {
    const userId = getUserId(c)
    if (!userId) return c.json({ error: 'Authentication required' }, 401)

    const deleted = await bulletinStore.deletePost(c.req.param('id'), userId)
    if (!deleted) return c.json({ error: 'Not found or not authorized' }, 404)
    return c.json({ ok: true })
  })

  // POST /:id/vote — cast vote
  app.post('/:id/vote', async (c) => {
    const userId = getUserId(c)
    if (!userId) return c.json({ error: 'Authentication required' }, 401)

    const body = await c.req.json()
    const voteType = body.voteType as VoteType
    if (!['up', 'down', 'check', 'x'].includes(voteType)) {
      return c.json({ error: 'Invalid vote type' }, 400)
    }

    const vote = await voteCounter.castVote(c.req.param('id'), userId, voteType)
    return c.json({ vote })
  })

  // GET /:id/votes — get all votes
  app.get('/:id/votes', async (c) => {
    const votes = await voteCounter.getVotes(c.req.param('id'))
    return c.json({ votes })
  })

  return app
}
