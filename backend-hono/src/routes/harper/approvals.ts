// [claude-code 2026-04-19] S25: GET /api/harper/approvals/:id — returns one pending approval
//   for the mobile DetailSheet to render a live countdown + rich input preview on push tap.
import { Hono } from "hono";
import { getApprovalById } from "../../services/tool-approval-store.js";

export function createApprovalDetailRoutes() {
  const app = new Hono();

  app.get("/:id", (c) => {
    const id = c.req.param("id");
    if (!id) return c.json({ error: "approvalId required" }, 400);

    const result = getApprovalById(id);
    if (!result) {
      return c.json({ error: "Approval not found or already resolved" }, 404);
    }

    return c.json({
      approval: {
        id: result.approval.id,
        toolName: result.approval.toolName,
        toolInput: result.approval.toolInput,
        description: result.approval.description,
        createdAt: result.approval.createdAt,
      },
      expiresAt: result.expiresAt,
      // Convenience for client-side countdowns — avoid clock-skew surprises by
      // returning a server-authoritative "now" snapshot alongside expiresAt.
      serverNow: Date.now(),
    });
  });

  return app;
}
