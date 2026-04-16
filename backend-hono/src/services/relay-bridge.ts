// [claude-code 2026-04-16] T1: Relay bridge — generalized forward() payload + sendToLocal() for tool-decision

import { createLogger } from "../lib/logger.js";

const log = createLogger("RelayBridge");

interface RelayConnection {
  ws: WebSocket;
  lastPing: number;
}

/** Pending request waiting for streamed response from local backend */
interface PendingRequest {
  resolve: (chunk: string) => void;
  reject: (err: Error) => void;
  onChunk: (chunk: string) => void;
  onDone: () => void;
}

class RelayBridge {
  private connections = new Map<string, RelayConnection>();
  private pending = new Map<string, PendingRequest>();
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // Check for stale connections every 30s
    this.heartbeatTimer = setInterval(() => this.pruneStale(), 30_000);
  }

  register(userId: string, ws: WebSocket): void {
    // Close existing connection for this user
    const existing = this.connections.get(userId);
    if (existing) {
      try {
        existing.ws.close(1000, "replaced");
      } catch {
        // Already closed
      }
    }
    this.connections.set(userId, { ws, lastPing: Date.now() });
    log.info("Connection registered", { userId, total: this.connections.size });
  }

  unregister(userId: string): void {
    this.connections.delete(userId);
    log.info("Connection unregistered", {
      userId,
      total: this.connections.size,
    });
  }

  isConnected(userId: string): boolean {
    return this.connections.has(userId);
  }

  refreshPing(userId: string): void {
    const conn = this.connections.get(userId);
    if (conn) conn.lastPing = Date.now();
  }

  /**
   * Send an arbitrary frame to the local backend's WebSocket connection.
   * Used by the tool-decision endpoint to relay approval/denial back.
   */
  sendToLocal(
    userId: string,
    frame: { type: string; payload: unknown },
  ): boolean {
    const conn = this.connections.get(userId);
    if (!conn) return false;
    conn.ws.send(JSON.stringify(frame));
    return true;
  }

  /**
   * Forward a chat payload to the local backend via WebSocket.
   * Returns an async generator that yields SSE chunks from the local backend.
   */
  async *forward(
    userId: string,
    payload: Record<string, unknown>,
  ): AsyncGenerator<string> {
    const conn = this.connections.get(userId);
    if (!conn) throw new Error("local_offline");

    const requestId = `relay-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // Set up a promise-based chunk queue
    const chunks: string[] = [];
    let done = false;
    let error: Error | null = null;
    let waiting: ((value: void) => void) | null = null;

    const onMessage = (event: MessageEvent) => {
      const data = typeof event.data === "string" ? event.data : "";

      // Local backend sends framed messages: { requestId, type, payload }
      try {
        const frame = JSON.parse(data);
        if (frame.requestId !== requestId) return;

        if (frame.type === "chunk") {
          chunks.push(frame.payload);
          waiting?.();
          waiting = null;
        } else if (frame.type === "done") {
          done = true;
          waiting?.();
          waiting = null;
        } else if (frame.type === "error") {
          error = new Error(frame.payload || "Local backend error");
          waiting?.();
          waiting = null;
        }
      } catch {
        // Non-JSON or pong — ignore
      }
    };

    conn.ws.addEventListener("message", onMessage);

    // Send the request to local backend
    conn.ws.send(
      JSON.stringify({
        type: "chat",
        requestId,
        payload,
      }),
    );

    try {
      while (true) {
        // Yield all buffered chunks
        while (chunks.length > 0) {
          yield chunks.shift()!;
        }

        if (error) throw error;
        if (done) break;

        // Wait for next chunk
        await new Promise<void>((resolve) => {
          waiting = resolve;
        });
      }
    } finally {
      conn.ws.removeEventListener("message", onMessage);
    }
  }

  private pruneStale(): void {
    const now = Date.now();
    const staleMs = 60_000; // 60s without ping response

    for (const [userId, conn] of this.connections) {
      if (now - conn.lastPing > staleMs) {
        log.warn("Pruning stale connection", {
          userId,
          lastPing: conn.lastPing,
        });
        try {
          conn.ws.close(1000, "stale");
        } catch {
          // Already closed
        }
        this.connections.delete(userId);
      }
    }
  }

  destroy(): void {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    for (const [, conn] of this.connections) {
      try {
        conn.ws.close(1000, "shutdown");
      } catch {
        // Already closed
      }
    }
    this.connections.clear();
  }
}

// Singleton
export const relayBridge = new RelayBridge();
