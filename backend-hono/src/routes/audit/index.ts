import { Hono } from "hono";
import { queryAuditLog, getAuditRecord } from "../../services/audit-logger.js";
import { AuditQueryFiltersSchema } from "../../types/audit.js";

export function createAuditRoutes(): Hono {
  const router = new Hono();

  router.get("/log", async (c) => {
    const userId = c.get("userId" as never) as string | undefined;
    if (!userId) return c.json({ error: "Unauthorized" }, 401);

    const parsed = AuditQueryFiltersSchema.safeParse({
      agentId: c.req.query("agentId"),
      surface: c.req.query("surface"),
      decision: c.req.query("decision"),
      limit: c.req.query("limit"),
      offset: c.req.query("offset"),
    });

    if (!parsed.success) {
      return c.json({ error: "Invalid query params", issues: parsed.error.issues }, 400);
    }

    const result = await queryAuditLog(parsed.data);
    return c.json(result);
  });

  router.get("/log/:id", async (c) => {
    const userId = c.get("userId" as never) as string | undefined;
    if (!userId) return c.json({ error: "Unauthorized" }, 401);

    const id = c.req.param("id");
    const record = await getAuditRecord(id);
    if (!record) return c.json({ error: "Not found" }, 404);
    return c.json(record);
  });

  return router;
}
