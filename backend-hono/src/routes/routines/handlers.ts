// [claude-code 2026-04-19] S28: /rerun on a news-worker-audit trigger now executes the audit
//   inline (heartbeat check, heal, ops breadcrumb, superadmin escalation) instead of being a
//   paper-trail-only ack. Other triggerIds keep the original ops-feed-only behaviour.
// [claude-code 2026-04-19] Routines Console — REST handlers.

import type { Context } from "hono";
import { writeOpsEntry } from "../../services/harper-autonomous/ops-store.js";
import {
  listRoutines,
  getRoutine,
  isNewsWorkerAuditId,
} from "../../services/routines/registry.js";
import { runNewsWorkerAudit } from "../../services/routines/handlers/news-worker-audit.js";
import {
  getAllConfigs,
  getConfig,
  getLatestRun,
  getRecentRuns,
  listPendingApprovals,
  listPendingForTrigger,
  recordRun,
  resolveApproval as resolveApprovalRow,
  upsertConfig,
  type RoutineMode,
} from "../../services/routines/state-store.js";
import { shouldProceed } from "../../services/routines/error-handler.js";

const VALID_MODES: RoutineMode[] = [
  "infinite",
  "awaitReply",
  "completionChecks",
  "maxTurns",
];

// GET /api/routines — registry + per-routine state
export async function handleListRoutines(c: Context) {
  const configs = await getAllConfigs();
  const defs = listRoutines();
  const out = await Promise.all(
    defs.map(async (def) => {
      const cfg = configs.get(def.triggerId) ?? {
        triggerId: def.triggerId,
        mode: "infinite" as RoutineMode,
        maxTurns: 3,
        paused: false,
        notes: null,
        updatedAt: new Date(0).toISOString(),
        updatedBy: "system",
      };
      const [latest, pending] = await Promise.all([
        getLatestRun(def.triggerId),
        listPendingForTrigger(def.triggerId),
      ]);
      return {
        definition: def,
        config: cfg,
        latestRun: latest,
        pendingApprovals: pending.length,
      };
    }),
  );
  return c.json({ routines: out });
}

// GET /api/routines/:id — full detail incl. recent run history
export async function handleGetRoutine(c: Context) {
  const id = c.req.param("id");
  const def = getRoutine(id);
  if (!def) return c.json({ error: "Unknown trigger_id" }, 404);

  const [cfg, runs, pending] = await Promise.all([
    getConfig(id),
    getRecentRuns(id, 20),
    listPendingForTrigger(id),
  ]);

  return c.json({
    definition: def,
    config: cfg,
    runs,
    pendingApprovals: pending,
  });
}

// PUT /api/routines/:id/mode — change mode + optional maxTurns
export async function handleSetMode(c: Context) {
  const id = c.req.param("id");
  if (!getRoutine(id)) return c.json({ error: "Unknown trigger_id" }, 404);

  const body = await c.req
    .json<{ mode?: RoutineMode; maxTurns?: number; notes?: string }>()
    .catch(() => null);
  if (!body || !body.mode) {
    return c.json({ error: "mode required" }, 400);
  }
  if (!VALID_MODES.includes(body.mode)) {
    return c.json(
      { error: `mode must be one of ${VALID_MODES.join(", ")}` },
      400,
    );
  }

  const updated = await upsertConfig(id, {
    mode: body.mode,
    maxTurns: typeof body.maxTurns === "number" ? body.maxTurns : undefined,
    notes: body.notes,
  });
  return c.json({ config: updated });
}

// POST /api/routines/:id/pause — toggle paused
export async function handlePause(c: Context) {
  const id = c.req.param("id");
  if (!getRoutine(id)) return c.json({ error: "Unknown trigger_id" }, 404);

  const body = await c.req
    .json<{ paused?: boolean }>()
    .catch(() => ({ paused: undefined }));
  const current = await getConfig(id);
  const next =
    typeof body?.paused === "boolean" ? body.paused : !current.paused;

  const updated = await upsertConfig(id, { paused: next });
  return c.json({ config: updated });
}

// POST /api/routines/:id/rerun — manual trigger.
// For HEAL routines (news-worker audits) this executes the audit handler inline and returns
// the snapshot. For MOVE/AUGMENT routines we can't invoke the cloud-side Routine from here, so
// we record the intent + post an ops-feed entry as a paper trail for the next scheduled run.
export async function handleRerun(c: Context) {
  const id = c.req.param("id");
  const def = getRoutine(id);
  if (!def) return c.json({ error: "Unknown trigger_id" }, 404);

  const decision = await shouldProceed(id);

  if (isNewsWorkerAuditId(id) && decision.proceed) {
    const result = await runNewsWorkerAudit({
      auditName: def.name,
      triggerId: def.triggerId,
    });
    return c.json({ ok: true, decision, audit: result });
  }

  await writeOpsEntry({
    actionType: "routine",
    title: `Manual rerun requested: ${def.name}`,
    detail: decision.proceed
      ? "Operator-triggered rerun queued."
      : `Rerun blocked: ${decision.reason}`,
    severity: decision.proceed ? "info" : "warning",
    metadata: {
      routineId: def.triggerId,
      routineName: def.name,
      source: "routines-console",
      manual: true,
      decision,
    },
  });

  await recordRun({
    triggerId: id,
    status: decision.proceed ? "ok" : "degraded",
    severity: decision.proceed ? "info" : "warning",
    title: `Manual rerun: ${def.name}`,
    detail: decision.reason,
  });

  return c.json({ ok: true, decision });
}

// GET /api/routines/approvals/pending — global pending list (mobile + desktop)
export async function handlePendingApprovals(c: Context) {
  const approvals = await listPendingApprovals();
  return c.json({ approvals });
}

// POST /api/routines/approvals/:id/approve|deny
export async function handleResolveApproval(c: Context) {
  const id = c.req.param("id");
  const action = c.req.param("action");
  if (action !== "approve" && action !== "deny") {
    return c.json({ error: "action must be approve or deny" }, 400);
  }
  const status = action === "approve" ? "approved" : "denied";

  const body = await c.req
    .json<{ resolvedBy?: string }>()
    .catch(() => ({ resolvedBy: undefined }));
  const resolver = body?.resolvedBy ?? "superadmin";

  const resolved = await resolveApprovalRow(id, status, resolver);
  if (!resolved) return c.json({ error: "Approval not found" }, 404);

  const def = getRoutine(resolved.triggerId);
  await writeOpsEntry({
    actionType: "ack",
    title: `Routine ${status}: ${def?.name ?? resolved.triggerId}`,
    detail: `Resolved by ${resolver}`,
    severity: "info",
    metadata: {
      routineId: resolved.triggerId,
      routineName: def?.name,
      source: "routines-console",
      approvalId: resolved.id,
      decision: status,
    },
  });

  return c.json({ approval: resolved });
}
