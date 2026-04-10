// [claude-code 2026-04-10] S8-T1: SurfaceRouter — SSE client management per surface

import type { ReadableStreamDefaultController } from "stream/web";
import type {
  SurfaceId,
  AgentStreamEvent,
  NarrativePushEvent,
  SidebarNotifyEvent,
} from "./types.js";
import { agentBus } from "./bus.js";

interface SSEClient {
  controller: ReadableStreamDefaultController<Uint8Array>;
  userId: string;
  surface: SurfaceId;
  connectedAt: number;
}

/**
 * SurfaceRouter — manages SSE subscriptions per surface.
 *
 * Each surface (narrative, sidebar, boardroom) gets its own SSE endpoint.
 * Clients register via addClient(), receive typed events from the AgentBus.
 */
class SurfaceRouter {
  private clients = new Set<SSEClient>();
  private unsubscribers: Array<() => void> = [];

  /** Start listening to AgentBus topics and routing to surfaces */
  start(): void {
    // Route boardroom events
    this.unsubscribers.push(
      agentBus.subscribe<AgentStreamEvent>("surface.boardroom", (msg) => {
        this.broadcastToSurface("boardroom", msg.payload);
      }),
    );

    // Route narrative push events
    this.unsubscribers.push(
      agentBus.subscribe<NarrativePushEvent>("surface.narrative", (msg) => {
        this.broadcastToSurface("narrative", msg.payload);
      }),
    );

    // Route sidebar notifications
    this.unsubscribers.push(
      agentBus.subscribe<SidebarNotifyEvent>("surface.sidebar", (msg) => {
        this.broadcastToSurface("sidebar", msg.payload);
      }),
    );
  }

  /** Stop all subscriptions */
  stop(): void {
    this.unsubscribers.forEach((unsub) => unsub());
    this.unsubscribers = [];
  }

  /** Register an SSE client for a surface */
  addClient(
    controller: ReadableStreamDefaultController<Uint8Array>,
    userId: string,
    surface: SurfaceId,
  ): void {
    this.clients.add({ controller, userId, surface, connectedAt: Date.now() });
  }

  /** Remove an SSE client on disconnect */
  removeClient(controller: ReadableStreamDefaultController<Uint8Array>): void {
    for (const client of this.clients) {
      if (client.controller === controller) {
        this.clients.delete(client);
        break;
      }
    }
  }

  /** Broadcast a payload to all clients subscribed to a surface */
  private broadcastToSurface(surface: SurfaceId, payload: unknown): void {
    const data = `data: ${JSON.stringify(payload)}\n\n`;
    const bytes = new TextEncoder().encode(data);

    for (const client of this.clients) {
      if (client.surface === surface) {
        try {
          client.controller.enqueue(bytes);
        } catch {
          // Client disconnected, remove silently
          this.clients.delete(client);
        }
      }
    }
  }

  /** Get connected client count per surface */
  get stats() {
    const counts: Record<string, number> = {};
    for (const client of this.clients) {
      counts[client.surface] = (counts[client.surface] || 0) + 1;
    }
    return { clients: this.clients.size, bySurface: counts };
  }
}

// Singleton export
export const surfaceRouter = new SurfaceRouter();
