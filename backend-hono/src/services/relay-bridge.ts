// [claude-code 2026-04-25] S35: forward() now rejects when the local backend's WebSocket
// closes or errors mid-stream. Previously the generator awaited a Promise that nothing
// resolved if the WS dropped between frames — the relay route hung indefinitely, mobile
// got 200 OK with an empty SSE body, no error event, no [DONE], and the user saw a silent
// non-response (12s watchdog "HARPER SILENT" caption with no assistant bubble). Listen on
// `close` and `error` and synthesize a `local_offline` error frame so the relay route's
// catch arm fires and emits both `{type:"error", error:...}` and `[DONE]`.
// [claude-code 2026-04-18] S21-T1: Relay bridge — adds dispatch state + mirror-message pub/sub so
// desktop can hand a conversation off to paired mobile and stream mobile-side messages back in real time.
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

/** Active desktop→mobile dispatch for a user */
interface DispatchState {
  conversationId: string;
  startedAt: number;
  deviceLabel: string;
}

/** A message mirrored from mobile back to desktop while dispatched */
export interface MirrorMessage {
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  /** Optional chunk flag — for streaming assistant tokens */
  isChunk?: boolean;
}

type MirrorListener = (msg: MirrorMessage) => void;

class RelayBridge {
  private connections = new Map<string, RelayConnection>();
  private pending = new Map<string, PendingRequest>();
  private dispatches = new Map<string, DispatchState>();
  private mirrorListeners = new Map<string, Set<MirrorListener>>();
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

    // If the local backend's WS drops between frames, surface it as a real error
    // instead of hanging the generator. relay.ts's catch arm will then emit
    // `{type:"error",error:"Local backend disconnected"}` + `[DONE]` so mobile
    // shows a visible error bubble instead of a silent non-response.
    const onClose = () => {
      if (done || error) return;
      error = new Error("local_offline");
      waiting?.();
      waiting = null;
    };
    const onError = () => {
      if (done || error) return;
      error = new Error("local_offline");
      waiting?.();
      waiting = null;
    };

    conn.ws.addEventListener("message", onMessage);
    conn.ws.addEventListener("close", onClose);
    conn.ws.addEventListener("error", onError);

    // Send the request to local backend. If the WS already closed between
    // isConnected() and now, send() throws — convert to local_offline so the
    // generator surfaces the same error path as a mid-stream drop.
    try {
      conn.ws.send(
        JSON.stringify({
          type: "chat",
          requestId,
          payload,
        }),
      );
    } catch (sendErr) {
      conn.ws.removeEventListener("message", onMessage);
      conn.ws.removeEventListener("close", onClose);
      conn.ws.removeEventListener("error", onError);
      throw new Error(
        sendErr instanceof Error ? sendErr.message : "local_offline",
      );
    }

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
      conn.ws.removeEventListener("close", onClose);
      conn.ws.removeEventListener("error", onError);
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

  // ── Dispatch + mirror (S21-T1) ─────────────────────────────────────────────

  /** Begin a desktop→mobile dispatch for a user. Idempotent per user. */
  beginDispatch(
    userId: string,
    conversationId: string,
    deviceLabel: string,
  ): DispatchState {
    const state: DispatchState = {
      conversationId,
      startedAt: Date.now(),
      deviceLabel,
    };
    this.dispatches.set(userId, state);
    log.info("Dispatch begun", { userId, conversationId, deviceLabel });
    return state;
  }

  /** End an active dispatch. Returns the prior state if one existed. */
  endDispatch(userId: string): DispatchState | null {
    const prior = this.dispatches.get(userId) ?? null;
    this.dispatches.delete(userId);
    // Notify any open mirror listeners for this user to close their streams.
    const key = mirrorKey(userId, prior?.conversationId ?? "");
    this.mirrorListeners.delete(key);
    if (prior)
      log.info("Dispatch ended", {
        userId,
        conversationId: prior.conversationId,
      });
    return prior;
  }

  /** Is the given user currently dispatched (optionally for a specific convo)? */
  isDispatched(userId: string, conversationId?: string): boolean {
    const state = this.dispatches.get(userId);
    if (!state) return false;
    return conversationId ? state.conversationId === conversationId : true;
  }

  /** Get the current dispatch state for a user, if any. */
  getDispatch(userId: string): DispatchState | null {
    return this.dispatches.get(userId) ?? null;
  }

  /** Publish a mirror message (usually from mobile WS) to any desktop subscribers. */
  publishMirrorMessage(userId: string, msg: MirrorMessage): number {
    const key = mirrorKey(userId, msg.conversationId);
    const listeners = this.mirrorListeners.get(key);
    if (!listeners || listeners.size === 0) return 0;
    for (const listener of listeners) {
      try {
        listener(msg);
      } catch (err) {
        log.warn("Mirror listener threw", { error: String(err) });
      }
    }
    return listeners.size;
  }

  /** Subscribe to mirror messages for a user+conversation. Returns unsubscribe. */
  subscribeMirror(
    userId: string,
    conversationId: string,
    listener: MirrorListener,
  ): () => void {
    const key = mirrorKey(userId, conversationId);
    let set = this.mirrorListeners.get(key);
    if (!set) {
      set = new Set();
      this.mirrorListeners.set(key, set);
    }
    set.add(listener);
    return () => {
      const current = this.mirrorListeners.get(key);
      if (!current) return;
      current.delete(listener);
      if (current.size === 0) this.mirrorListeners.delete(key);
    };
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
    this.dispatches.clear();
    this.mirrorListeners.clear();
  }
}

function mirrorKey(userId: string, conversationId: string): string {
  return `${userId}::${conversationId}`;
}

// Singleton
export const relayBridge = new RelayBridge();
