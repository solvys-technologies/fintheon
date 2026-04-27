// [claude-code 2026-04-24] S34-T6/T8: broadcastEconPrint SSE channel feeds the countdown modal on print arrival.
import type { FeedItem, NewsSource } from "../../types/riskflow.js";
import type { EconEvent } from "../econ-calendar-service.js";

type SSEClient = {
  controller: ReadableStreamDefaultController;
  userId: string;
};

const clients = new Set<SSEClient>();

/**
 * Register a new SSE subscriber
 */
export function addClient(
  controller: ReadableStreamDefaultController,
  userId: string,
) {
  clients.add({ controller, userId });
}

/**
 * Remove a client from the subscriber list
 */
export function removeClient(controller: ReadableStreamDefaultController) {
  clients.forEach((client) => {
    if (client.controller === controller) {
      clients.delete(client);
    }
  });
}

/**
 * Broadcast a Level 4 feed item to all connected clients
 */
export function broadcastLevel4(item: FeedItem) {
  // Hard gate: this channel is reserved for Level 4 catalysts only.
  if (item.macroLevel !== 4) return;

  // [claude-code 2026-04-18] S25-T5: Level 4 trips hot-mode — the next HOT_WINDOW_MS (30 min)
  // polls at 15s across all tiers so breaking catalysts don't sit idle.
  import("./polling-config.js").then((m) => m.triggerHotMode()).catch(() => {});

  const payload = `data: ${JSON.stringify(item)}\n\n`;
  const encoder = new TextEncoder();

  clients.forEach((client) => {
    try {
      client.controller.enqueue(encoder.encode(payload));
    } catch (error) {
      console.warn("[SSE] Removing client due to enqueue failure", error);
      removeClient(client.controller);
    }
  });
}

// [claude-code 2026-03-23] Browser Use Phase 2 — proposal broadcasting
export interface ProposalBroadcast {
  ticker: string;
  direction: "long" | "short";
  entry: number;
  stopLoss: number;
  takeProfit: number | number[];
  screenshotPath?: string;
  proposalId?: string;
}

export function broadcastProposal(proposal: ProposalBroadcast) {
  const item: FeedItem = {
    id: proposal.proposalId ?? crypto.randomUUID(),
    source: "Hermes" as NewsSource,
    headline: `${proposal.direction.toUpperCase()} ${proposal.ticker} @ ${proposal.entry}`,
    body: `Entry: ${proposal.entry} | Stop: ${proposal.stopLoss} | Target: ${Array.isArray(proposal.takeProfit) ? proposal.takeProfit.join(", ") : proposal.takeProfit}`,
    symbols: [proposal.ticker],
    tags: ["proposal", proposal.direction],
    isBreaking: true,
    urgency: "high",
    sentiment: proposal.direction === "long" ? "bullish" : "bearish",
    ivScore: 8,
    macroLevel: 4,
    publishedAt: new Date().toISOString(),
  };

  broadcastLevel4(item);
}

export interface EconPrintPayload {
  eventId?: string;
  eventName: string;
  actual: number;
  forecast?: number | null;
  previous?: number | null;
  surprisePercent?: number | null;
  beatMiss: "beat" | "miss" | "inline";
  printedAt: string;
}

export function broadcastEconPrint(payload: EconPrintPayload) {
  const frame = `event: econ-print\ndata: ${JSON.stringify(payload)}\n\n`;
  const encoder = new TextEncoder();

  clients.forEach((client) => {
    try {
      client.controller.enqueue(encoder.encode(frame));
    } catch (error) {
      console.warn(
        "[SSE] Removing client due to econ-print enqueue failure",
        error,
      );
      removeClient(client.controller);
    }
  });
}

// [claude-code 2026-04-25] S40-P6: Time-To-Print widget channel.
//   imminent → live → printed → cleared.
// Frontend's useTimeToPrint reads this and drives TimeToPrintDockable.
export interface TimeToPrintPayload {
  id: string;
  fires_at: string; // ISO; the scheduled release time
  state: "imminent" | "live" | "printed" | "cleared";
  event: {
    name: string;
    country: string; // ISO code, e.g. "US"
    forecast?: string | null;
    actual?: string | null;
    beatMiss?: "beat" | "miss" | "inline" | null;
    surprisePercent?: number | null;
    impactRank?: number | null;
  };
}

export function broadcastTimeToPrint(payload: TimeToPrintPayload) {
  const frame = `event: time-to-print\ndata: ${JSON.stringify(payload)}\n\n`;
  const encoder = new TextEncoder();

  clients.forEach((client) => {
    try {
      client.controller.enqueue(encoder.encode(frame));
    } catch (error) {
      console.warn(
        "[SSE] Removing client due to time-to-print enqueue failure",
        error,
      );
      removeClient(client.controller);
    }
  });
}
