// [claude-code 2026-05-07] S61-T1: Integrated audit logger into resolveApproval, grantPermission,
//   revokePermission, and 30s timeout handler. Every decision emits an immutable audit record.
// [claude-code 2026-04-19] S25: push now carries lock-screen actions (Approve/Deny) + approvalId.
//   Added getApprovalById + getApprovalExpiresAt exports for the mobile DetailSheet to render
//   a live countdown without refetching the full pending list.
// [claude-code 2026-04-04] Added 30s auto-approve timeout so agentic loop never hangs indefinitely
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

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { homedir } from "node:os";
import { createLogger } from "../lib/logger.js";
import { emitStep } from "./cognition-emitter.js";
import { logAuditDecision } from "./audit-logger.js";

const log = createLogger("ToolApproval");

// ── Paths ─────────────────────────────────────────────────────────────────

const FINTHEON_DIR = resolve(homedir(), ".fintheon");
const PERMISSIONS_FILE = resolve(FINTHEON_DIR, "tool-permissions.json");

// ── Types ─────────────────────────────────────────────────────────────────

export interface ToolPermission {
  toolName: string;
  approvedAt: string; // ISO timestamp
  approvedBy: string; // 'user' | agent name
}

export interface PendingApproval {
  id: string;
  requestId: string; // Harper chat requestId (for cognition emitter)
  toolName: string;
  toolInput: Record<string, unknown>;
  description: string; // Human-readable description of what the tool wants to do
  createdAt: number;
  resolve: (decision: "approved" | "denied") => void;
}

export type ApprovalDecision = "approved" | "denied";

// ── State ─────────────────────────────────────────────────────────────────

let permanentPermissions: Map<string, ToolPermission> = new Map();
const pendingApprovals: Map<string, PendingApproval> = new Map();

// ── Persistent Store ──────────────────────────────────────────────────────

async function ensureDir(): Promise<void> {
  try {
    await mkdir(FINTHEON_DIR, { recursive: true });
  } catch {
    /* exists */
  }
}

async function loadPermissions(): Promise<void> {
  try {
    const raw = await readFile(PERMISSIONS_FILE, "utf8");
    const data = JSON.parse(raw) as ToolPermission[];
    permanentPermissions = new Map(data.map((p) => [p.toolName, p]));
    log.info(`Loaded ${permanentPermissions.size} permanent tool permissions`);
  } catch {
    permanentPermissions = new Map();
    log.info("No existing tool permissions file — starting fresh");
  }
}

async function savePermissions(): Promise<void> {
  await ensureDir();
  const data = Array.from(permanentPermissions.values());
  await writeFile(PERMISSIONS_FILE, JSON.stringify(data, null, 2), "utf8");
}

/** Initialize — load permissions from disk */
export async function initToolApprovalStore(): Promise<void> {
  await loadPermissions();
}

// ── Permission Checks ─────────────────────────────────────────────────────

/** Check if a tool has permanent approval */
export function isToolApproved(toolName: string): boolean {
  return permanentPermissions.has(toolName);
}

/** Grant permanent approval for a tool */
export async function grantPermission(toolName: string): Promise<void> {
  const permission: ToolPermission = {
    toolName,
    approvedAt: new Date().toISOString(),
    approvedBy: "user",
  };
  permanentPermissions.set(toolName, permission);
  await savePermissions();
  log.info(`Permanent permission granted: ${toolName}`);
  logAuditDecision({
    agent_id: "system",
    tool_name: "permission_grant",
    tool_input: { target_tool: toolName },
    description: `Permanent permission granted for ${toolName}`,
    surface: "settings",
    decision: "approved",
  }).catch((err: unknown) => log.error("audit write failed", { error: String(err) }));
}

/** Revoke permission for a tool */
export async function revokePermission(toolName: string): Promise<void> {
  permanentPermissions.delete(toolName);
  await savePermissions();
  log.info(`Permission revoked: ${toolName}`);
  logAuditDecision({
    agent_id: "system",
    tool_name: "permission_revoke",
    tool_input: { target_tool: toolName },
    description: `Permission revoked for ${toolName}`,
    surface: "settings",
    decision: "denied",
  }).catch((err: unknown) => log.error("audit write failed", { error: String(err) }));
}

/** Get all permanent permissions */
export function getAllPermissions(): ToolPermission[] {
  return Array.from(permanentPermissions.values());
}

// ── Pending Approvals ─────────────────────────────────────────────────────

/**
 * Request approval for a tool use.
 * Returns a promise that resolves with the user's decision.
 * Emits a cognition event so the frontend can display the approval card.
 */
/** How long to wait for user decision before auto-approving (ms) */
const APPROVAL_TIMEOUT_MS = 30_000;

