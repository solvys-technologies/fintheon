// [claude-code 2026-04-18] S21-T1: relay dispatch + mirror stream. Adds POST /dispatch
// (sends web-push to mobile + registers dispatch state), POST /disconnect (tears it down),
// GET /mirror-stream (SSE of messages mobile is sending while dispatched). /chat handler now
// also publishes mirror messages when the user is in an active dispatch so desktop can see
// the mobile conversation in real time.
// [claude-code 2026-04-18] T6: Conversation persistence — store user message + create conversation before relay forward.
// Fix: /chat now verifies the caller owns the supplied conversationId before addMessage,
// otherwise the INSERT stamps the message with the conversation OWNER's user_id (via the
// SELECT user_id FROM ai_conversations subquery in conversation-store.addMessage), which
// lets an authenticated attacker plant attacker-authored 'user'-role messages into any
// victim's history — a prompt-injection pivot on top of the IDOR.

import { Hono } from "hono";
import { relayBridge, type MirrorMessage } from "../services/relay-bridge.js";
import { createLogger } from "../lib/logger.js";
import {
  createConversation,
  addMessage,
  generateTitle,
  getConversation,
} from "../services/ai/conversation-store.js";
import { sendToUserDirect } from "../services/web-push-sender.js";
import {
  setRelayUser,
  getRelayUser,
  isRelayConnected,
} from "../services/relay-connector.js";
import { sql, isDatabaseAvailable } from "../config/database.js";

const log = createLogger("Relay");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AppEnv = { Variables: { userId: string; email: string; auth: any } };

