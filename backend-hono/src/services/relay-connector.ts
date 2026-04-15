// [claude-code 2026-04-15] T6: Outbound relay connector — local backend connects to Fly.io relay
// Only runs when RELAY_ENABLED=true (opt-in). Auto-reconnects with exponential backoff.
// Listens for forwarded chat messages, routes to local Harper, streams response back.

import WebSocket from "ws";
import { createLogger } from "../lib/logger.js";
import { streamHarperChat, isStrandsAvailable } from "./strands/index.js";

const log = createLogger("RelayConnector");

const RELAY_URL =
  process.env.RELAY_WS_URL ||
  "wss://pulse-api-withered-dust-1394.fly.dev/api/relay/connect";

let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectAttempt = 0;
const MAX_BACKOFF = 30_000;

function getBackoff(): number {
  const base = Math.min(1000 * Math.pow(2, reconnectAttempt), MAX_BACKOFF);
  reconnectAttempt++;
  return base;
}

async function handleChatRequest(
  requestId: string,
  payload: { message: string; conversationId?: string | null },
): Promise<void> {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;

  const send = (type: string, data: string) => {
    ws?.send(JSON.stringify({ requestId, type, payload: data }));
  };

  try {
    if (!(await isStrandsAvailable())) {
      send("error", "Harper/Strands not available on this machine");
      send("done", "");
      return;
    }

    // streamHarperChat returns a Response with SSE body
    const response = await streamHarperChat({
      message: payload.message,
      conversationId: payload.conversationId ?? `relay-${requestId}`,
      requestId,
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
  }
}

function connect(): void {
  if (
    ws &&
    (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)
  ) {
    return;
  }

  const token =
    process.env.RELAY_AUTH_TOKEN || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const url = `${RELAY_URL}?token=${encodeURIComponent(token)}`;

  log.info("Connecting to relay", {
    url: RELAY_URL,
    attempt: reconnectAttempt,
  });
  ws = new WebSocket(url);

  ws.on("open", () => {
    reconnectAttempt = 0;
    log.info("Connected to relay");
  });

  ws.on("message", async (data) => {
    try {
      const frame = JSON.parse(data.toString());
      if (frame.type === "chat" && frame.requestId && frame.payload) {
        handleChatRequest(frame.requestId, frame.payload);
      }
    } catch {
      // Non-JSON or unrecognized frame — ignore
    }
  });

  ws.on("ping", () => {
    ws?.pong();
  });

  ws.on("close", (code, reason) => {
    log.info("Relay connection closed", { code, reason: reason?.toString() });
    ws = null;
    scheduleReconnect();
  });

  ws.on("error", (err) => {
    log.warn("Relay connection error", { error: err.message });
    // close event will fire next, triggering reconnect
  });
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
  if (process.env.RELAY_ENABLED !== "true") {
    log.info("Relay connector disabled (set RELAY_ENABLED=true to enable)");
    return;
  }
  connect();
}

export function stopRelayConnector(): void {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (ws) {
    ws.close(1000, "shutdown");
    ws = null;
  }
}
