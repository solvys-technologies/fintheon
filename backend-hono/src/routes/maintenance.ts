// [claude-code 2026-04-19] S26-P2 T9: maintenance request route — super-admin gated
//   commit/deploy/deny decisions for agent-proposed maintenance items per TP. The
//   orchestration layer (actual git commit + solvys-deploy trigger) is deferred to
//   a follow-up sprint; this endpoint stubs action execution with structured
//   logging + Supabase persistence so the 3-button flow is wired end-to-end.
//
//   Routes:
//     GET  /api/maintenance/request/:id   → fetch stored request (public)
//     POST /api/maintenance/decision      → super-admin decision (approve_commit | approve_and_deploy | deny)
//
//   Storage: when Supabase is available, decisions persist to `maintenance_decisions`
//   and requests to `maintenance_requests`. When Supabase isn't configured, both
//   fall through to an in-memory Map so local dev still exercises the modal.
import { Hono } from "hono";
import { getSupabaseClient, isSupabaseConfigured } from "../config/supabase.js";
import { createLogger } from "../lib/logger.js";

const log = createLogger("Maintenance");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AppEnv = { Variables: { userId: string; email: string; auth: any } };

type Severity = "low" | "medium" | "high" | "critical";
type Action = "approve_commit" | "approve_and_deploy" | "deny";

export interface MaintenanceRequest {
  id: string;
  issuePreview: string;
  fixDescription: string;
  severity: Severity;
  createdAt: string;
  sourceCommit?: string;
}

/** In-memory fallback so the feature works without Supabase config. */
const memoryRequests = new Map<string, MaintenanceRequest>();
const memoryDecisions: Array<{
  requestId: string;
  action: Action;
  userId: string;
  decidedAt: string;
}> = [];

// Seed one sample request in dev so the modal renders without a real backing service.
if (
  !isSupabaseConfigured() &&
  process.env.NODE_ENV !== "production" &&
  memoryRequests.size === 0
) {
  memoryRequests.set("sample-1", {
    id: "sample-1",
    issuePreview:
      "RiskFlow poller stalled — Rettiwt pool drained after a 429 storm from the Reuters mirror.",
    fixDescription:
      "Bumped the Reuters backoff from 15s → 60s and rotated the next Rettiwt key forward on every 5xx.",
    severity: "high",
    createdAt: new Date().toISOString(),
    sourceCommit: "f33dfa2",
  });
}

function isActionValid(a: unknown): a is Action {
  return a === "approve_commit" || a === "approve_and_deploy" || a === "deny";
}

async function isSuperAdmin(userId: string | undefined): Promise<boolean> {
  if (!userId) return false;
  // Prefer the env allow-list when present (deployed prod path).
  const envAllow = (process.env.SUPER_ADMIN_USER_ID || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (envAllow.length > 0 && envAllow.includes(userId)) return true;
  // Otherwise fall back to the peer-registry role the rescore-all endpoint uses.
  try {
    const { getUserById } = await import("../services/peers/peer-registry.js");
    const user = await getUserById(userId);
    return Boolean(user && user.role === "admin");
  } catch {
    return false;
  }
}

async function loadRequest(id: string): Promise<MaintenanceRequest | null> {
  if (isSupabaseConfigured()) {
    const client = getSupabaseClient();
    if (!client) return memoryRequests.get(id) ?? null;
    try {
      const { data, error } = await client
        .from("maintenance_requests")
        .select(
          "id, issue_preview, fix_description, severity, created_at, source_commit",
        )
        .eq("id", id)
        .single();
      if (error || !data) return memoryRequests.get(id) ?? null;
      return {
        id: data.id,
        issuePreview: data.issue_preview,
        fixDescription: data.fix_description,
        severity: (data.severity as Severity) || "medium",
        createdAt: data.created_at,
        sourceCommit: data.source_commit ?? undefined,
      };
    } catch (err) {
      log.warn("Failed to load maintenance request", {
        id,
        error: err instanceof Error ? err.message : String(err),
      });
      return memoryRequests.get(id) ?? null;
    }
  }
  return memoryRequests.get(id) ?? null;
}

async function recordDecision(
  requestId: string,
  action: Action,
  userId: string,
): Promise<void> {
  const decidedAt = new Date().toISOString();
  if (isSupabaseConfigured()) {
    const client = getSupabaseClient();
    if (client) {
      try {
        await client.from("maintenance_decisions").insert({
          request_id: requestId,
          action,
          user_id: userId,
          decided_at: decidedAt,
        });
        return;
      } catch (err) {
        log.warn("Failed to persist decision — falling through to memory log", {
          requestId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }
  memoryDecisions.push({ requestId, action, userId, decidedAt });
}

export function createMaintenanceRoutes() {
  const router = new Hono<AppEnv>();

  router.get("/request/:id", async (c) => {
    const id = c.req.param("id");
    if (!id) return c.json({ error: "id required" }, 400);
    const req = await loadRequest(id);
    if (!req) return c.json({ error: "not found" }, 404);
    return c.json({ request: req });
  });

  router.post("/decision", async (c) => {
    const userId = c.get("userId") as string | undefined;
    // authMiddleware fills userId with "anonymous" when no JWT is present, so we
    // treat that as unauthenticated (401) rather than letting it fall into the
    // admin check (which would 403 — confusing for API consumers).
    if (!userId || userId === "anonymous") {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const admin = await isSuperAdmin(userId);
    if (!admin) {
      return c.json({ error: "Super admin privileges required" }, 403);
    }

    let body: { requestId?: string; action?: string } | null = null;
    try {
      body = (await c.req.json()) as typeof body;
    } catch {
      return c.json({ error: "invalid JSON body" }, 400);
    }
    const requestId = body?.requestId?.trim();
    const action = body?.action;
    if (!requestId) return c.json({ error: "requestId required" }, 400);
    if (!isActionValid(action)) {
      return c.json(
        {
          error:
            "action must be one of: approve_commit, approve_and_deploy, deny",
        },
        400,
      );
    }

    // Look up the request — deny if it doesn't exist so we can't record decisions
    // against unknown ids (prevents noise).
    const request = await loadRequest(requestId);
    if (!request) return c.json({ error: "request not found" }, 404);

    // STUB — orchestration layer for commit + deploy lives in a follow-up sprint.
    // For now we just log the decision and persist it so TP can audit who
    // approved what. The modal still reads as "committed" because the button
    // succeeded (200) — when the orchestrator ships, this block calls it.
    log.info("Maintenance decision", {
      requestId,
      action,
      userId,
      severity: request.severity,
    });

    await recordDecision(requestId, action, userId);

    const messages: Record<Action, string> = {
      approve_commit: "Decision recorded — staged for manual commit.",
      approve_and_deploy: "Decision recorded — staged for commit + deploy.",
      deny: "Denied — no code changes will land.",
    };

    return c.json({
      ok: true,
      action,
      requestId,
      message: messages[action],
    });
  });

  return router;
}
