// [claude-code 2026-05-07] S61-T1: Audit log API routes
import { Hono } from "hono";
import {
  queryAuditLog,
  getAuditRecordById,
} from "../../services/audit-logger.js";
import type { AuditQueryFilters } from "../../types/audit.js";

type AuditVars = { Variables: { userId: string } };

export function createAuditRoutes(): Hono<AuditVars> {
  const router = new Hono<AuditVars>();

  // GET /api/audit/log — paginated audit trail with optional filters
  router.get("/log", async (c) => {
    const userId = c.get("userId");
    if (!userId) {
      return c.json({ error: "Authentication required" }, 401);
    }

    const filters: AuditQueryFilters = {
      agentId: c.req.query("agentId") || undefined,
      surface: c.req.query("surface") || undefined,
      decision: c.req.query("decision") || undefined,
      limit: Math.min(parseInt(c.req.query("limit") || "50", 10) || 50, 200),
      offset: parseInt(c.req.query("offset") || "0", 10) || 0,
    };

    const { rows, total } = await queryAuditLog(filters);
    return c.json({ rows, total });
  });

  // GET /api/audit/log/:id — single audit record
  router.get("/log/:id", async (c) => {
    const userId = c.get("userId");
    if (!userId) {
      return c.json({ error: "Authentication required" }, 401);
    }

    const id = parseInt(c.req.param("id"), 10);
    if (isNaN(id)) {
      return c.json({ error: "Invalid audit record ID" }, 400);
    }

    const record = await getAuditRecordById(id);
    if (!record) {
      return c.json({ error: "Audit record not found" }, 404);
    }
    return c.json(record);
  });

  return router;
}
