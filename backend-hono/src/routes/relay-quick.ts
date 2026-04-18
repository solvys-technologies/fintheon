// [claude-code 2026-04-19] S25: no-auth tool-decision-quick endpoint. Called from the service
//   worker's notificationclick handler when the user taps an Approve/Deny action button on the
//   iOS lock screen — the SW can't easily reach a Supabase JWT, so this route uses the
//   approvalId itself as the secret (10-min window). IDs are `approval-${Date.now()}-${rand36}`
//   which is effectively unguessable for the decision window.
//
//   Separate file from relay.ts so the route can be mounted OUTSIDE the authMiddleware block.
import { Hono } from "hono";
import { z } from "zod";
import {
  resolveApproval,
  hasPendingApproval,
} from "../services/tool-approval-store.js";
import { createLogger } from "../lib/logger.js";

const log = createLogger("RelayQuick");

const Body = z.object({
  approvalId: z.string().min(6).max(200),
  decision: z.enum(["approved", "denied"]),
});

const QUICK_WINDOW_MS = 10 * 60 * 1000;

export function createRelayQuickRoutes() {
  const app = new Hono();

  // Mounted at /api/tool-decision-quick — handler at "/" so the final URL is exactly that.
  app.post("/", async (c) => {
    const raw = await c.req.json().catch(() => null);
    const parsed = Body.safeParse(raw);
    if (!parsed.success) {
      return c.json(
        { error: "approvalId + decision (approved|denied) required" },
        400,
      );
    }
    const { approvalId, decision } = parsed.data;

    // Parse embedded timestamp `approval-{ts}-{rand}` and enforce freshness window.
    const match = approvalId.match(/^approval-(\d+)-/);
    if (match) {
      const ts = parseInt(match[1], 10);
      if (!Number.isNaN(ts) && Date.now() - ts > QUICK_WINDOW_MS) {
        log.warn("tool-decision-quick: expired id", { approvalId });
        return c.json(
          { error: "Approval window expired — open the app to decide" },
          410,
        );
      }
    }

    if (!hasPendingApproval(approvalId)) {
      return c.json({ error: "Approval not found or already resolved" }, 404);
    }

    const result = await resolveApproval(approvalId, decision);
    if (!result.found) {
      return c.json({ error: "Approval not found or already resolved" }, 404);
    }

    log.info("tool-decision-quick.resolved", {
      toolName: result.toolName,
      decision,
    });

    return c.json({
      ok: true,
      toolName: result.toolName,
      decision,
    });
  });

  return app;
}
