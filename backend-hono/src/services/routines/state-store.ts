// [claude-code 2026-04-19] Routines Console — Supabase persistence for config, runs, approvals.
// Mirrors the harper_ops_feed pattern: in-memory fallback when DB unavailable so the operator
// surface still functions in fully-local dev.

import { sql, isDatabaseAvailable } from "../../config/database.js";
import { createLogger } from "../../lib/logger.js";

const log = createLogger("RoutinesStore");

// ── Types ──────────────────────────────────────────────────────────────────

export type RoutineMode =
  | "infinite"
  | "awaitReply"
  | "completionChecks"
  | "maxTurns";

export type RoutineRunStatus = "ok" | "degraded" | "failed";
export type RoutineSeverity = "info" | "warning" | "critical";
export type ApprovalStatus = "pending" | "approved" | "denied";

export interface RoutineConfig {
  triggerId: string;
  mode: RoutineMode;
  maxTurns: number;
  paused: boolean;
  notes: string | null;
  updatedAt: string;
  updatedBy: string;
}

export interface RoutineRun {
  id: string;
  triggerId: string;
  status: RoutineRunStatus;
  severity: RoutineSeverity;
  title: string;
  detail: string | null;
  opsEntryId: string | null;
  turnCount: number;
  errorMessage: string | null;
  createdAt: string;
}

export interface RoutineApproval {
  id: string;
  triggerId: string;
  routineRunId: string | null;
  opsEntryId: string | null;
  title: string;
  payload: Record<string, unknown>;
  status: ApprovalStatus;
  resolvedAt: string | null;
  resolvedBy: string | null;
  createdAt: string;
}

// ── In-memory fallback ─────────────────────────────────────────────────────

const memConfig = new Map<string, RoutineConfig>();
const memRuns: RoutineRun[] = [];
const memApprovals: RoutineApproval[] = [];
const MEM_RUN_MAX = 500;

function defaultConfig(triggerId: string): RoutineConfig {
  return {
    triggerId,
    mode: "infinite",
    maxTurns: 3,
    paused: false,
    notes: null,
    updatedAt: new Date().toISOString(),
    updatedBy: "system",
  };
}

// ── Init ────────────────────────────────────────────────────────────────────

