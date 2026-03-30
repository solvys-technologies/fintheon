// [claude-code 2026-03-30] Claude Peers Sprint 1 — desk management + admin guard
import { isDatabaseAvailable, sql } from '../../config/database.js'
import type { ClaudePeer, Desk } from '../../types/peers.js'
import { assignPeerDeskMemory, getUserById, listPeers } from './peer-registry.js'

const memoryDesks = new Map<string, Desk>()

function nowIso(): string {
  return new Date().toISOString()
}

function canUseDb(): boolean {
  return isDatabaseAvailable() && !!sql
}

function shouldFallback(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error)
  return msg.includes('does not exist') || msg.includes('relation')
}

async function assertAdmin(userId: string): Promise<void> {
  if (process.env.BYPASS_AUTH === 'true' && userId === 'local-user') return
  const user = await getUserById(userId)
  if (!user || user.role !== 'admin') {
    throw new Error('Admin privileges required')
  }
}

function mapDeskRow(row: any): Desk {
  return {
    id: String(row.id),
    name: String(row.name),
    description: row.description ?? null,
    sectorFocus: Array.isArray(row.sector_focus ?? row.sectorFocus)
      ? (row.sector_focus ?? row.sectorFocus)
      : [],
    createdById: String(row.created_by ?? row.createdById),
    createdAt: String(row.created_at ?? row.createdAt ?? nowIso()),
  }
}

export async function createDesk(
  name: string,
  sectorFocus: string[],
  createdBy: string,
  description?: string,
): Promise<Desk> {
  await assertAdmin(createdBy)

  if (!canUseDb()) {
    const desk: Desk = {
      id: crypto.randomUUID(),
      name,
      description: description ?? null,
      sectorFocus,
      createdById: createdBy,
      createdAt: nowIso(),
    }
    memoryDesks.set(desk.id, desk)
    return desk
  }

  try {
    const rows = await sql`
      INSERT INTO desks (name, description, sector_focus, created_by)
      VALUES (${name}, ${description ?? null}, ${sectorFocus}::text[], ${createdBy})
      RETURNING *
    `
    return mapDeskRow(rows[0])
  } catch (error) {
    if (shouldFallback(error)) {
      const desk: Desk = {
        id: crypto.randomUUID(),
        name,
        description: description ?? null,
        sectorFocus,
        createdById: createdBy,
        createdAt: nowIso(),
      }
      memoryDesks.set(desk.id, desk)
      return desk
    }
    throw error
  }
}

export async function listDesks(): Promise<Desk[]> {
  if (!canUseDb()) {
    return Array.from(memoryDesks.values())
  }

  try {
    const rows = await sql`SELECT * FROM desks ORDER BY created_at DESC`
    return rows.map((row) => mapDeskRow(row))
  } catch (error) {
    if (shouldFallback(error)) return Array.from(memoryDesks.values())
    throw error
  }
}

export async function assignPeerToDesk(
  peerId: string,
  deskId: string,
  requestedBy: string,
): Promise<boolean> {
  await assertAdmin(requestedBy)

  if (!canUseDb()) {
    return assignPeerDeskMemory(peerId, deskId)
  }

  try {
    const rows = await sql`
      UPDATE claude_peers
      SET desk_id = ${deskId}
      WHERE id = ${peerId}
      RETURNING id
    `
    return rows.length > 0
  } catch (error) {
    if (shouldFallback(error)) return assignPeerDeskMemory(peerId, deskId)
    throw error
  }
}

export async function getDeskPeers(deskId: string): Promise<ClaudePeer[]> {
  if (!canUseDb()) {
    const peers = await listPeers()
    return peers.filter((peer) => peer.deskId === deskId)
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
      WHERE p.desk_id = ${deskId}
      ORDER BY p.heartbeat_at DESC NULLS LAST
    `
    return rows.map((row) => ({
      id: String(row.id),
      userId: String(row.user_id),
      deviceName: String(row.device_name),
      platform: String(row.platform),
      capabilities: Array.isArray(row.capabilities) ? row.capabilities : [],
      deskId: row.desk_id ?? null,
      deskName: row.desk_name ?? null,
      assignedAgents: Array.isArray(row.assigned_agents) ? row.assigned_agents : [],
      status: row.status ?? 'offline',
      heartbeatAt: String(row.heartbeat_at ?? nowIso()),
      hermesAvailable: Boolean(row.hermes_available ?? false),
      createdAt: String(row.created_at ?? nowIso()),
      user: row.user_id_join
        ? {
            id: String(row.user_id_join),
            displayName: String(row.user_display_name ?? 'Peer User'),
            role: row.user_role ?? 'peer',
            avatarUrl: row.user_avatar_url ?? null,
            settings: row.user_settings ?? {},
            createdAt: String(row.user_created_at ?? nowIso()),
          }
        : undefined,
    }))
  } catch (error) {
    if (shouldFallback(error)) {
      const peers = await listPeers()
      return peers.filter((peer) => peer.deskId === deskId)
    }
    throw error
  }
}
