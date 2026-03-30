// [claude-code 2026-03-30] Claude Peers Sprint 1 — peer registry with DB + in-memory fallback
import { sql, isDatabaseAvailable } from '../../config/database.js'
import { createLogger } from '../../lib/logger.js'
import type {
  ClaudePeer,
  HeartbeatPayload,
  PeerRegistration,
  PeerStatus,
  User,
  UserRole,
} from '../../types/peers.js'

const log = createLogger('PeerRegistry')

const memoryUsers = new Map<string, User>()
const memoryPeers = new Map<string, ClaudePeer>()

let forceMemoryFallback = false
let heartbeatMonitor: ReturnType<typeof setInterval> | null = null

const AWAY_MS = 2 * 60 * 1000
const OFFLINE_MS = 5 * 60 * 1000

function nowIso(): string {
  return new Date().toISOString()
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function canUseDb(): boolean {
  return !forceMemoryFallback && isDatabaseAvailable() && !!sql
}

function shouldFallbackToMemory(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error)
  return (
    msg.includes('does not exist') ||
    msg.includes('relation') ||
    msg.includes('column') ||
    msg.includes('invalid input syntax for type uuid')
  )
}

function toIso(input: unknown, fallback = nowIso()): string {
  if (typeof input === 'string' && input.length > 0) return input
  if (input instanceof Date) return input.toISOString()
  return fallback
}

function mapUserRow(row: any): User {
  return {
    id: String(row.id),
    displayName: String(row.display_name ?? row.displayName ?? 'Peer User'),
    role: (row.role ?? 'peer') as UserRole,
    avatarUrl: row.avatar_url ?? row.avatarUrl ?? null,
    settings: (row.settings ?? {}) as Record<string, unknown>,
    createdAt: toIso(row.created_at ?? row.createdAt),
  }
}

function mapPeerRow(row: any): ClaudePeer {
  const user =
    row.user_id_join || row.user_display_name
      ? {
          id: String(row.user_id_join ?? row.user_id ?? row.userId ?? ''),
          displayName: String(row.user_display_name ?? 'Peer User'),
          role: (row.user_role ?? 'peer') as UserRole,
          avatarUrl: row.user_avatar_url ?? null,
          settings: (row.user_settings ?? {}) as Record<string, unknown>,
          createdAt: toIso(row.user_created_at),
        }
      : undefined

  return {
    id: String(row.id),
    userId: String(row.user_id ?? row.userId),
    deviceName: String(row.device_name ?? row.deviceName),
    platform: String(row.platform ?? process.platform),
    capabilities: Array.isArray(row.capabilities) ? row.capabilities : [],
    deskId: row.desk_id ?? row.deskId ?? null,
    deskName: row.desk_name ?? row.deskName ?? null,
    assignedAgents: Array.isArray(row.assigned_agents ?? row.assignedAgents)
      ? (row.assigned_agents ?? row.assignedAgents)
      : [],
    status: (row.status ?? 'offline') as PeerStatus,
    heartbeatAt: toIso(row.heartbeat_at ?? row.heartbeatAt),
    hermesAvailable: Boolean(row.hermes_available ?? row.hermesAvailable ?? false),
    createdAt: toIso(row.created_at ?? row.createdAt),
    user,
  }
}

function ensureMemoryUser(
  userId: string,
  seed?: Partial<Pick<User, 'displayName' | 'avatarUrl' | 'settings' | 'role'>>,
): User {
  const existing = memoryUsers.get(userId)
  if (existing) return existing

  const user: User = {
    id: userId,
    displayName: seed?.displayName || `Peer ${userId.slice(0, 8)}`,
    role: seed?.role ?? 'peer',
    avatarUrl: seed?.avatarUrl ?? null,
    settings: seed?.settings ?? {},
    createdAt: nowIso(),
  }
  memoryUsers.set(userId, user)
  return user
}

export async function getUserById(userId: string): Promise<User | null> {
  if (!userId) return null
  if (!canUseDb() || !isUuid(userId)) {
    return memoryUsers.get(userId) ?? null
  }

  try {
    const rows = await sql`SELECT * FROM users WHERE id::text = ${userId} LIMIT 1`
    if (rows.length === 0) return null
    return mapUserRow(rows[0])
  } catch (error) {
    if (shouldFallbackToMemory(error)) {
      forceMemoryFallback = true
      log.warn('users table unavailable, falling back to memory', { error: String(error) })
      return memoryUsers.get(userId) ?? null
    }
    throw error
  }
}