export async function initRoutinesStore(): Promise<void> {
  if (!isDatabaseAvailable()) {
    log.info("Routines store using in-memory fallback (no DB)");
    return;
  }
  try {
    await sql`SELECT 1 FROM routine_config LIMIT 1`;
    log.info("Routines store ready (Supabase)");
  } catch (err) {
    log.warn("routine_config table not reachable — falling back to memory", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

// ── Config ──────────────────────────────────────────────────────────────────

function mapConfig(row: Record<string, unknown>): RoutineConfig {
  return {
    triggerId: row.trigger_id as string,
    mode: row.mode as RoutineMode,
    maxTurns: Number(row.max_turns ?? 3),
    paused: Boolean(row.paused),
    notes: (row.notes as string | null) ?? null,
    updatedAt: row.updated_at as string,
    updatedBy: (row.updated_by as string) ?? "system",
  };
}

export async function getConfig(triggerId: string): Promise<RoutineConfig> {
  if (!isDatabaseAvailable()) {
    return memConfig.get(triggerId) ?? defaultConfig(triggerId);
  }
  try {
    const rows = await sql`
      SELECT * FROM routine_config WHERE trigger_id = ${triggerId} LIMIT 1
    `;
    if (rows.length === 0) return defaultConfig(triggerId);
    return mapConfig(rows[0] as Record<string, unknown>);
  } catch (err) {
    log.error("getConfig failed", {
      triggerId,
      error: err instanceof Error ? err.message : String(err),
    });
    return memConfig.get(triggerId) ?? defaultConfig(triggerId);
  }
}

export async function getAllConfigs(): Promise<Map<string, RoutineConfig>> {
  if (!isDatabaseAvailable()) {
    return new Map(memConfig);
  }
  try {
    const rows = await sql`SELECT * FROM routine_config`;
    const out = new Map<string, RoutineConfig>();
    for (const row of rows) {
      const cfg = mapConfig(row as Record<string, unknown>);
      out.set(cfg.triggerId, cfg);
    }
    return out;
  } catch (err) {
    log.error("getAllConfigs failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return new Map(memConfig);
  }
}

export async function upsertConfig(
  triggerId: string,
  patch: Partial<Pick<RoutineConfig, "mode" | "maxTurns" | "paused" | "notes">>,
  updatedBy = "api",
): Promise<RoutineConfig> {
  const current = await getConfig(triggerId);
  const next: RoutineConfig = {
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
    updatedBy,
  };

  if (!isDatabaseAvailable()) {
    memConfig.set(triggerId, next);
    return next;
  }

  try {
    const rows = await sql`
      INSERT INTO routine_config
        (trigger_id, mode, max_turns, paused, notes, updated_at, updated_by)
      VALUES
        (${next.triggerId}, ${next.mode}, ${next.maxTurns}, ${next.paused},
         ${next.notes}, ${next.updatedAt}, ${next.updatedBy})
      ON CONFLICT (trigger_id) DO UPDATE SET
        mode = EXCLUDED.mode,
        max_turns = EXCLUDED.max_turns,
        paused = EXCLUDED.paused,
        notes = EXCLUDED.notes,
        updated_at = EXCLUDED.updated_at,
        updated_by = EXCLUDED.updated_by
      RETURNING *
    `;
    return mapConfig(rows[0] as Record<string, unknown>);
  } catch (err) {
    log.error("upsertConfig failed", {
      triggerId,
      error: err instanceof Error ? err.message : String(err),
    });
    memConfig.set(triggerId, next);
    return next;
  }
}

// ── Runs ────────────────────────────────────────────────────────────────────

function mapRun(row: Record<string, unknown>): RoutineRun {
  return {
    id: row.id as string,
    triggerId: row.trigger_id as string,
    status: row.status as RoutineRunStatus,
    severity: row.severity as RoutineSeverity,
    title: row.title as string,
    detail: (row.detail as string | null) ?? null,
    opsEntryId: (row.ops_entry_id as string | null) ?? null,
    turnCount: Number(row.turn_count ?? 1),
    errorMessage: (row.error_message as string | null) ?? null,
    createdAt: row.created_at as string,
  };
}

export interface RecordRunInput {
  triggerId: string;
  status: RoutineRunStatus;
  severity: RoutineSeverity;
  title: string;
  detail?: string | null;
  opsEntryId?: string | null;
  turnCount?: number;
  errorMessage?: string | null;
}

export async function recordRun(input: RecordRunInput): Promise<RoutineRun> {
  const run: RoutineRun = {
    id: crypto.randomUUID(),
    triggerId: input.triggerId,
    status: input.status,
    severity: input.severity,
    title: input.title,
    detail: input.detail ?? null,
    opsEntryId: input.opsEntryId ?? null,
    turnCount: input.turnCount ?? 1,
    errorMessage: input.errorMessage ?? null,
    createdAt: new Date().toISOString(),
  };

  if (!isDatabaseAvailable()) {
    memRuns.unshift(run);
    if (memRuns.length > MEM_RUN_MAX) memRuns.pop();
    return run;
  }

  try {
    const rows = await sql`
      INSERT INTO routine_runs
        (trigger_id, status, severity, title, detail, ops_entry_id, turn_count, error_message)
      VALUES
        (${run.triggerId}, ${run.status}, ${run.severity}, ${run.title},
         ${run.detail}, ${run.opsEntryId}, ${run.turnCount}, ${run.errorMessage})
      RETURNING *
    `;
    return mapRun(rows[0] as Record<string, unknown>);
  } catch (err) {
    log.error("recordRun failed", {
      triggerId: input.triggerId,
      error: err instanceof Error ? err.message : String(err),
    });
    memRuns.unshift(run);
    return run;
  }
}

export async function getRecentRuns(
  triggerId: string,
  limit = 10,
): Promise<RoutineRun[]> {
  if (!isDatabaseAvailable()) {
    return memRuns.filter((r) => r.triggerId === triggerId).slice(0, limit);
  }
  try {
    const rows = await sql`
      SELECT * FROM routine_runs
      WHERE trigger_id = ${triggerId}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;
    return rows.map((r) => mapRun(r as Record<string, unknown>));
  } catch (err) {
    log.error("getRecentRuns failed", {
      triggerId,
      error: err instanceof Error ? err.message : String(err),
    });
    return memRuns.filter((r) => r.triggerId === triggerId).slice(0, limit);
  }
}

export async function getLatestRun(
  triggerId: string,
): Promise<RoutineRun | null> {
  const runs = await getRecentRuns(triggerId, 1);
  return runs[0] ?? null;
}

export async function countRecentFailures(
  triggerId: string,
  windowMs: number,
): Promise<number> {
  const cutoff = new Date(Date.now() - windowMs).toISOString();
  if (!isDatabaseAvailable()) {
    return memRuns.filter(
      (r) =>
        r.triggerId === triggerId && r.status !== "ok" && r.createdAt >= cutoff,
    ).length;
  }
  try {
    const rows = await sql`
      SELECT COUNT(*)::int AS c FROM routine_runs
      WHERE trigger_id = ${triggerId}
        AND status != 'ok'
        AND created_at >= ${cutoff}
    `;
    return (rows[0] as { c: number }).c ?? 0;
  } catch {
    return 0;
  }
}

// ── Approvals ──────────────────────────────────────────────────────────────

function mapApproval(row: Record<string, unknown>): RoutineApproval {
  return {
    id: row.id as string,
    triggerId: row.trigger_id as string,
    routineRunId: (row.routine_run_id as string | null) ?? null,
    opsEntryId: (row.ops_entry_id as string | null) ?? null,
    title: row.title as string,
    payload: (row.payload as Record<string, unknown>) ?? {},
    status: row.status as ApprovalStatus,
    resolvedAt: (row.resolved_at as string | null) ?? null,
    resolvedBy: (row.resolved_by as string | null) ?? null,
    createdAt: row.created_at as string,
  };
}

export interface CreateApprovalInput {
  triggerId: string;
  title: string;
  payload?: Record<string, unknown>;
  routineRunId?: string | null;
  opsEntryId?: string | null;
}

export async function createApproval(
  input: CreateApprovalInput,
): Promise<RoutineApproval> {
  const approval: RoutineApproval = {
    id: crypto.randomUUID(),
    triggerId: input.triggerId,
    routineRunId: input.routineRunId ?? null,
    opsEntryId: input.opsEntryId ?? null,
    title: input.title,
    payload: input.payload ?? {},
    status: "pending",
    resolvedAt: null,
    resolvedBy: null,
    createdAt: new Date().toISOString(),
  };

  if (!isDatabaseAvailable()) {
    memApprovals.unshift(approval);
    return approval;
  }

  try {
    const rows = await sql`
      INSERT INTO routine_approvals
        (trigger_id, routine_run_id, ops_entry_id, title, payload, status)
      VALUES
        (${approval.triggerId}, ${approval.routineRunId}, ${approval.opsEntryId},
         ${approval.title}, ${JSON.stringify(approval.payload)}::jsonb, 'pending')
      RETURNING *
    `;
    return mapApproval(rows[0] as Record<string, unknown>);
  } catch (err) {
    log.error("createApproval failed", {
      triggerId: input.triggerId,
      error: err instanceof Error ? err.message : String(err),
    });
    memApprovals.unshift(approval);
    return approval;
  }
}

export async function listPendingApprovals(): Promise<RoutineApproval[]> {
  if (!isDatabaseAvailable()) {
    return memApprovals.filter((a) => a.status === "pending");
  }
  try {
    const rows = await sql`
      SELECT * FROM routine_approvals
      WHERE status = 'pending'
      ORDER BY created_at DESC
    `;
    return rows.map((r) => mapApproval(r as Record<string, unknown>));
  } catch (err) {
    log.error("listPendingApprovals failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return memApprovals.filter((a) => a.status === "pending");
  }
}

export async function listPendingForTrigger(
  triggerId: string,
): Promise<RoutineApproval[]> {
  if (!isDatabaseAvailable()) {
    return memApprovals.filter(
      (a) => a.triggerId === triggerId && a.status === "pending",
    );
  }
  try {
    const rows = await sql`
      SELECT * FROM routine_approvals
      WHERE trigger_id = ${triggerId} AND status = 'pending'
      ORDER BY created_at DESC
    `;
    return rows.map((r) => mapApproval(r as Record<string, unknown>));
  } catch {
    return [];
  }
}

export async function resolveApproval(
  id: string,
  status: "approved" | "denied",
  resolvedBy: string,
): Promise<RoutineApproval | null> {
  if (!isDatabaseAvailable()) {
    const idx = memApprovals.findIndex((a) => a.id === id);
    if (idx === -1) return null;
    memApprovals[idx] = {
      ...memApprovals[idx],
      status,
      resolvedAt: new Date().toISOString(),
      resolvedBy,
    };
    return memApprovals[idx];
  }
  try {
    const rows = await sql`
      UPDATE routine_approvals
      SET status = ${status},
          resolved_at = NOW(),
          resolved_by = ${resolvedBy}
      WHERE id = ${id}::uuid AND status = 'pending'
      RETURNING *
    `;
    if (rows.length === 0) return null;
    return mapApproval(rows[0] as Record<string, unknown>);
  } catch (err) {
    log.error("resolveApproval failed", {
      id,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}
