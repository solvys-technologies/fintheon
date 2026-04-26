// [claude-code 2026-04-25] S40-P9: consul-browser SSE channel — backend pushes
// session state changes to all subscribed clients on /api/browserbase/stream.

import { createLogger } from "../../lib/logger.js";

const log = createLogger("Browserbase:SSE");

interface SSEClient {
  controller: ReadableStreamDefaultController;
  userId: string;
}

const clients = new Set<SSEClient>();

export function addClient(
  controller: ReadableStreamDefaultController,
  userId: string,
): void {
  clients.add({ controller, userId });
}

export function removeClient(
  controller: ReadableStreamDefaultController,
): void {
  for (const c of clients) {
    if (c.controller === controller) {
      clients.delete(c);
      break;
    }
  }
}

export interface ConsulBrowserEvent {
  userId: string;
  state: "active" | "closed" | "navigated" | "extracted";
  session: { id: string; liveUrl: string } | null;
  context?: Record<string, unknown>;
}

export function broadcastConsulBrowser(event: ConsulBrowserEvent): void {
  const frame = `event: consul-browser\ndata: ${JSON.stringify(event)}\n\n`;
  const encoder = new TextEncoder();
  for (const client of clients) {
    if (client.userId !== event.userId) continue;
    try {
      client.controller.enqueue(encoder.encode(frame));
    } catch (err) {
      log.warn("SSE enqueue failed; dropping client", {
        error: err instanceof Error ? err.message : String(err),
      });
      clients.delete(client);
    }
  }
}
