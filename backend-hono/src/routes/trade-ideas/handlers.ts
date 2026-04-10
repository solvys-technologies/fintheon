// [claude-code 2026-03-23] Merged trade ideas handler — proposals + Supabase trade_ideas
import type { Context } from "hono";
import {
  getProposalHistory,
  type StoredProposal,
} from "../../services/autopilot/proposal-service.js";
import {
  readTradeIdeas,
  type TradeIdeaRecord,
} from "../../services/supabase-service.js";

export interface TradeIdeaCard {
  id: string;
  source: "proposal" | "notion" | "manual";
  agent: string;
  direction: "long" | "short";
  instrument: string;
  entry: number;
  stopLoss: number;
  takeProfit: number;
  confidence: number;
  status: "open" | "won" | "lost" | "expired";
  pnl?: number;
  createdAt: string;
  closedAt?: string;
  rationale: string;
}

const DEFAULT_USER = "default";
const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

function proposalToCard(p: StoredProposal): TradeIdeaCard | null {
  if (p.direction === "flat" || !p.entryPrice || !p.stopLoss) return null;

  const statusMap: Record<string, TradeIdeaCard["status"]> = {
    pending: "open",
    approved: "open",
    executed: "open",
    rejected: "expired",
    expired: "expired",
    cancelled: "expired",
  };

  return {
    id: p.id,
    source: "proposal",
    agent: `trader:${p.strategyName}`,
    direction: p.direction as "long" | "short",
    instrument: p.instrument,
    entry: p.entryPrice,
    stopLoss: p.stopLoss,
    takeProfit: p.takeProfit?.[0] ?? p.entryPrice,
    confidence: Math.round(p.confidenceScore * 100),
    status: statusMap[p.status] ?? "open",
    createdAt: p.createdAt,
    closedAt: p.executedAt,
    rationale: p.rationale,
  };
}

function supabaseToCard(r: TradeIdeaRecord): TradeIdeaCard | null {
  const rawDir = (r.direction ?? "").toLowerCase();
  if (rawDir !== "long" && rawDir !== "short") return null;
  if (!r.entry_price) return null;

  const statusMap: Record<string, TradeIdeaCard["status"]> = {
    proposed: "open",
    approved: "open",
    open: "open",
    won: "won",
    closed: "won",
    lost: "lost",
    rejected: "expired",
    expired: "expired",
  };

  const rawStatus = (r.status ?? "open").toLowerCase();

  return {
    id: r.id ?? crypto.randomUUID(),
    source: "notion", // Supabase inherited from Notion migration
    agent: r.analyst ?? "unknown",
    direction: rawDir as "long" | "short",
    instrument: r.ticker ?? r.title ?? "UNKNOWN",
    entry: r.entry_price,
    stopLoss: r.stop_loss ?? r.entry_price,
    takeProfit: r.take_profit ?? r.entry_price,
    confidence: r.confidence ?? 0,
    status: statusMap[rawStatus] ?? "open",
    pnl: r.pnl ?? undefined,
    createdAt: r.created_at ?? new Date().toISOString(),
    rationale: r.thesis ?? r.hermes_description ?? r.title ?? "",
  };
}

/** Deduplicate by instrument + direction + entry within a 2-hour window */
function deduplicate(cards: TradeIdeaCard[]): TradeIdeaCard[] {
  const seen = new Map<string, TradeIdeaCard>();

  for (const card of cards) {
    const key = `${card.instrument}:${card.direction}:${card.entry}`;
    const existing = seen.get(key);

    if (!existing) {
      seen.set(key, card);
      continue;
    }

    const diff = Math.abs(
      new Date(card.createdAt).getTime() -
        new Date(existing.createdAt).getTime(),
    );
    if (diff < TWO_HOURS_MS) {
      // Keep the proposal source over notion, or whichever is newer
      if (card.source === "proposal" && existing.source !== "proposal") {
        seen.set(key, card);
      }
    } else {
      // Different time window — different trade, make key unique
      seen.set(`${key}:${card.id}`, card);
    }
  }

  return Array.from(seen.values());
}

export async function handleGetTradeIdeas(c: Context) {
  const limit = Number(c.req.query("limit") ?? 50);
  const statusFilter = c.req.query("status"); // optional: open, won, lost, expired
  const cards: TradeIdeaCard[] = [];

  // Source 1: Autopilot proposals (DB + in-memory)
  const [proposalsResult, supabaseResult] = await Promise.allSettled([
    getProposalHistory(DEFAULT_USER, { limit }),
    readTradeIdeas({ limit }),
  ]);

  if (proposalsResult.status === "fulfilled") {
    for (const p of proposalsResult.value) {
      const card = proposalToCard(p);
      if (card) cards.push(card);
    }
  } else {
    console.error(
      "[TradeIdeas] proposals fetch failed:",
      proposalsResult.reason,
    );
  }

  // Source 2: Supabase trade_ideas (migrated from Notion)
  if (supabaseResult.status === "fulfilled") {
    for (const r of supabaseResult.value) {
      const card = supabaseToCard(r);
      if (card) cards.push(card);
    }
  } else {
    console.error("[TradeIdeas] supabase fetch failed:", supabaseResult.reason);
  }

  // Deduplicate + sort by createdAt DESC
  let ideas = deduplicate(cards).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  // Optional status filter
  if (statusFilter) {
    ideas = ideas.filter((i) => i.status === statusFilter);
  }

  return c.json({ ideas, total: ideas.length });
}
