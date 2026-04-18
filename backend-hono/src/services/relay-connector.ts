// [claude-code 2026-04-19] S24 unify: 24h-runtime mode per TP. Default-on (RELAY_ENABLED=false to
//   opt out). Auto-discover userId from ~/.fintheon/peer.json at boot so a freshly-started backend
//   connects to the Fly relay BEFORE any Electron sign-in happens. Client-side ping keepalive every
//   30s + dead-connection detection at 90s so silent Fly WS drops get force-reconnected instead of
//   the local thinking it's still open (the relay-ws-flapping class). Backoff max tightened 30s → 10s.
// [claude-code 2026-04-18] Default RELAY_URL repointed from the deleted pulse-api-withered-dust-1394
//   (dead legacy app) to wss://fintheon.fly.dev/api/relay/connect. Without this the local backend
//   never establishes the outbound WebSocket to the Fly relay, so Fly's /api/relay/health reports
//   connected:false for every mobile poll, and ConnectionStatus locks the mobile into OFFLINE.
// [claude-code 2026-04-16] T1: Relay connector — full payload forwarding, tool-decision handling, cognition SSE injection
// Listens for forwarded chat messages, routes to local Harper, streams response back.

import WebSocket from "ws";
import { readFileSync } from "node:fs";
import { resolve as resolvePath } from "node:path";
import { homedir } from "node:os";
import { createLogger } from "../lib/logger.js";
import { streamHarperChat, isStrandsAvailable } from "./strands/index.js";
import { resolveApproval } from "./tool-approval-store.js";
import { onStep } from "./cognition-emitter.js";

const log = createLogger("RelayConnector");

const RELAY_URL =
  process.env.RELAY_WS_URL || "wss://fintheon.fly.dev/api/relay/connect";

// 24h-runtime tuning. Faster recovery beats exponential-long waits when the network blips.
const MAX_BACKOFF = 10_000;
const PING_INTERVAL_MS = 30_000;
const PONG_DEADLINE_MS = 90_000;

let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectAttempt = 0;
let pingTimer: ReturnType<typeof setInterval> | null = null;
let lastPongAt = 0;

// Runtime user-scoping. Priority:
//   1. RELAY_USER_ID env — explicit override
//   2. ~/.fintheon/peer.json (written by peer-bootstrap.sh on device setup)
//   3. waits for POST /api/relay/set-user from the Electron sign-in flow
function discoverInitialUserId(): string | null {
  const envUser = process.env.RELAY_USER_ID;
  if (envUser) return envUser;
  try {
    const configPath =
      process.env.FINTHEON_PEER_CONFIG ||
      resolvePath(homedir(), ".fintheon", "peer.json");
    const raw = readFileSync(configPath, "utf8");
    const parsed = JSON.parse(raw) as { user_id?: string };
    if (parsed.user_id && parsed.user_id !== "local-user") {
      log.info("Discovered userId from peer.json", {
        userId: parsed.user_id,
      });
      return parsed.user_id;
    }
  } catch {
    /* peer.json absent — that's the default pre-bootstrap state */
  }
  return null;
}

let currentUserId: string | null = discoverInitialUserId();

function getBackoff(): number {
  const base = Math.min(1000 * Math.pow(2, reconnectAttempt), MAX_BACKOFF);
  reconnectAttempt++;
  return base;
}

async function handleChatRequest(
  requestId: string,
  payload: {
    message: string;
    conversationId?: string | null;
    userId?: string;
    images?: string[];
    riskFlowContext?: string;
    thinkHarder?: boolean;
    persona?: string;
    traderName?: string;
  },
): Promise<void> {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;

  const send = (type: string, data: string) => {
    ws?.send(JSON.stringify({ requestId, type, payload: data }));
  };

  // Subscribe to cognition events and inject tool-approval frames into the SSE stream
  const unsubCognition = onStep(requestId, (step) => {
    if (
      step.kind === "tool-approval-needed" ||
      step.kind === "tool-approval-resolved"
    ) {
      send(
        "chunk",
        `data: ${JSON.stringify({ type: step.kind, ...JSON.parse(step.detail || "{}") })}\n\n`,
      );
    }
  });

  try {
    if (!(await isStrandsAvailable())) {
      send("error", "Harper/Strands not available on this machine");
      send("done", "");
      return;
    }

    // streamHarperChat returns a Response with SSE body
    // conversationId is now resolved by relay.ts (real UUID), fallback to temp ID only as last resort
    const response = await streamHarperChat({
      message: payload.message,
      conversationId: payload.conversationId ?? `relay-${requestId}`,
      requestId,
      userId: payload.userId,
      images: payload.images,
      riskFlowContext: payload.riskFlowContext,
      thinkHarder: payload.thinkHarder,
      persona: payload.persona,
      relayOriginated: true,
      userContext: payload.traderName
        ? { traderName: payload.traderName }
        : undefined,
    });

    if (!response.body) {
      send("error", "No response body from Harper");
      send("done", "");
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      // Each chunk is raw SSE lines from the Harper response — forward as-is
      send("chunk", chunk);
    }

    send("done", "");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error("Chat relay handler failed", { requestId, error: msg });
    send("error", msg);
    send("done", "");
  } finally {
    unsubCognition();
  }
}

