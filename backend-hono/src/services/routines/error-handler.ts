// [claude-code 2026-04-19] Routines Console — per-mode error policy.
// Decides: should the next scheduled run proceed, or is this routine locked / awaiting reply?

import { createLogger } from "../../lib/logger.js";
import { writeOpsEntry } from "../harper-autonomous/ops-store.js";
import { getRoutine } from "./registry.js";
import {
  countRecentFailures,
  createApproval,
  getConfig,
  listPendingForTrigger,
  type RoutineRun,
  type RoutineConfig,
} from "./state-store.js";

const log = createLogger("RoutinesError");

const FAILURE_WINDOW_MS = 24 * 60 * 60 * 1000; // 24h

export interface NextRunDecision {
  proceed: boolean;
  reason: string;
}

/**
 * Decides whether a routine's next scheduled invocation should run.
 * Called by routines (and by the manual rerun endpoint) before doing work.
 */
export async function shouldProceed(
  triggerId: string,
): Promise<NextRunDecision> {
  const cfg = await getConfig(triggerId);

  if (cfg.paused) {
    return { proceed: false, reason: "paused by operator" };
  }

  if (cfg.mode === "awaitReply") {
    const pending = await listPendingForTrigger(triggerId);
    if (pending.length > 0) {
      return {
        proceed: false,
        reason: `awaiting Superadmin approval (${pending.length} pending)`,
      };
    }
  }

  if (cfg.mode === "maxTurns") {
    const failures = await countRecentFailures(triggerId, FAILURE_WINDOW_MS);
    if (failures >= cfg.maxTurns) {
      return {
        proceed: false,
        reason: `maxTurns (${cfg.maxTurns}) failure budget exhausted`,
      };
    }
  }

  return { proceed: true, reason: "ok" };
}

/**
 * Apply the configured mode policy to a finished run.
 * - awaitReply: every run blocks until Superadmin clears it.
 * - completionChecks: degraded → log a warning so the next run knows to retry.
 * - maxTurns: count consecutive failures; lock + escalate when budget hit.
 * - infinite: no-op.
 */
export async function applyPostRunPolicy(
  run: RoutineRun,
  cfg: RoutineConfig,
): Promise<void> {
  const def = getRoutine(run.triggerId);
  const label = def?.name ?? run.triggerId;

  if (cfg.mode === "awaitReply") {
    await createApproval({
      triggerId: run.triggerId,
      title: run.title,
      payload: {
        runId: run.id,
        severity: run.severity,
        detail: run.detail,
      },
      routineRunId: run.id,
      opsEntryId: run.opsEntryId,
    });
    log.info("awaitReply approval created", { triggerId: run.triggerId });
    return;
  }

  if (cfg.mode === "completionChecks" && run.status !== "ok") {
    log.warn("completionChecks: routine returned degraded/failed", {
      triggerId: run.triggerId,
      status: run.status,
    });
    return;
  }

  if (cfg.mode === "maxTurns" && run.status !== "ok") {
    const failures = await countRecentFailures(
      run.triggerId,
      FAILURE_WINDOW_MS,
    );
    if (failures >= cfg.maxTurns) {
      await writeOpsEntry({
        actionType: "alert",
        title: `Routine locked: ${label}`,
        detail: `maxTurns budget (${cfg.maxTurns}) exhausted in last 24h. Manual intervention required.`,
        severity: "critical",
        metadata: {
          routineId: run.triggerId,
          routineName: label,
          source: "routines-console",
          reason: "maxTurns-exhausted",
        },
      });
    }
  }
}
