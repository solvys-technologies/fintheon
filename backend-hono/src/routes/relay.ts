// [claude-code 2026-04-16] T1: Relay expansion — full payload forwarding + tool-decision channel
// The WebSocket server is initialized separately in boot (needs access to the raw HTTP server).
// These Hono routes handle the HTTP endpoints only.

import { Hono } from "hono";
import { relayBridge } from "../services/relay-bridge.js";
import { createLogger } from "../lib/logger.js";

const log = createLogger("Relay");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AppEnv = { Variables: { userId: string; email: string; auth: any } };

export function createRelayRoutes() {
  const app = new Hono<AppEnv>();

  /**
   * GET /api/relay/health — Connection status for authenticated user
   * Mobile polls this every 30s to show connection badge
   */
  app.get("/health", async (c) => {
    const userId = c.get("userId") as string | undefined;
    if (!userId || userId === "anonymous") {
      return c.json({ connected: false, error: "auth_required" }, 401);
    }
    return c.json({ connected: relayBridge.isConnected(userId) });
  });

  /**
   * POST /api/relay/chat — Mobile sends chat message, relayed to local backend via WebSocket
   * Response is SSE stream bridging the local backend's response chunks
   */
  app.post("/chat", async (c) => {
    const userId = c.get("userId") as string | undefined;
    if (!userId || userId === "anonymous") {
      return c.json(
        { error: "auth_required", message: "Authentication required" },
        401,
      );
    }

    if (!relayBridge.isConnected(userId)) {
      return c.json(
        { error: "local_offline", message: "Local backend not connected" },
        503,
      );
    }

    const body = await c.req.json<{
      message: string;
      conversationId?: string | null;
      images?: string[];
      riskFlowContext?: string;
      thinkHarder?: boolean;
      persona?: string;
      traderName?: string;
    }>();

    if (!body.message?.trim()) {
      return c.json(
        { error: "invalid_request", message: "Message required" },
        400,
      );
    }

    // Stream the relayed response as SSE
    const headers = new Headers({
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        const send = (data: string) => {
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        };

        try {
          for await (const chunk of relayBridge.forward(userId, body)) {
            send(chunk);
          }
          send("[DONE]");
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "Relay error";
          log.error("Relay forward failed", { userId, error: msg });
          send(
            JSON.stringify({
              type: "error",
              error:
                msg === "local_offline" ? "Local backend disconnected" : msg,
            }),
          );
          send("[DONE]");
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, { headers });
  });

  /**
   * POST /api/relay/tool-decision — Mobile sends tool approval/denial back to local backend
   */
  app.post("/tool-decision", async (c) => {
    const userId = c.get("userId") as string | undefined;
    if (!userId || userId === "anonymous") {
      return c.json({ error: "auth_required" }, 401);
    }

    const body = await c.req.json<{
      approvalId: string;
      decision: "approved" | "denied";
    }>();

    if (!body.approvalId || !["approved", "denied"].includes(body.decision)) {
      return c.json({ error: "invalid_request" }, 400);
    }

    const sent = relayBridge.sendToLocal(userId, {
      type: "tool-decision",
      payload: body,
    });

    if (!sent) return c.json({ error: "local_offline" }, 503);
    return c.json({ ok: true });
  });

  /**
   * GET /api/relay/connect — WebSocket upgrade endpoint (placeholder)
   * Actual WebSocket upgrade is handled by the ws server in boot/relay-ws.ts
   * This endpoint exists so Hono doesn't 404 on the path.
   */
  app.get("/connect", (c) => {
    // If we reach here, the WebSocket upgrade was not intercepted by the ws server
    return c.json(
      {
        error: "websocket_required",
        message: "This endpoint requires WebSocket upgrade",
      },
      426,
    );
  });

  return app;
}
