// [claude-code 2026-04-23] S31-T9 predictive knowledge graph + feature proposals
// User CRUD over Harper-generated proposals + super-admin fleet view (anonymized).
// Mounted under authMiddleware + requireAuth. Proposal creation is restricted to
// super-admin (env: SUPER_ADMIN_USER_ID) or routine secret (X-Cron-Secret) callers.

import { Hono } from "hono";
import type { Context } from "hono";
import { z } from "zod";
import { getSupabaseClient } from "../config/supabase.js";

// [claude-code 2026-04-23] S32-UNIFY: type inlined from shared/predictive-knowledge-graph.ts;
// backend tsconfig rootDir prevents cross-package import.
type FeatureProposalStatus =
  | "proposed"
  | "accepted"
  | "dismissed"
  | "scaffolded";

interface FeatureProposal {
  id: string;
  userId: string;
  proposedAt: string;
  anchorSurface: string;
  title: string;
  description: string;
  status: FeatureProposalStatus;
  decidedAt: string | null;
}

const PROPOSAL_STATUSES = [
  "proposed",
  "accepted",
  "dismissed",
  "scaffolded",
] as const;

const proposalCreateSchema = z.object({
  userId: z.string().uuid(),
  anchorSurface: z.string().min(1).max(64),
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(2000),
  evidenceEventIds: z.array(z.string().uuid()).max(50).optional(),
});

const decisionSchema = z.object({
  status: z.enum(["accepted", "dismissed"]),
});

interface ProposalRow {
  id: string;
  user_id: string;
  proposed_at: string;
  anchor_surface: string;
  title: string;
  description: string;
  status: string;
  decided_at: string | null;
}

function rowToProposal(row: ProposalRow): FeatureProposal {
  return {
    id: row.id,
    userId: row.user_id,
    proposedAt: row.proposed_at,
    anchorSurface: row.anchor_surface,
    title: row.title,
    description: row.description,
    status: row.status as FeatureProposal["status"],
    decidedAt: row.decided_at,
  };
}

function isSuperAdmin(uid: string): boolean {
  const list = (process.env.SUPER_ADMIN_USER_ID || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return list.includes(uid);
}

function hasRoutineSecret(c: Context): boolean {
  const expected = process.env.CRON_SECRET_TOKEN;
  if (!expected) return false;
  const provided = c.req.header("X-Cron-Secret") || c.req.query("token");
  return provided === expected;
}

export function createFeatureProposalsRoutes(): Hono {
  const router = new Hono();

  // GET /api/feature-proposals?status=proposed — list current user's proposals.
  router.get("/", async (c: Context) => {
    const uid = c.get("supabaseUid") as string | undefined;
    if (!uid) return c.json({ error: "Missing supabase uid" }, 401);

    const statusFilter = c.req.query("status");
    const limit = Math.min(Number(c.req.query("limit") ?? 50), 200);

    const sb = getSupabaseClient();
    if (!sb) return c.json({ proposals: [] as FeatureProposal[] });

    let query = sb
      .from("feature_proposals")
      .select(
        "id, user_id, proposed_at, anchor_surface, title, description, status, decided_at",
      )
      .eq("user_id", uid)
      .order("proposed_at", { ascending: false })
      .limit(limit);

    if (statusFilter && PROPOSAL_STATUSES.includes(statusFilter as never)) {
      query = query.eq("status", statusFilter);
    }

    const { data, error } = await query;
    if (error) {
      console.error("[feature-proposals] list failed:", error.message);
      return c.json({ proposals: [] });
    }

    return c.json({
      proposals: ((data ?? []) as ProposalRow[]).map(rowToProposal),
    });
  });

  // GET /api/feature-proposals/admin/fleet — super-admin only; cross-user view.
  // anonymize=false (default true) returns user_id; true returns short hash.
  router.get("/admin/fleet", async (c: Context) => {
    const uid = c.get("supabaseUid") as string | undefined;
    if (!uid || !isSuperAdmin(uid)) {
      return c.json({ error: "Forbidden" }, 403);
    }

    const anonymize = (c.req.query("anonymize") ?? "true") !== "false";
    const limit = Math.min(Number(c.req.query("limit") ?? 100), 500);

    const sb = getSupabaseClient();
    if (!sb) return c.json({ proposals: [] });

    const { data, error } = await sb
      .from("feature_proposals")
      .select(
        "id, user_id, proposed_at, anchor_surface, title, description, status, decided_at",
      )
      .order("proposed_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("[feature-proposals] fleet failed:", error.message);
      return c.json({ proposals: [] });
    }

    const proposals = ((data ?? []) as ProposalRow[]).map((row) => {
      const p = rowToProposal(row);
      if (!anonymize) return p;
      const hash = p.userId.slice(0, 8);
      return { ...p, userId: `anon-${hash}` };
    });

    return c.json({ proposals });
  });

  // POST /api/feature-proposals — Harper/Routine path; requires super-admin OR
  // routine-secret. Inserts a proposal targeting a specific user_id.
  router.post("/", async (c: Context) => {
    const uid = c.get("supabaseUid") as string | undefined;
    const adminOk = uid ? isSuperAdmin(uid) : false;
    const routineOk = hasRoutineSecret(c);

    if (!adminOk && !routineOk) {
      return c.json({ error: "Forbidden" }, 403);
    }

    const raw = await c.req.json().catch(() => null);
    const parsed = proposalCreateSchema.safeParse(raw);
    if (!parsed.success) {
      return c.json(
        { error: "Invalid proposal payload", issues: parsed.error.issues },
        400,
      );
    }

    const sb = getSupabaseClient();
    if (!sb) return c.json({ error: "Backend not configured" }, 503);

    const { data, error } = await sb
      .from("feature_proposals")
      .insert({
        user_id: parsed.data.userId,
        anchor_surface: parsed.data.anchorSurface,
        title: parsed.data.title,
        description: parsed.data.description,
        evidence_event_ids: parsed.data.evidenceEventIds ?? null,
      })
      .select(
        "id, user_id, proposed_at, anchor_surface, title, description, status, decided_at",
      )
      .single();

    if (error || !data) {
      console.error(
        "[feature-proposals] insert failed:",
        error?.message ?? "no row",
      );
      return c.json({ error: "Failed to create proposal" }, 500);
    }

    return c.json(rowToProposal(data as ProposalRow));
  });

  // PATCH /api/feature-proposals/:id — user accepts or dismisses one of theirs.
  router.patch("/:id", async (c: Context) => {
    const uid = c.get("supabaseUid") as string | undefined;
    if (!uid) return c.json({ error: "Missing supabase uid" }, 401);

    const id = c.req.param("id");
    const raw = await c.req.json().catch(() => null);
    const parsed = decisionSchema.safeParse(raw);
    if (!parsed.success) {
      return c.json(
        { error: "Invalid decision payload", issues: parsed.error.issues },
        400,
      );
    }

    const sb = getSupabaseClient();
    if (!sb) return c.json({ error: "Backend not configured" }, 503);

    const { data, error } = await sb
      .from("feature_proposals")
      .update({
        status: parsed.data.status,
        decided_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_id", uid)
      .select(
        "id, user_id, proposed_at, anchor_surface, title, description, status, decided_at",
      )
      .single();

    if (error || !data) {
      console.error(
        "[feature-proposals] patch failed:",
        error?.message ?? "no row",
      );
      return c.json({ error: "Proposal not found" }, 404);
    }

    return c.json(rowToProposal(data as ProposalRow));
  });

  return router;
}