async function getOrCreateUser(
  userId: string,
  seed?: Partial<Pick<User, 'displayName' | 'avatarUrl' | 'settings'>>,
): Promise<User> {
  if (!canUseDb() || !isUuid(userId)) {
    return ensureMemoryUser(userId, seed)
  }

  try {
    const existing = await sql`SELECT * FROM users WHERE id::text = ${userId} LIMIT 1`
    if (existing.length > 0) {
      return mapUserRow(existing[0])
    }

    const inserted = await sql`
      INSERT INTO users (id, display_name, role, avatar_url, settings)
      VALUES (
        ${userId},
        ${seed?.displayName ?? `Peer ${userId.slice(0, 8)}`},
        'peer',
        ${seed?.avatarUrl ?? null},
        ${JSON.stringify(seed?.settings ?? {})}::jsonb
      )
      RETURNING *
    `
    return mapUserRow(inserted[0])
  } catch (error) {
    if (shouldFallbackToMemory(error)) {
      forceMemoryFallback = true
      log.warn('user upsert failed, switching to memory peer registry', { error: String(error) })
      return ensureMemoryUser(userId, seed)
    }
    throw error
  }
}

export async function upsertUserRole(
  userId: string,
  role: UserRole,
  seed?: Partial<Pick<User, 'displayName' | 'avatarUrl' | 'settings'>>,
): Promise<User> {
  if (!canUseDb() || !isUuid(userId)) {
    const user = ensureMemoryUser(userId, seed)
    const updated = { ...user, role }
    memoryUsers.set(userId, updated)
    return updated
  }

  try {
    const rows = await sql`
      INSERT INTO users (id, display_name, role, avatar_url, settings)
      VALUES (
        ${userId},
        ${seed?.displayName ?? `Peer ${userId.slice(0, 8)}`},
        ${role},
        ${seed?.avatarUrl ?? null},
        ${JSON.stringify(seed?.settings ?? {})}::jsonb
      )
      ON CONFLICT (id)
      DO UPDATE SET
        role = ${role},
        display_name = COALESCE(${seed?.displayName ?? null}, users.display_name),
        avatar_url = COALESCE(${seed?.avatarUrl ?? null}, users.avatar_url),
        settings = COALESCE(${JSON.stringify(seed?.settings ?? {})}::jsonb, users.settings)
      RETURNING *
    `
    return mapUserRow(rows[0])
  } catch (error) {
    if (shouldFallbackToMemory(error)) {
      forceMemoryFallback = true
      log.warn('user role upsert failed, using memory fallback', { error: String(error) })
      const user = ensureMemoryUser(userId, seed)
      const updated = { ...user, role }
      memoryUsers.set(userId, updated)
      return updated
    }
    throw error
  }
}

export async function hasAdminUsers(): Promise<boolean> {
  if (!canUseDb()) {
    return Array.from(memoryUsers.values()).some((u) => u.role === 'admin')
  }

  try {
    const rows = await sql`SELECT COUNT(*)::int AS count FROM users WHERE role = 'admin'`
    const count = Number(rows[0]?.count ?? 0)
    return count > 0
  } catch (error) {
    if (shouldFallbackToMemory(error)) {
      forceMemoryFallback = true
      return Array.from(memoryUsers.values()).some((u) => u.role === 'admin')
    }
    throw error
  }
}

export async function registerPeer(
  userId: string,
  registration: PeerRegistration,
): Promise<ClaudePeer> {
  const user = await getOrCreateUser(userId, {
    displayName: registration.displayName,
    avatarUrl: registration.avatarUrl,
    settings: registration.settings,
  })

  if (!canUseDb() || !isUuid(userId)) {
    const peer: ClaudePeer = {
      id: crypto.randomUUID(),
      userId,
      deviceName: registration.deviceName,
      platform: registration.platform ?? process.platform,
      capabilities: registration.capabilities ?? [],
      deskId: registration.deskId ?? null,
      assignedAgents: registration.assignedAgents ?? [],
      status: registration.status ?? 'online',
      heartbeatAt: nowIso(),
      hermesAvailable: Boolean(registration.hermesAvailable),
      createdAt: nowIso(),
      user,
    }
    memoryPeers.set(peer.id, peer)
    return peer
  }

  try {
    const rows = await sql`
      INSERT INTO claude_peers (
        user_id,
        device_name,
        platform,
        capabilities,
        desk_id,
        assigned_agents,
        status,
        heartbeat_at,
        hermes_available
      )
      VALUES (
        ${userId},
        ${registration.deviceName},
        ${registration.platform ?? process.platform},
        ${registration.capabilities ?? []}::text[],
        ${registration.deskId ?? null},
        ${registration.assignedAgents ?? []}::text[],
        ${registration.status ?? 'online'},
        NOW(),
        ${Boolean(registration.hermesAvailable)}
      )
      RETURNING *
    `
    return { ...mapPeerRow(rows[0]), user }
  } catch (error) {
    if (shouldFallbackToMemory(error)) {
      forceMemoryFallback = true
      log.warn('claude_peers insert failed, using memory fallback', { error: String(error) })
      return registerPeer(userId, registration)
    }
    throw error
  }
}

