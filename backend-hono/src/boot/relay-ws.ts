// [claude-code 2026-04-18] Two auth paths for WS upgrade: (1) user JWT (preferred when the
//   local backend is run with an end-user session), (2) service-role key + explicit user_id
//   (used by the local backend which runs with SUPABASE_SERVICE_ROLE_KEY and declares which
//   user it serves via RELAY_USER_ID). Without path 2, the local backend couldn't register
//   under the user's sub at all — the WS would close as unauthorized, Fly would report
//   connected:false on /api/relay/health, and mobile's ChatInput would stay locked offline.
// [claude-code 2026-04-15] T6: WebSocket server for relay — attaches to Node HTTP server for /api/relay/connect
// Handles local backend persistent connections with JWT auth + heartbeat

import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "node:http";
import { relayBridge } from "../services/relay-bridge.js";
import { verifySupabaseToken } from "../services/supabase-auth.js";
import { createLogger } from "../lib/logger.js";

const log = createLogger("RelayWS");
const HEARTBEAT_INTERVAL = 30_000;

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function attachRelayWebSocket(server: Server): void {
  const wss = new WebSocketServer({ noServer: true });

  // Handle upgrade requests for /api/relay/connect
  server.on("upgrade", async (req, socket, head) => {
    if (req.url?.split("?")[0] !== "/api/relay/connect") return;

    log.info("WS upgrade received", {
      url: req.url?.split("?")[0],
      hasAuthHeader: Boolean(req.headers.authorization),
    });

    // Extract credentials from query params or Authorization header.
    // Two paths:
    //   A) token=<user-jwt> → verify via supabase.auth.getUser, register under user.sub
    //   B) service_token=<service-role-key> + user_id=<uuid> → constant-time compare
    //      against SUPABASE_SERVICE_ROLE_KEY, register under the provided user_id.
    const url = new URL(req.url ?? "", `http://${req.headers.host}`);
    const token =
      url.searchParams.get("token") ||
      req.headers.authorization?.replace("Bearer ", "");
    const serviceToken = url.searchParams.get("service_token");
    const claimedUserId = url.searchParams.get("user_id");

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

    // Path B: service-role auth (constant-time compare + explicit user_id)
    if (serviceToken && claimedUserId) {
      if (!serviceRoleKey) {
        log.warn(
          "WS service_token path unavailable — SUPABASE_SERVICE_ROLE_KEY not set",
        );
      } else if (timingSafeEqual(serviceToken, serviceRoleKey)) {
        log.info("WS upgrade: service_token accepted", {
          userId: claimedUserId,
        });
        wss.handleUpgrade(req, socket, head, (ws) => {
          wss.emit("connection", ws, req, claimedUserId);
        });
        return;
      } else {
        log.warn("WS upgrade: service_token mismatch", {
          sentLen: serviceToken.length,
          expectLen: serviceRoleKey.length,
        });
      }
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }

    // Path A: user JWT
    if (!token) {
      log.warn("WS upgrade: no credentials");
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }

    try {
      const user = await verifySupabaseToken(token);
      if (!user?.sub) {
        log.warn("WS upgrade: user JWT missing sub");
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
        return;
      }

      log.info("WS upgrade: user JWT accepted", { userId: user.sub });
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit("connection", ws, req, user.sub);
      });
    } catch (err) {
      log.warn("WS upgrade: user JWT rejected", {
        error: err instanceof Error ? err.message : String(err),
      });
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
    }
  });

  wss.on("connection", (ws: WebSocket, _req: unknown, userId: string) => {
    log.info("Local backend connected", { userId });
    relayBridge.register(userId, ws as unknown as globalThis.WebSocket);

    // Heartbeat: server pings, client must pong within 60s
    let alive = true;
    const pingTimer = setInterval(() => {
      if (!alive) {
        log.warn("Heartbeat timeout, closing", { userId });
        ws.terminate();
        return;
      }
      alive = false;
      ws.ping();
    }, HEARTBEAT_INTERVAL);

    ws.on("pong", () => {
      alive = true;
      relayBridge.refreshPing(userId);
    });

    ws.on("close", () => {
      clearInterval(pingTimer);
      relayBridge.unregister(userId);
      log.info("Local backend disconnected", { userId });
    });

    ws.on("error", (err) => {
      clearInterval(pingTimer);
      relayBridge.unregister(userId);
      log.error("WebSocket error", { userId, error: err.message });
    });
  });

  log.info("Relay WebSocket server attached to /api/relay/connect");
}
