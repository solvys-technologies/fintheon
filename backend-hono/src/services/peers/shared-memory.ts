// [claude-code 2026-04-01] S13-T3: Team shared memory — DB + in-memory fallback

import { sql, isDatabaseAvailable } from '../../config/database.js'
import { createLogger } from '../../lib/logger.js'

const log = createLogger('SharedMemory')

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SharedMemoryEntry {
  id: string
  key: string
  value: Record<string, unknown>
  peerId: string | null
  agentName: string | null
  category: string
  ttlHours: number | null
  createdAt: string
  updatedAt: string
}

interface SharedMemoryRow {
  id: string
  key: string
  value: Record<string, unknown>
  peer_id: string | null
  agent_name: string | null
  category: string
  ttl_hours: number | null
  created_at: string
  updated_at: string
}

function mapRow(row: SharedMemoryRow): SharedMemoryEntry {
  return {
    id: row.id,
    key: row.key,
    value: typeof row.value === 'string' ? JSON.parse(row.value) : (row.value ?? {}),
    peerId: row.peer_id,
    agentName: row.agent_name,
    category: row.category ?? 'custom',
    ttlHours: row.ttl_hours,
    createdAt: typeof row.created_at === 'object' ? (row.created_at as unknown as Date).toISOString() : row.created_at,
    updatedAt: typeof row.updated_at === 'object' ? (row.updated_at as unknown as Date).toISOString() : row.updated_at,
  }
}

// ---------------------------------------------------------------------------
// In-memory fallback
// ---------------------------------------------------------------------------

const MEMORY_CAP = 500
const memoryStore = new Map<string, SharedMemoryEntry>()

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export async function setSharedMemory(
  key: string,
  value: Record<string, unknown>,
  opts?: { peerId?: string; agentName?: string; category?: string; ttlHours?: number }
): Promise<SharedMemoryEntry> {
  const category = opts?.category ?? 'custom'
  const ttlHours = opts?.ttlHours ?? null

  if (!isDatabaseAvailable()) {
    const existing = memoryStore.get(key)
    const now = new Date().toISOString()
    const entry: SharedMemoryEntry = {
      id: existing?.id ?? crypto.randomUUID(),
      key,
      value,
      peerId: opts?.peerId ?? null,
      agentName: opts?.agentName ?? null,
      category,
      ttlHours,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    }
    memoryStore.set(key, entry)
    if (memoryStore.size > MEMORY_CAP) {
      const oldest = Array.from(memoryStore.entries())
        .sort((a, b) => a[1].updatedAt.localeCompare(b[1].updatedAt))[0]
      if (oldest) memoryStore.delete(oldest[0])
    }
    return entry
  }

  const result = await sql`
    INSERT INTO peer_shared_memory (key, value, peer_id, agent_name, category, ttl_hours)
    VALUES (
      ${key},
      ${JSON.stringify(value)}::jsonb,
      ${opts?.peerId ?? null},
      ${opts?.agentName ?? null},
      ${category},
      ${ttlHours}
    )
    ON CONFLICT (key) DO UPDATE SET
      value = ${JSON.stringify(value)}::jsonb,
      peer_id = COALESCE(${opts?.peerId ?? null}, peer_shared_memory.peer_id),
      agent_name = COALESCE(${opts?.agentName ?? null}, peer_shared_memory.agent_name),
      category = ${category},
      ttl_hours = ${ttlHours},
      updated_at = NOW()
    RETURNING *
  `
  return mapRow(result[0] as SharedMemoryRow)
}

export async function getSharedMemory(key: string): Promise<SharedMemoryEntry | null> {
  if (!isDatabaseAvailable()) {
    return memoryStore.get(key) ?? null
  }

  const result = await sql`
    SELECT * FROM peer_shared_memory WHERE key = ${key} LIMIT 1
  `
  if (result.length === 0) return null
  return mapRow(result[0] as SharedMemoryRow)
}

export async function listSharedMemory(filter?: {
  category?: string
  agentName?: string
  search?: string
}): Promise<SharedMemoryEntry[]> {
  if (!isDatabaseAvailable()) {
    let entries = Array.from(memoryStore.values())
    if (filter?.category) entries = entries.filter((e) => e.category === filter.category)
    if (filter?.agentName) entries = entries.filter((e) => e.agentName === filter.agentName)
    if (filter?.search) {
      const q = filter.search.toLowerCase()
      entries = entries.filter(
        (e) => e.key.toLowerCase().includes(q) || JSON.stringify(e.value).toLowerCase().includes(q)
      )
    }
    return entries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }

  // DB path — build with optional filters
  if (filter?.search) {
    const searchTerm = `%${filter.search}%`
    const result = await sql`
      SELECT * FROM peer_shared_memory
      WHERE (${filter.category ?? null}::text IS NULL OR category = ${filter.category ?? ''})
        AND (${filter.agentName ?? null}::text IS NULL OR agent_name = ${filter.agentName ?? ''})
        AND (key ILIKE ${searchTerm} OR value::text ILIKE ${searchTerm})
      ORDER BY updated_at DESC
      LIMIT 100
    `
    return result.map((r) => mapRow(r as SharedMemoryRow))
  }

  const result = await sql`
    SELECT * FROM peer_shared_memory
    WHERE (${filter?.category ?? null}::text IS NULL OR category = ${filter?.category ?? ''})
      AND (${filter?.agentName ?? null}::text IS NULL OR agent_name = ${filter?.agentName ?? ''})
    ORDER BY updated_at DESC
    LIMIT 100
  `
  return result.map((r) => mapRow(r as SharedMemoryRow))
}

export async function deleteSharedMemory(key: string): Promise<boolean> {
  if (!isDatabaseAvailable()) {
    return memoryStore.delete(key)
  }

  const result = await sql`
    DELETE FROM peer_shared_memory WHERE key = ${key} RETURNING id
  `
  return result.length > 0
}

export async function cleanupExpiredMemory(): Promise<number> {
  if (!isDatabaseAvailable()) {
    let removed = 0
    const now = Date.now()
    for (const [key, entry] of memoryStore.entries()) {
      if (entry.ttlHours !== null) {
        const expiresAt = new Date(entry.createdAt).getTime() + entry.ttlHours * 3600_000
        if (now > expiresAt) {
          memoryStore.delete(key)
          removed++
        }
      }
    }
    return removed
  }

  const result = await sql`
    DELETE FROM peer_shared_memory
    WHERE ttl_hours IS NOT NULL
      AND created_at + (ttl_hours || ' hours')::interval < NOW()
    RETURNING id
  `
  return result.length
}

// ---------------------------------------------------------------------------
// Cleanup cron (30 min)
// ---------------------------------------------------------------------------

let cleanupTimer: ReturnType<typeof setInterval> | null = null

export function startSharedMemoryCleanup(): void {
  if (cleanupTimer) return
  cleanupTimer = setInterval(async () => {
    try {
      const removed = await cleanupExpiredMemory()
      if (removed > 0) log.info(`Cleaned up ${removed} expired shared memory entries`)
    } catch (err) {
      log.warn('Shared memory cleanup failed (non-fatal)', { error: String(err) })
    }
  }, 30 * 60_000)
  cleanupTimer.unref?.()
  log.info('SharedMemoryCleanup scheduled (30min)')
}
