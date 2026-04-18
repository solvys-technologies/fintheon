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
    if (req.url !== "/api/relay/connect") return;

    // Extract credentials from query params or Authorization header.
    // Two paths:
    //   A) token=<user-jwt> → verify via supabase.auth.getUser, register under user.sub
    //   B) service_token=<service-role-key> + user_id=<uuid> → constant-time compare
    //      against SUPABASE_SERVICE_ROLE_KEY, register under the provided user_id.
    const url = new URL(req.url, `http://${req.headers.host}`);
    const token =
      url.searchParams.get("token") ||
      req.headers.authorization?.replace("Bearer ", "");
    const serviceToken = url.searchParams.get("service_token");
    const claimedUserId = url.searchParams.get("user_id");

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

    // Path B: service-role auth (constant-time compare + explicit user_id)
    if (serviceToken && claimedUserId && serviceRoleKey) {
      if (timingSafeEqual(serviceToken, serviceRoleKey)) {
        wss.handleUpgrade(req, socket, head, (ws) => {
          wss.emit("connection", ws, req, claimedUserId);
        });
        return;
      }
      log.warn("Rejected WS upgrade: service_token mismatch");
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }

    // Path A: user JWT
    if (!token) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }

    try {
      const user = await verifySupabaseToken(token);
      if (!user?.sub) {
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
        return;
      }

      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit("connection", ws, req, user.sub);
      });
    } catch {
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