export function requestApproval(
  requestId: string,
  toolName: string,
  toolInput: Record<string, unknown>,
  description: string,
  opts?: { noTimeout?: boolean; userId?: string },
): Promise<ApprovalDecision> {
  const id = `approval-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  return new Promise<ApprovalDecision>((resolvePromise) => {
    let settled = false;
    const settle = (decision: ApprovalDecision) => {
      if (settled) return;
      settled = true;
      resolvePromise(decision);
    };

    const pending: PendingApproval = {
      id,
      requestId,
      toolName,
      toolInput,
      description,
      createdAt: Date.now(),
      resolve: settle,
    };

    pendingApprovals.set(id, pending);

    // Emit cognition event for frontend
    emitStep(requestId, {
      kind: "tool-approval-needed",
      label: `Permission required: ${toolName}`,
      detail: JSON.stringify({
        approvalId: id,
        toolName,
        toolInput,
        description,
      }),
    });

    // [claude-code 2026-04-18] A3: push notification on approval needed.
    // Relay-originated requests (noTimeout + userId) block waiting for mobile; those need a push.
    // Non-relay (short-timeout) requests skip push — auto-approve kicks in before user acts.
    if (opts?.userId && opts?.noTimeout) {
      void (async () => {
        try {
          const { emitPushAndLog } = await import("./notifications/emit.js");
          await emitPushAndLog({
            userId: opts.userId!,
            category: "toolApprovals",
            severity: "high",
            title: `Approval needed: ${toolName}`,
            body: description || `Harper wants to use ${toolName}`,
            url: `/apparatus/approvals/${id}`,
            fingerprint: `approval:${id}`,
            eventId: id,
            approvalId: id,
            // [S25] Lock-screen action buttons. SW interprets these via event.action and
            // fires a no-auth POST /api/relay/tool-decision-quick using the approvalId.
            actions: [
              { action: "approve", title: "Approve" },
              { action: "deny", title: "Deny" },
            ],
            metadata: { approvalId: id, toolName, requestId },
          });
        } catch (err) {
          log.warn("Approval push failed (non-fatal)", { error: String(err) });
        }
      })();
    }

    log.info(`Approval requested: ${toolName} (${id})`, { description });

    // Auto-approve after timeout so the agentic loop never hangs indefinitely
    // Relay-originated requests block indefinitely — mobile user decides
    if (!opts?.noTimeout) {
      setTimeout(async () => {
        if (settled) return;
        log.warn(`Approval timeout — auto-approving: ${toolName} (${id})`);
        pendingApprovals.delete(id);
        await grantPermission(toolName);
        emitStep(requestId, {
          kind: "tool-approval-resolved",
          label: `${toolName}: approved (auto)`,
          detail: JSON.stringify({
            approvalId: id,
            toolName,
            decision: "approved",
            auto: true,
          }),
        });
        logAuditDecision({
          agent_id: "system",
          tool_name: toolName,
          tool_input: toolInput,
          description,
          surface: "chat",
          correlation_id: requestId,
          decision: "timed_out",
          reason: `Auto-approved after ${APPROVAL_TIMEOUT_MS}ms timeout`,
        }).catch((err: unknown) => log.error("audit write failed", { error: String(err) }));
        settle("approved");
      }, APPROVAL_TIMEOUT_MS);
    }
  });
}

/** Resolve a pending approval */
export async function resolveApproval(
  approvalId: string,
  decision: ApprovalDecision,
): Promise<{ found: boolean; toolName?: string }> {
  const pending = pendingApprovals.get(approvalId);
  if (!pending) {
    log.warn(`Approval not found: ${approvalId}`);
    return { found: false };
  }

  pendingApprovals.delete(approvalId);

  if (decision === "approved") {
    // Grant permanent permission
    await grantPermission(pending.toolName);
  }

  // Emit resolution cognition event
  emitStep(pending.requestId, {
    kind: "tool-approval-resolved",
    label: `${pending.toolName}: ${decision}`,
    detail: JSON.stringify({
      approvalId,
      toolName: pending.toolName,
      decision,
    }),
  });

  // Resolve the waiting promise
  pending.resolve(decision);

  logAuditDecision({
    agent_id: "system",
    tool_name: pending.toolName,
    tool_input: pending.toolInput,
    description: pending.description,
    surface: "chat",
    correlation_id: pending.requestId ?? pending.id,
    decision,
  }).catch((err: unknown) => log.error("audit write failed", { error: String(err) }));

  log.info(
    `Approval resolved: ${pending.toolName} → ${decision} (${approvalId})`,
  );
  return { found: true, toolName: pending.toolName };
}

/** Get all pending approvals (for debugging/status) */
export function getPendingApprovals(): Omit<PendingApproval, "resolve">[] {
  return Array.from(pendingApprovals.values()).map(
    ({ resolve: _, ...rest }) => rest,
  );
}

/**
 * [S25] Get one pending approval by id + its effective expiresAt (for countdown UI).
 * Returns null if the approval is missing (already resolved, expired, or never existed).
 * Relay-originated approvals (noTimeout) have `expiresAt: null` — block indefinitely.
 */
export function getApprovalById(id: string): {
  approval: Omit<PendingApproval, "resolve">;
  expiresAt: number | null;
} | null {
  const pending = pendingApprovals.get(id);
  if (!pending) return null;
  const { resolve: _resolve, ...rest } = pending;
  // Heuristic: approvals without a resolve-timer (relay dispatch path) keep `noTimeout` state
  // implicit. We can't read the timer directly, so we treat approvals older than APPROVAL_TIMEOUT_MS
  // as "noTimeout=true" (relay path) since the timer-path ones auto-resolve before then.
  const age = Date.now() - pending.createdAt;
  const expiresAt =
    age > APPROVAL_TIMEOUT_MS ? null : pending.createdAt + APPROVAL_TIMEOUT_MS;
  return { approval: rest, expiresAt };
}

/** [S25] True if the approval exists — used by tool-decision-quick to validate freshness. */
export function hasPendingApproval(id: string): boolean {
  return pendingApprovals.has(id);
}
