import type { FeedItem, NewsSource } from '../../types/riskflow.js'

type SSEClient = {
  controller: ReadableStreamDefaultController
  userId: string
}

const clients = new Set<SSEClient>()

/**
 * Register a new SSE subscriber
 */
export function addClient(controller: ReadableStreamDefaultController, userId: string) {
  clients.add({ controller, userId })
}

/**
 * Remove a client from the subscriber list
 */
export function removeClient(controller: ReadableStreamDefaultController) {
  clients.forEach((client) => {
    if (client.controller === controller) {
      clients.delete(client)
    }
  })
}

/**
 * Broadcast a Level 4 feed item to all connected clients
 */
export function broadcastLevel4(item: FeedItem) {
  const payload = `data: ${JSON.stringify(item)}\n\n`
  const encoder = new TextEncoder()

  clients.forEach((client) => {
    try {
      client.controller.enqueue(encoder.encode(payload))
    } catch (error) {
      console.warn('[SSE] Removing client due to enqueue failure', error)
      removeClient(client.controller)
    }
  })
}

// [claude-code 2026-03-23] Browser Use Phase 2 — proposal broadcasting
export interface ProposalBroadcast {
  ticker: string
  direction: 'long' | 'short'
  entry: number
  stopLoss: number
  takeProfit: number | number[]
  screenshotPath?: string
  proposalId?: string
}

export function broadcastProposal(proposal: ProposalBroadcast) {
  const item: FeedItem = {
    id: proposal.proposalId ?? crypto.randomUUID(),
    source: 'Hermes' as NewsSource,
    headline: `${proposal.direction.toUpperCase()} ${proposal.ticker} @ ${proposal.entry}`,
    body: `Entry: ${proposal.entry} | Stop: ${proposal.stopLoss} | Target: ${Array.isArray(proposal.takeProfit) ? proposal.takeProfit.join(', ') : proposal.takeProfit}`,
    symbols: [proposal.ticker],
    tags: ['proposal', proposal.direction],
    isBreaking: true,
    urgency: 'high',
    sentiment: proposal.direction === 'long' ? 'bullish' : 'bearish',
    ivScore: 8,
    macroLevel: 4,
    publishedAt: new Date().toISOString(),
  }

  broadcastLevel4(item)
}