export function createRelayRoutes() {
  const app = new Hono<AppEnv>();

  /**
   * GET /api/relay/health — Connection status for authenticated user
   * Mobile polls this every 30s to show connection badge. Also includes
   * dispatch state so clients can render mirror-mode UI without a separate fetch.
   */
  app.get("/health", async (c) => {
    const userId = c.get("userId") as string | undefined;
    if (!userId || userId === "anonymous") {
      return c.json({ connected: false, error: "auth_required" }, 401);
    }
    const dispatch = relayBridge.getDispatch(userId);
    return c.json({
      connected: relayBridge.isConnected(userId),
      dispatch: dispatch
        ? {
            conversationId: dispatch.conversationId,
            startedAt: new Date(dispatch.startedAt).toISOString(),
            deviceLabel: dispatch.deviceLabel,
          }
        : null,
    });
  });

  /**
   * POST /api/relay/set-user — Local-backend-only. Called by the Electron
   * frontend after sign-in so the relay connector can register with Fly under
   * the correct user_id. Accepts { userId: string | null }. Passing null
   * disconnects.
   *
   * This endpoint must NOT be exposed publicly on Fly — it's for the local
   * backend only, and the caller's auth middleware userId must match the
   * payload userId so a logged-in user can't hijack another user's relay.
   */
  app.post("/set-user", async (c) => {
    const callerId = c.get("userId") as string | undefined;
    if (!callerId || callerId === "anonymous") {
      return c.json({ error: "auth_required" }, 401);
    }
    const body = await c.req.json<{ userId?: string | null }>().catch(() => ({
      userId: null,
    }));
    const nextUserId = body.userId ?? null;
    // Ownership check — the authed caller must match the identity they're
    // claiming. Prevents "I'm signed in as A but want my relay to register
    // as B" shenanigans. Exception: the service-role key (auths as
    // "local-user" per authMiddleware) is trusted for server-to-server
    // operations and may set the relay user to anyone — this is how the
    // local backend's own bootstrap scripts / admin tooling configure the
    // connector without a user JWT.
    if (nextUserId && nextUserId !== callerId && callerId !== "local-user") {
      return c.json(
        { error: "forbidden", message: "userId must match authenticated user" },
        403,
      );
    }
    setRelayUser(nextUserId);
    return c.json({
      ok: true,
      userId: getRelayUser(),
      connected: isRelayConnected(),
    });
  });

  /**
   * GET /api/relay/connector-status — Local-only. Reports which user the
   * connector is currently registered as, and whether the WS is open. Useful
   * for the frontend to decide whether it needs to re-post /set-user.
   */
  app.get("/connector-status", async (c) => {
    const callerId = c.get("userId") as string | undefined;
    if (!callerId || callerId === "anonymous") {
      return c.json({ error: "auth_required" }, 401);
    }
    return c.json({
      userId: getRelayUser(),
      connected: isRelayConnected(),
      matchesCaller: getRelayUser() === callerId,
    });
  });

  /**
   * GET /api/relay/debug/convo-count?userId=<sub> — service-role-only.
   * Returns count of conversations owned by the given sub + owner distribution.
   * Helps diagnose "chat history missing" — is the DB state wrong, or is the
   * frontend fetching under the wrong identity? Remove after debugging session.
   */
  app.get("/debug/convo-count", async (c) => {
    const callerId = c.get("userId") as string | undefined;
    if (callerId !== "local-user") {
      return c.json({ error: "service_role_required" }, 403);
    }
    if (!isDatabaseAvailable() || !sql) {
      return c.json({ error: "database_unavailable" }, 503);
    }
    const target = c.req.query("userId");
    try {
      const counts = await sql`
        SELECT user_id, COUNT(*)::int AS n
        FROM ai_conversations
        GROUP BY user_id
        ORDER BY n DESC
        LIMIT 20
      `;
      const forUser = target
        ? await sql`
            SELECT COUNT(*)::int AS n FROM ai_conversations WHERE user_id = ${target}
          `
        : null;
      return c.json({
        ownerDistribution: counts,
        forUser: forUser
          ? { userId: target, count: (forUser[0] as { n: number }).n }
          : null,
      });
    } catch (err) {
      return c.json(
        {
          error: "query_failed",
          message: err instanceof Error ? err.message : String(err),
        },
        500,
      );
    }
  });

  /**
   * POST /api/relay/dispatch — Desktop initiates a dispatch to the user's paired mobile.
   * Verifies conversation ownership, registers dispatch state in relayBridge, fires a
   * web-push to all of the user's subscriptions with a deep link to the conversation.
   * Returns 409 if already dispatched.
   */
  app.post("/dispatch", async (c) => {
    const userId = c.get("userId") as string | undefined;
    if (!userId || userId === "anonymous") {
      return c.json({ error: "auth_required" }, 401);
    }

    const body = await c.req.json<{
      conversationId: string;
      deviceLabel?: string;
    }>();
    if (!body.conversationId) {
      return c.json(
        { error: "invalid_request", message: "conversationId required" },
        400,
      );
    }

    const owned = await getConversation(body.conversationId, userId);
    if (!owned) {
      return c.json(
        {
          error: "not_found",
          message: "Conversation not found or not owned by caller",
        },
        404,
      );
    }

    if (relayBridge.isDispatched(userId)) {
      return c.json({ error: "already_dispatched" }, 409);
    }

    const deviceLabel = body.deviceLabel?.slice(0, 64) || "your mobile device";
    const state = relayBridge.beginDispatch(
      userId,
      body.conversationId,
      deviceLabel,
    );

    // Notify connected local backend (warm-start) — this sets dispatch context there too
    relayBridge.sendToLocal(userId, {
      type: "dispatch-begin",
      payload: { conversationId: body.conversationId, deviceLabel },
    });

    // Fire web-push to mobile subscriptions. Payload.url is the PWA deep link
    // and conversationId lets the service worker postMessage a specific convo
    // to any already-open PWA tab (see mobile/public/sw.js + App.tsx handler).
    const recipients = await sendToUserDirect(userId, {
      title: "Fintheon — chat picked up",
      body: `Harper is ready on ${deviceLabel}. Tap to continue the conversation.`,
      category: "chat_relay",
      url: `/chat/${body.conversationId}`,
      icon: "/icons/icon-192.png",
      conversationId: body.conversationId,
    });

    log.info("Relay dispatch fired", {
      userId,
      conversationId: body.conversationId,
      recipients,
    });

    return c.json({
      ok: true,
      dispatchedAt: new Date(state.startedAt).toISOString(),
      deviceLabel,
      pushedTo: recipients,
    });
  });

  /**
   * POST /api/relay/disconnect — Desktop tears down the active dispatch.
   * Idempotent: returns ok:true even if nothing was dispatched.
   */
  app.post("/disconnect", async (c) => {
    const userId = c.get("userId") as string | undefined;
    if (!userId || userId === "anonymous") {
      return c.json({ error: "auth_required" }, 401);
    }

    const prior = relayBridge.endDispatch(userId);
    if (prior) {
      relayBridge.sendToLocal(userId, {
        type: "dispatch-end",
        payload: { conversationId: prior.conversationId },
      });
      log.info("Relay dispatch ended", {
        userId,
        conversationId: prior.conversationId,
      });
    }
    return c.json({ ok: true, wasDispatched: Boolean(prior) });
  });

  /**
   * GET /api/relay/mirror-stream?conversationId=… — SSE stream of mirror messages
   * (mobile-side activity) for a specific dispatched conversation. Closes automatically
   * when the dispatch ends or the client disconnects.
   */
  app.get("/mirror-stream", async (c) => {
    const userId = c.get("userId") as string | undefined;
    if (!userId || userId === "anonymous") {
      return c.json({ error: "auth_required" }, 401);
    }
    const conversationId = c.req.query("conversationId");
    if (!conversationId) {
      return c.json(
        { error: "invalid_request", message: "conversationId required" },
        400,
      );
    }

    const owned = await getConversation(conversationId, userId);
    if (!owned) {
      return c.json({ error: "not_found" }, 404);
    }

    const headers = new Headers({
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });

    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();
        const send = (payload: unknown) => {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(payload)}\n\n`),
          );
        };

        // Initial hello with current dispatch state
        const initial = relayBridge.getDispatch(userId);
        send({
          type: "mirror-hello",
          dispatched: Boolean(
            initial && initial.conversationId === conversationId,
          ),
          deviceLabel: initial?.deviceLabel ?? null,
        });

        const unsubscribe = relayBridge.subscribeMirror(
          userId,
          conversationId,
          (msg: MirrorMessage) => {
            send({ type: "mirror-message", payload: msg });
          },
        );

        // Keepalive ping every 20s (idle SSE connections can be killed by proxies)
        const keepalive = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(`: ping\n\n`));
          } catch {
            // Controller closed
          }
        }, 20_000);
        (keepalive as unknown as { unref?: () => void }).unref?.();

        // Cleanup on abort
        c.req.raw.signal.addEventListener("abort", () => {
          clearInterval(keepalive);
          unsubscribe();
          try {
            controller.close();
          } catch {
            // Already closed
          }
        });
      },
    });

    return new Response(stream, { headers });
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

    // Ensure conversation exists and persist user message before forwarding.
    // IDOR guard: if the client supplied a conversationId, verify the caller owns
    // it before calling addMessage (addMessage resolves user_id from the
    // conversation, not the caller — so without this check an attacker could
    // inject messages into any victim's conversation).
    let convId = body.conversationId || null;
    if (convId) {
      const owned = await getConversation(convId, userId);
      if (!owned) {
        return c.json(
          {
            error: "not_found",
            message: "Conversation not found or not owned by caller",
          },
          404,
        );
      }
    }
    try {
      if (!convId) {
        const conv = await createConversation(userId, {
          title: generateTitle(body.message),
        });
        convId = conv.id;
        log.info("Created conversation for relay chat", {
          userId,
          conversationId: convId,
        });
      }
      await addMessage(convId, {
        conversationId: convId,
        role: "user",
        content: body.message,
      });
    } catch (err) {
      log.warn("Failed to persist user message", {
        userId,
        error: String(err),
      });
      // Continue — relay still works, just without persistence
    }

    // If the user has an active dispatch for this convo, mirror the user message
    // to any desktop subscribers so the desktop thread stays in sync in real time.
    const isMirror = convId && relayBridge.isDispatched(userId, convId);
    if (isMirror && convId) {
      relayBridge.publishMirrorMessage(userId, {
        conversationId: convId,
        role: "user",
        content: body.message,
        createdAt: new Date().toISOString(),
      });
    }

    // Stream the relayed response as SSE
    const headers = new Headers({
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
      ...(convId ? { "X-Conversation-Id": convId } : {}),
    });

    // Forward with resolved conversationId so local backend gets a real UUID
    const relayPayload = { ...body, conversationId: convId, userId };

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        const send = (data: string) => {
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        };

        try {
          for await (const chunk of relayBridge.forward(userId, relayPayload)) {
            send(chunk);
            if (isMirror && convId) {
              relayBridge.publishMirrorMessage(userId, {
                conversationId: convId,
                role: "assistant",
                content: chunk,
                createdAt: new Date().toISOString(),
                isChunk: true,
              });
            }
          }
          send("[DONE]");
          if (isMirror && convId) {
            relayBridge.publishMirrorMessage(userId, {
              conversationId: convId,
              role: "assistant",
              content: "[DONE]",
              createdAt: new Date().toISOString(),
              isChunk: true,
            });
          }
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
