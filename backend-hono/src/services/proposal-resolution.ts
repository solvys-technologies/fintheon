// [claude-code 2026-04-28] S47-T2: Proposal/trade resolution into agent performance.
// Records win/loss, resolver timestamp, market close countdown, and agent attribution.

import { createLogger } from "../lib/logger.js";
import {
  writeAgentProposalOutcome,
  readAgentProposalOutcomes,
  type AgentProposalOutcomeRecord,
} from "./supabase-service.js";

const log = createLogger("ProposalResolution");

export interface ResolveProposalInput {
  proposalId: string;
  proposalType: "prediction" | "trade" | "arbitrum";
  agentName: string;
  agentRole?: string;
  direction: "long" | "short" | "flat";
  instrument: string;
  entryPrice?: number;
  exitPrice?: number;
  outcome: "win" | "loss" | "push" | "expired";
  pnl?: number;
  marketCloseCountdownMinutes?: number;
  rationale?: string;
  metadata?: Record<string, unknown>;
}

export async function resolveProposal(
  input: ResolveProposalInput,
): Promise<AgentProposalOutcomeRecord | null> {
  const resolvedAt = new Date().toISOString();
  const record = await writeAgentProposalOutcome({
    proposal_id: input.proposalId,
    proposal_type: input.proposalType,
    agent_name: input.agentName,
    agent_role: input.agentRole ?? null,
    direction: input.direction,
    instrument: input.instrument,
    entry_price: input.entryPrice ?? null,
    exit_price: input.exitPrice ?? null,
    outcome: input.outcome,
    pnl: input.pnl ?? null,
    resolved_at: resolvedAt,
    market_close_countdown_minutes: input.marketCloseCountdownMinutes ?? null,
    rationale: input.rationale ?? null,
    metadata: input.metadata ?? {},
  });
  if (record) {
    log.info("Proposal resolved", {
      proposalId: input.proposalId,
      agent: input.agentName,
      outcome: input.outcome,
      pnl: input.pnl,
    });
  }
  return record;
}

export async function getAgentPerformance(agentName?: string): Promise<{
  total: number;
  wins: number;
  losses: number;
  pushes: number;
  winRate: number;
  avgPnl: number | null;
  records: AgentProposalOutcomeRecord[];
}> {
  const records = await readAgentProposalOutcomes({
    agentName,
    limit: 500,
  });
  const resolved = records.filter(
    (r) => r.outcome !== "pending" && r.outcome !== "expired",
  );
  const wins = resolved.filter((r) => r.outcome === "win").length;
  const losses = resolved.filter((r) => r.outcome === "loss").length;
  const pushes = resolved.filter((r) => r.outcome === "push").length;
  const total = wins + losses + pushes;
  const pnls = resolved
    .map((r) => r.pnl)
    .filter((n): n is number => typeof n === "number");
  const avgPnl =
    pnls.length > 0
      ? Number((pnls.reduce((a, b) => a + b, 0) / pnls.length).toFixed(2))
      : null;
  return {
    total,
    wins,
    losses,
    pushes,
    winRate: total > 0 ? Number(((wins / total) * 100).toFixed(1)) : 0,
    avgPnl,
    records,
  };
}
