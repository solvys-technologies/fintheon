// [claude-code 2026-04-03] Tool approval store — persistent permission memory + pending approval gate
/**
 * Tool Approval Store
 * Manages permanent tool permissions and pending approval requests.
 *
 * Permanent permissions are stored in a JSON file so they survive restarts.
 * Pending approvals use in-memory promises that resolve when the user
 * approves or denies via the frontend.
 *
 * Architecture:
 *   - Permanent store: ~/.fintheon/tool-permissions.json
 *   - Pending approvals: in-memory Map<approvalId, { resolve, toolName, input }>
 *   - Cognition emitter: side-channel to push approval requests to frontend SSE
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { homedir } from 'node:os'
import { createLogger } from '../lib/logger.js'
import { emitStep } from './cognition-emitter.js'

const log = createLogger('ToolApproval')

// ── Paths ─────────────────────────────────────────────────────────────────

const FINTHEON_DIR = resolve(homedir(), '.fintheon')
const PERMISSIONS_FILE = resolve(FINTHEON_DIR, 'tool-permissions.json')

// ── Types ─────────────────────────────────────────────────────────────────

export interface ToolPermission {
  toolName: string
  approvedAt: string      // ISO timestamp
  approvedBy: string      // 'user' | agent name
}

export interface PendingApproval {
  id: string
  requestId: string       // Harper chat requestId (for cognition emitter)
  toolName: string
  toolInput: Record<string, unknown>
  description: string     // Human-readable description of what the tool wants to do
  createdAt: number
  resolve: (decision: 'approved' | 'denied') => void
}

export type ApprovalDecision = 'approved' | 'denied'

// ── State ─────────────────────────────────────────────────────────────────

let permanentPermissions: Map<string, ToolPermission> = new Map()
const pendingApprovals: Map<string, PendingApproval> = new Map()

// ── Persistent Store ──────────────────────────────────────────────────────

async function ensureDir(): Promise<void> {
  try { await mkdir(FINTHEON_DIR, { recursive: true }) } catch { /* exists */ }
}

async function loadPermissions(): Promise<void> {
  try {
    const raw = await readFile(PERMISSIONS_FILE, 'utf8')
    const data = JSON.parse(raw) as ToolPermission[]
    permanentPermissions = new Map(data.map(p => [p.toolName, p]))
    log.info(`Loaded ${permanentPermissions.size} permanent tool permissions`)
  } catch {
    permanentPermissions = new Map()
    log.info('No existing tool permissions file — starting fresh')
  }
}

async function savePermissions(): Promise<void> {
  await ensureDir()
  const data = Array.from(permanentPermissions.values())
  await writeFile(PERMISSIONS_FILE, JSON.stringify(data, null, 2), 'utf8')
}

/** Initialize — load permissions from disk */
export async function initToolApprovalStore(): Promise<void> {
  await loadPermissions()
}

// ── Permission Checks ─────────────────────────────────────────────────────

/** Check if a tool has permanent approval */
export function isToolApproved(toolName: string): boolean {
  return permanentPermissions.has(toolName)
}

/** Grant permanent approval for a tool */
export async function grantPermission(toolName: string): Promise<void> {
  const permission: ToolPermission = {
    toolName,
    approvedAt: new Date().toISOString(),
    approvedBy: 'user',
  }
  permanentPermissions.set(toolName, permission)
  await savePermissions()
  log.info(`Permanent permission granted: ${toolName}`)
}

/** Revoke permission for a tool */
export async function revokePermission(toolName: string): Promise<void> {
  permanentPermissions.delete(toolName)
  await savePermissions()
  log.info(`Permission revoked: ${toolName}`)
}

/** Get all permanent permissions */
export function getAllPermissions(): ToolPermission[] {
  return Array.from(permanentPermissions.values())
}

// ── Pending Approvals ─────────────────────────────────────────────────────

/**
 * Request approval for a tool use.
 * Returns a promise that resolves with the user's decision.
 * Emits a cognition event so the frontend can display the approval card.
 */
export function requestApproval(
  requestId: string,
  toolName: string,
  toolInput: Record<string, unknown>,
  description: string,
): Promise<ApprovalDecision> {
  const id = `approval-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  return new Promise<ApprovalDecision>((resolvePromise) => {
    const pending: PendingApproval = {
      id,
      requestId,
      toolName,
      toolInput,
      description,
      createdAt: Date.now(),
      resolve: resolvePromise,
    }

    pendingApprovals.set(id, pending)

    // Emit cognition event for frontend
    emitStep(requestId, {
      kind: 'tool-approval-needed',
      label: `Permission required: ${toolName}`,
      detail: JSON.stringify({
        approvalId: id,
        toolName,
        toolInput,
        description,
      }),
    })

    log.info(`Approval requested: ${toolName} (${id})`, { description })
  })
}

/** Resolve a pending approval */
export async function resolveApproval(
  approvalId: string,
  decision: ApprovalDecision,
): Promise<{ found: boolean; toolName?: string }> {
  const pending = pendingApprovals.get(approvalId)
  if (!pending) {
    log.warn(`Approval not found: ${approvalId}`)
    return { found: false }
  }

  pendingApprovals.delete(approvalId)

  if (decision === 'approved') {
    // Grant permanent permission
    await grantPermission(pending.toolName)
  }

  // Emit resolution cognition event
  emitStep(pending.requestId, {
    kind: 'tool-approval-resolved',
    label: `${pending.toolName}: ${decision}`,
    detail: JSON.stringify({
      approvalId,
      toolName: pending.toolName,
      decision,
    }),
  })

  // Resolve the waiting promise
  pending.resolve(decision)

  log.info(`Approval resolved: ${pending.toolName} → ${decision} (${approvalId})`)
  return { found: true, toolName: pending.toolName }
}

/** Get all pending approvals (for debugging/status) */
export function getPendingApprovals(): Omit<PendingApproval, 'resolve'>[] {
  return Array.from(pendingApprovals.values()).map(({ resolve: _, ...rest }) => rest)
}