export async function sendHeartbeat(
  peerId: string,
  payload: HeartbeatPayload = {},
): Promise<ClaudePeer | null> {
  if (!canUseDb() || !isUuid(peerId)) {
    const peer = memoryPeers.get(peerId)
    if (!peer) return null
    const updated: ClaudePeer = {
      ...peer,
      status: payload.status ?? 'online',
      heartbeatAt: nowIso(),
    }
    memoryPeers.set(peerId, updated)
    return updated
  }

  try {
    const rows = await sql`
      UPDATE claude_peers
      SET heartbeat_at = NOW(),
          status = ${payload.status ?? 'online'}
      WHERE id = ${peerId}
      RETURNING *
    `
    if (rows.length === 0) return null
    return mapPeerRow(rows[0])
  } catch (error) {
    if (shouldFallbackToMemory(error)) {
      forceMemoryFallback = true
      return sendHeartbeat(peerId, payload)
    }
    throw error
  }
}

export async function listPeers(): Promise<ClaudePeer[]> {
  if (!canUseDb()) {
    return Array.from(memoryPeers.values()).sort((a, b) =>
      b.heartbeatAt.localeCompare(a.heartbeatAt),
    )
  }

  try {
    const rows = await sql`
      SELECT
        p.*,
        d.name AS desk_name,
        u.id AS user_id_join,
        u.display_name AS user_display_name,
        u.role AS user_role,
        u.avatar_url AS user_avatar_url,
        u.settings AS user_settings,
        u.created_at AS user_created_at
      FROM claude_peers p
      LEFT JOIN users u ON u.id = p.user_id
      LEFT JOIN desks d ON d.id = p.desk_id
      ORDER BY p.heartbeat_at DESC NULLS LAST
    `
    return rows.map((row) => mapPeerRow(row))
  } catch (error) {
    if (shouldFallbackToMemory(error)) {
      forceMemoryFallback = true
      return listPeers()
    }
    throw error
  }
}

export async function getPeer(peerId: string): Promise<ClaudePeer | null> {
  if (!canUseDb() || !isUuid(peerId)) {
    return memoryPeers.get(peerId) ?? null
  }

  try {
    const rows = await sql`
      SELECT
        p.*,
        d.name AS desk_name,
        u.id AS user_id_join,
        u.display_name AS user_display_name,
        u.role AS user_role,
        u.avatar_url AS user_avatar_url,
        u.settings AS user_settings,
        u.created_at AS user_created_at
      FROM claude_peers p
      LEFT JOIN users u ON u.id = p.user_id
      LEFT JOIN desks d ON d.id = p.desk_id
      WHERE p.id = ${peerId}
      LIMIT 1
    `
    if (rows.length === 0) return null
    return mapPeerRow(rows[0])
  } catch (error) {
    if (shouldFallbackToMemory(error)) {
      forceMemoryFallback = true
      return memoryPeers.get(peerId) ?? null
    }
    throw error
  }
}

export async function deregisterPeer(peerId: string): Promise<boolean> {
  if (!canUseDb() || !isUuid(peerId)) {
    const peer = memoryPeers.get(peerId)
    if (!peer) return false
    memoryPeers.set(peerId, { ...peer, status: 'offline', heartbeatAt: nowIso() })
    return true
  }

  try {
    const rows = await sql`
      UPDATE claude_peers
      SET status = 'offline', heartbeat_at = NOW()
      WHERE id = ${peerId}
      RETURNING id
    `
    return rows.length > 0
  } catch (error) {
    if (shouldFallbackToMemory(error)) {
      forceMemoryFallback = true
      return deregisterPeer(peerId)
    }
    throw error
  }
}

export function assignPeerDeskMemory(peerId: string, deskId: string): boolean {
  const peer = memoryPeers.get(peerId)
  if (!peer) return false
  memoryPeers.set(peerId, { ...peer, deskId })
  return true
}

function deriveStatus(heartbeatAt: string): PeerStatus {
  const age = Date.now() - new Date(heartbeatAt).getTime()
  if (age >= OFFLINE_MS) return 'offline'
  if (age >= AWAY_MS) return 'away'
  return 'online'
}

export function startHeartbeatMonitor(): void {
  if (heartbeatMonitor) return

  heartbeatMonitor = setInterval(async () => {
    if (!canUseDb()) {
      for (const [id, peer] of memoryPeers.entries()) {
        const nextStatus = deriveStatus(peer.heartbeatAt)
        if (peer.status !== nextStatus) {
          memoryPeers.set(id, { ...peer, status: nextStatus })
        }
      }
      return
    }

    try {
      await sql`
        UPDATE claude_peers
        SET status = 'away'
        WHERE status = 'online'
          AND heartbeat_at < NOW() - INTERVAL '2 minutes'
      `
      await sql`
        UPDATE claude_peers
        SET status = 'offline'
        WHERE heartbeat_at < NOW() - INTERVAL '5 minutes'
      `
    } catch (error) {
      if (shouldFallbackToMemory(error)) {
        forceMemoryFallback = true
        log.warn('heartbeat monitor switched to memory mode', { error: String(error) })
      } else {
        log.warn('heartbeat monitor tick failed', { error: String(error) })
      }
    }
  }, 60_000)

  heartbeatMonitor.unref?.()
  log.info('Peer heartbeat monitor started')
}