function connect(): void {
  if (
    ws &&
    (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)
  ) {
    return;
  }

  // Prefer explicit user-JWT path if provided. Otherwise fall back to the
  // service-role + user_id path so the local backend (which doesn't have a
  // user JWT of its own) can still register under the user it serves.
  const userJwt = process.env.RELAY_AUTH_TOKEN || "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const userId = currentUserId || "";

  let url: string;
  let mode: string;
  if (userJwt) {
    url = `${RELAY_URL}?token=${encodeURIComponent(userJwt)}`;
    mode = "user-jwt";
  } else if (serviceKey && userId) {
    url = `${RELAY_URL}?service_token=${encodeURIComponent(serviceKey)}&user_id=${encodeURIComponent(userId)}`;
    mode = "service+user_id";
  } else {
    log.info(
      "Relay connector waiting for user identity — call POST /api/relay/set-user " +
        "with { userId } once the Electron auth context is established.",
    );
    return;
  }

  log.info("Connecting to relay", {
    url: RELAY_URL,
    mode,
    userId: mode === "service+user_id" ? userId : "(from JWT)",
    attempt: reconnectAttempt,
  });
  ws = new WebSocket(url);

  ws.on("open", () => {
    reconnectAttempt = 0;
    lastPongAt = Date.now();
    log.info("Connected to relay");
    startKeepalive();
  });

  ws.on("message", async (data) => {
    try {
      const frame = JSON.parse(data.toString());
      if (frame.type === "chat" && frame.requestId && frame.payload) {
        handleChatRequest(frame.requestId, frame.payload);
      } else if (frame.type === "tool-decision" && frame.payload) {
        const { approvalId, decision } = frame.payload;
        resolveApproval(approvalId, decision);
      }
    } catch {
      // Non-JSON or unrecognized frame — ignore
    }
  });

  ws.on("ping", () => {
    ws?.pong();
  });

  // Keepalive health: Fly has been known to silently drop the outbound WS without
  // firing a close frame. If we don't hear back from our pings for PONG_DEADLINE_MS,
  // tear down and reconnect so mobile PWAs don't sit on a dead pipe.
  ws.on("pong", () => {
    lastPongAt = Date.now();
  });

  ws.on("close", (code, reason) => {
    log.info("Relay connection closed", { code, reason: reason?.toString() });
    stopKeepalive();
    ws = null;
    scheduleReconnect();
  });

  ws.on("error", (err) => {
    log.warn("Relay connection error", { error: err.message });
    // close event will fire next, triggering reconnect
  });
}

function startKeepalive(): void {
  stopKeepalive();
  pingTimer = setInterval(() => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    // Silent-drop detection: if the server went quiet > PONG_DEADLINE_MS ago,
    // force-close. The close handler reconnects.
    if (Date.now() - lastPongAt > PONG_DEADLINE_MS) {
      log.warn("Relay pong deadline exceeded — force-reconnecting", {
        lastPongAgoMs: Date.now() - lastPongAt,
      });
      try {
        ws.terminate();
      } catch {
        /* ignore */
      }
      return;
    }
    try {
      ws.ping();
    } catch {
      /* ignore — close handler will fire */
    }
  }, PING_INTERVAL_MS);
  pingTimer.unref?.();
}

function stopKeepalive(): void {
  if (pingTimer) {
    clearInterval(pingTimer);
    pingTimer = null;
  }
}

function scheduleReconnect(): void {
  if (reconnectTimer) return;
  const delay = getBackoff();
  log.info("Scheduling relay reconnect", { delayMs: delay });
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, delay);
  reconnectTimer.unref?.();
}

export function startRelayConnector(): void {
  // 24h-runtime: on by default. Opt OUT with RELAY_ENABLED=false (for CI /
  // Fly-hosted backend which IS the relay server and shouldn't connect to itself).
  if (process.env.RELAY_ENABLED === "false") {
    log.info("Relay connector disabled via RELAY_ENABLED=false");
    return;
  }
  if (process.env.FLY_APP_NAME) {
    // Belt-and-suspenders: the Fly-hosted backend is the relay SERVER; don't open
    // an outbound WS to itself. Local/Electron backends don't set FLY_APP_NAME.
    log.info(
      "Relay connector skipped on Fly host (this node is the relay server)",
    );
    return;
  }
  log.info("Relay connector starting (24h runtime mode)", {
    userId: currentUserId ?? "(waiting for auth)",
  });
  connect();
}

/**
 * Update the user identity this local backend reports to the Fly relay, and
 * reconnect with the new credentials. Called by POST /api/relay/set-user when
 * the Electron auth context is established (or when it changes on logout /
 * account swap). Passing null disconnects cleanly.
 */
export function setRelayUser(userId: string | null): void {
  if (userId === currentUserId) return;
  log.info("Relay user identity updated", {
    from: currentUserId ?? "(none)",
    to: userId ?? "(none)",
  });
  currentUserId = userId;
  // Close the existing connection — the close handler will trigger reconnect
  // with the new identity (or skip if we just cleared it).
  if (ws) {
    try {
      ws.close(1000, "identity-change");
    } catch {
      /* ignore */
    }
    ws = null;
  }
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  reconnectAttempt = 0;
  // 24h-runtime: reconnect by default unless explicitly disabled or running on Fly.
  if (
    userId &&
    process.env.RELAY_ENABLED !== "false" &&
    !process.env.FLY_APP_NAME
  ) {
    connect();
  }
}

export function getRelayUser(): string | null {
  return currentUserId;
}

export function isRelayConnected(): boolean {
  return ws?.readyState === WebSocket.OPEN;
}

export function stopRelayConnector(): void {
  stopKeepalive();
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (ws) {
    ws.close(1000, "shutdown");
    ws = null;
  }
}
