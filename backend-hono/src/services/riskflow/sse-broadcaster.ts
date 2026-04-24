// [claude-code 2026-04-24] S34-T6: Added broadcastEconPrint for countdown modal SSE hook
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

// [claude-code 2026-04-24] S34-T6: Econ-print broadcast — countdown modal flips
// from countdown → "Actual X vs Forecast Y" in-place when this fires.
export interface EconPrintBroadcast {
  rawItemId?: string;
  tweetId?: string;
  event: EconEvent;
  country: string;
  category: string;
  actual?: number;
  forecast?: number;
  previous?: number;
  headline: string;
}

export function broadcastEconPrint(print: EconPrintBroadcast) {
  const payload = `event: econ-print\ndata: ${JSON.stringify({
    type: "econ-print",
    event: {
      id: print.event.id,
      name: print.event.name,
      country: print.country,
      category: print.category,
      date: print.event.date,
      time: print.event.time,
    },
    rawItemId: print.rawItemId,
    tweetId: print.tweetId,
    actual: print.actual ?? null,
    forecast: print.forecast ?? null,
    previous: print.previous ?? null,
    headline: print.headline,
    at: new Date().toISOString(),
  })}\n\n`;

  const encoder = new TextEncoder();
  clients.forEach((client) => {
    try {
      client.controller.enqueue(encoder.encode(payload));
    } catch (error) {
      console.warn("[SSE] Removing client (econ-print enqueue failure)", error);
      removeClient(client.controller);
    }
  });
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
