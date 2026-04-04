// [claude-code 2026-04-04] Harper Ops Feed Store — action log for the Harper Ops panel

import { EventEmitter } from 'node:events'
import { sql, isDatabaseAvailable } from '../../config/database.js'
import { createLogger } from '../../lib/logger.js'

const log = createLogger('HarperOps')

// [claude-code 2026-04-05] EventEmitter for SSE broadcast on new ops entries
export const opsEmitter = new EventEmitter()

// ── Types ──────────────────────────────────────────────────────────────────

export interface OpsEntry {
  id?: string
  actionType: 'heartbeat' | 'analysis' | 'alert' | 'recommendation' | 'execution' | 'error'
  title: string
  detail?: string
  severity?: 'info' | 'warning' | 'critical'
  metadata?: Record<string, unknown>
  requiresApproval?: boolean
  approvalStatus?: 'pending' | 'approved' | 'denied' | 'auto' | null
  createdAt?: string
}

interface OpsRow {
  id: string
  action_type: string
  title: string
  detail: string | null
  severity: string
  metadata: Record<string, unknown>
  requires_approval: boolean
  approval_status: string | null
  created_at: string
}

// ── In-memory fallback ─────────────────────────────────────────────────────

const MEMORY_MAX = 300
const memoryFeed: OpsEntry[] = []

function mapRow(row: OpsRow): OpsEntry {
  return {
    id: row.id,
    actionType: row.action_type as OpsEntry['actionType'],
    title: row.title,
    detail: row.detail ?? undefined,
    severity: row.severity as OpsEntry['severity'],
    metadata: row.metadata,
    requiresApproval: row.requires_approval,
    approvalStatus: row.approval_status as OpsEntry['approvalStatus'],
    createdAt: row.created_at,
  }
}

// ── CRUD ────────────────────────────────────────────────────────────────────

export async function writeOpsEntry(entry: OpsEntry): Promise<OpsEntry> {
  const {
    actionType,
    title,
    detail,
    severity = 'info',
    metadata = {},
    requiresApproval = false,
    approvalStatus = requiresApproval ? 'pending' : 'auto',
  } = entry

  if (!isDatabaseAvailable()) {
    const fallback: OpsEntry = {
      id: crypto.randomUUID(),
      actionType,
      title,
      detail,
      severity,
      metadata,
      requiresApproval,
      approvalStatus,
      createdAt: new Date().toISOString(),
    }
    memoryFeed.unshift(fallback)
    if (memoryFeed.length > MEMORY_MAX) memoryFeed.pop()
    log.info(`Ops entry written (in-memory): [${severity}] ${title}`)
    opsEmitter.emit('entry', fallback)
    return fallback
  }

  try {
    const rows = await sql`
      INSERT INTO harper_ops_feed (action_type, title, detail, severity, metadata, requires_approval, approval_status)
      VALUES (${actionType}, ${title}, ${detail ?? null}, ${severity}, ${JSON.stringify(metadata)}::jsonb, ${requiresApproval}, ${approvalStatus ?? null})
      RETURNING *
    `
    log.info(`Ops entry written: [${severity}] ${title}`)
    const written = mapRow(rows[0] as OpsRow)
    opsEmitter.emit('entry', written)
    return written
  } catch (err) {
    log.error('Failed to write ops entry', { error: err instanceof Error ? err.message : String(err) })
    const fallback: OpsEntry = {
      id: crypto.randomUUID(),
      actionType,
      title,
      detail,
      severity,
      metadata,
      requiresApproval,
      approvalStatus,
      createdAt: new Date().toISOString(),
    }
    memoryFeed.unshift(fallback)
    opsEmitter.emit('entry', fallback)
    return fallback
  }
}

export async function getOpsFeed(limit = 50, offset = 0): Promise<{ entries: OpsEntry[]; total: number }> {
  if (!isDatabaseAvailable()) {
    return {
      entries: memoryFeed.slice(offset, offset + limit),
      total: memoryFeed.length,
    }
  }

  try {
    const [rows, countRows] = await Promise.all([
      sql`
        SELECT * FROM harper_ops_feed
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `,
      sql`SELECT COUNT(*)::int AS total FROM harper_ops_feed`,
    ])
    return {
      entries: (rows as OpsRow[]).map(mapRow),
      total: (countRows[0] as { total: number }).total,
    }
  } catch (err) {
    log.error('Failed to read ops feed', { error: err instanceof Error ? err.message : String(err) })
    return { entries: memoryFeed.slice(offset, offset + limit), total: memoryFeed.length }
  }
}

export async function getPendingApprovals(): Promise<OpsEntry[]> {
  if (!isDatabaseAvailable()) {
    return memoryFeed.filter((e) => e.requiresApproval && e.approvalStatus === 'pending')
  }

  try {
    const rows = await sql`
      SELECT * FROM harper_ops_feed
      WHERE requires_approval = true AND approval_status = 'pending'
      ORDER BY created_at DESC
    `
    return (rows as OpsRow[]).map(mapRow)
  } catch (err) {
    log.error('Failed to read pending approvals', { error: err instanceof Error ? err.message : String(err) })
    return []
  }
}

export async function updateApproval(id: string, status: 'approved' | 'denied'): Promise<OpsEntry | null> {
  if (!isDatabaseAvailable()) {
    const entry = memoryFeed.find((e) => e.id === id)
    if (entry) entry.approvalStatus = status
    return entry ?? null
  }

  try {
    const rows = await sql`
      UPDATE harper_ops_feed
      SET approval_status = ${status}
      WHERE id = ${id}::uuid
      RETURNING *
    `
    if (rows.length === 0) return null
    log.info(`Approval updated: ${id} → ${status}`)
    return mapRow(rows[0] as OpsRow)
  } catch (err) {
    log.error('Failed to update approval', { error: err instanceof Error ? err.message : String(err) })
    return null
  }
}

export async function getOpsStatus(): Promise<{
  alive: boolean
  lastHeartbeat: string | null
  pendingApprovals: number
  totalEntries: number
}> {
  if (!isDatabaseAvailable()) {
    const lastHb = memoryFeed.find((e) => e.actionType === 'heartbeat')
    return {
      alive: lastHb ? Date.now() - new Date(lastHb.createdAt!).getTime() < 10 * 60_000 : false,
      lastHeartbeat: lastHb?.createdAt ?? null,
      pendingApprovals: memoryFeed.filter((e) => e.requiresApproval && e.approvalStatus === 'pending').length,
      totalEntries: memoryFeed.length,
    }
  }

  try {
    const [hbRows, pendingRows, countRows] = await Promise.all([
      sql`
        SELECT created_at FROM harper_ops_feed
        WHERE action_type = 'heartbeat'
        ORDER BY created_at DESC LIMIT 1
      `,
      sql`SELECT COUNT(*)::int AS c FROM harper_ops_feed WHERE requires_approval = true AND approval_status = 'pending'`,
      sql`SELECT COUNT(*)::int AS c FROM harper_ops_feed`,
    ])

    const lastHb = hbRows.length > 0 ? (hbRows[0] as { created_at: string }).created_at : null
    const alive = lastHb ? Date.now() - new Date(lastHb).getTime() < 10 * 60_000 : false

    return {
      alive,
      lastHeartbeat: lastHb,
      pendingApprovals: (pendingRows[0] as { c: number }).c,
      totalEntries: (countRows[0] as { c: number }).c,
    }
  } catch (err) {
    log.error('Failed to get ops status', { error: err instanceof Error ? err.message : String(err) })
    return { alive: false, lastHeartbeat: null, pendingApprovals: 0, totalEntries: 0 }
  }
}
