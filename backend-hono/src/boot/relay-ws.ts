// [claude-code 2026-04-15] T6: WebSocket server for relay — attaches to Node HTTP server for /api/relay/connect
// Handles local backend persistent connections with JWT auth + heartbeat

import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "node:http";
import { relayBridge } from "../services/relay-bridge.js";
import { verifySupabaseToken } from "../services/supabase-auth.js";
import { createLogger } from "../lib/logger.js";

const log = createLogger("RelayWS");
const HEARTBEAT_INTERVAL = 30_000;

export function attachRelayWebSocket(server: Server): void {
  const wss = new WebSocketServer({ noServer: true });

  // Handle upgrade requests for /api/relay/connect
  server.on("upgrade", async (req, socket, head) => {
    if (req.url !== "/api/relay/connect") return;

    // Extract JWT from query param or Authorization header
    const url = new URL(req.url, `http://${req.headers.host}`);
    const token =
      url.searchParams.get("token") ||
      req.headers.authorization?.replace("Bearer ", "");

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
