// [claude-code 2026-04-05] Claude Peers — peer/auth/desk/voice endpoints + test-fire on twitter-round-robin registration
import { Hono } from 'hono'
import type { Context } from 'hono'
import {
  deregisterPeer,
  getPeer,
  getUserById,
  listPeers,
  registerPeer,
  sendHeartbeat,
} from '../../services/peers/peer-registry.js'
import { forcePoll } from '../../services/riskflow/feed-poller.js'
import { createLogger } from '../../lib/logger.js'

const log = createLogger('PeersRoute')
import {
  assignPeerToDesk,
  createDesk,
  getDeskPeers,
  listDesks,
} from '../../services/peers/desk-manager.js'
import {
  createRoom,
  joinRoom,
  leaveRoom,
  listParticipants,
} from '../../services/peers/voice-room.js'
import type { HeartbeatPayload, PeerRegistration } from '../../types/peers.js'

function getUserId(c: Context): string | null {
  const userId = c.get('userId') as string | undefined
  if (!userId || userId === 'anon') return null
  return userId
}

export function createPeersRoutes(): Hono {
  const router = new Hono()

  router.post('/register', async (c) => {
    const userId = getUserId(c)
    if (!userId) return c.json({ error: 'Authentication required' }, 401)

    const body = await c.req.json<PeerRegistration>().catch(() => null)
    if (!body?.deviceName) {
      return c.json({ error: 'deviceName is required' }, 400)
    }

    const peer = await registerPeer(userId, body)

    // Test-fire: when a peer with twitter-round-robin comes online, trigger an immediate feed poll
    const caps = body.capabilities ?? []
    if (caps.includes('twitter-round-robin')) {
      log.info(`Peer ${body.deviceName} registered with twitter-round-robin — test-firing feed poll`)
      forcePoll().catch((err) =>
        log.warn('Test-fire feed poll failed (non-fatal)', { error: String(err) })
      )
    }

    return c.json({ peer })
  })

  router.post('/heartbeat', async (c) => {
    const userId = getUserId(c)
    if (!userId) return c.json({ error: 'Authentication required' }, 401)

    const body = await c
      .req
      .json<{ peerId?: string; payload?: HeartbeatPayload }>()
      .catch(() => null)
    if (!body?.peerId) {
      return c.json({ error: 'peerId is required' }, 400)
    }

    const peer = await sendHeartbeat(body.peerId, body.payload)
    if (!peer) return c.json({ error: 'Peer not found' }, 404)
    return c.json({ peer })
  })

  router.get('/list', async (c) => {
    const userId = getUserId(c)
    if (!userId) return c.json({ error: 'Authentication required' }, 401)
    const peers = await listPeers()
    return c.json({ peers, total: peers.length })
  })

  router.post('/desks', async (c) => {
    const userId = getUserId(c)
    if (!userId) return c.json({ error: 'Authentication required' }, 401)

    const body = await c
      .req
      .json<{ name?: string; description?: string; sectorFocus?: string[] }>()
      .catch(() => null)
    if (!body?.name) return c.json({ error: 'name is required' }, 400)

    try {
      const desk = await createDesk(
        body.name.trim(),
        body.sectorFocus ?? [],
        userId,
        body.description,
      )
      return c.json({ desk })
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      if (msg.includes('Admin privileges')) {
        return c.json({ error: 'Admin privileges required' }, 403)
      }
      return c.json({ error: 'Failed to create desk', details: msg }, 500)
    }
  })

  router.get('/desks', async (c) => {
    const desks = await listDesks()
    return c.json({ desks, total: desks.length })
  })

  router.post('/desks/:id/assign', async (c) => {
    const userId = getUserId(c)
    if (!userId) return c.json({ error: 'Authentication required' }, 401)

    const deskId = c.req.param('id')
    const body = await c.req.json<{ peerId?: string }>().catch(() => null)
    if (!body?.peerId) return c.json({ error: 'peerId is required' }, 400)

    try {
      const assigned = await assignPeerToDesk(body.peerId, deskId, userId)
      if (!assigned) return c.json({ error: 'Peer not found or assignment failed' }, 404)
      const peers = await getDeskPeers(deskId)
      return c.json({ assigned: true, deskId, peers })
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      if (msg.includes('Admin privileges')) {
        return c.json({ error: 'Admin privileges required' }, 403)
      }
      return c.json({ error: 'Failed to assign peer', details: msg }, 500)
    }
  })

  router.post('/voice/join', async (c) => {
    const userId = getUserId(c)
    if (!userId) return c.json({ error: 'Authentication required' }, 401)

    const body = await c
      .req
      .json<{ peerId?: string; roomId?: string; roomName?: string }>()
      .catch(() => null)

    const peers = await listPeers()
    const resolvedPeerId =
      body?.peerId ??
      peers.find((peer) => peer.userId === userId)?.id ??
      userId

    let roomId = body?.roomId
    if (!roomId) {
      const room = await createRoom(body?.roomName?.trim() || 'Claude Peers Voice')
      roomId = room.id
    }

    const result = await joinRoom(resolvedPeerId, roomId)
    return c.json(result)
  })

  router.post('/voice/leave', async (c) => {
    const userId = getUserId(c)
    if (!userId) return c.json({ error: 'Authentication required' }, 401)

    const body = await c
      .req
      .json<{ peerId?: string; roomId?: string }>()
      .catch(() => null)
    if (!body?.roomId) return c.json({ error: 'roomId is required' }, 400)

    const peers = await listPeers()
    const resolvedPeerId =
      body.peerId ??
      peers.find((peer) => peer.userId === userId)?.id ??
      userId

    const left = await leaveRoom(resolvedPeerId, body.roomId)
    return c.json({ left })
  })

  router.get('/voice/participants', async (c) => {
    const roomId = c.req.query('roomId')
    if (!roomId) return c.json({ error: 'roomId query parameter is required' }, 400)

    const data = await listParticipants(roomId)
    return c.json(data)
  })

  router.get('/:id', async (c) => {
    const userId = getUserId(c)
    if (!userId) return c.json({ error: 'Authentication required' }, 401)
    const id = c.req.param('id')
    const peer = await getPeer(id)
    if (!peer) return c.json({ error: 'Peer not found' }, 404)
    return c.json({ peer })
  })

  router.delete('/:id', async (c) => {
    const userId = getUserId(c)
    if (!userId) return c.json({ error: 'Authentication required' }, 401)
    const id = c.req.param('id')
    const peer = await getPeer(id)
    if (!peer) return c.json({ error: 'Peer not found' }, 404)
    // Only the peer's owner or an admin can deregister
    if (peer.userId !== userId) {
      const user = await getUserById(userId)
      if (!user || user.role !== 'admin') {
        return c.json({ error: 'Not authorized to deregister this peer' }, 403)
      }
    }
    const ok = await deregisterPeer(id)
    return c.json({ ok })
  })

  return router
}

