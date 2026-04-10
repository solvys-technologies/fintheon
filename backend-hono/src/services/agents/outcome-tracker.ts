// [claude-code 2026-03-11] Futures proposal outcome tracker — closes the loop on agent proposals
// Records proposal lifecycle: created → approved/rejected → executed → outcome (TP/SL hit)

import { isPoolAvailable, query } from "../../db/optimized.js";
import { saveJournalEntry } from "../journal-service.js";
import type { AgentProposal } from "../journal-service.js";

const EXPIRY_CHECK_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
const DEFAULT_USER_ID = "system";

let _intervalId: ReturnType<typeof setInterval> | null = null;

// ── Types ────────────────────────────────────────────────────────────────────

export interface ProposalOutcome {
  proposalId: string;
  userId: string;
  agentName: string;
  instrument: string;
  direction: "long" | "short";
  entryPrice: number;
  exitPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  status:
    | "pending"
    | "approved"
    | "rejected"
    | "executed"
    | "closed"
    | "expired";
  outcome?: "win" | "loss" | "breakeven" | null;
  pnl?: number;
  rrAchieved?: number;
  createdAt: string;
  closedAt?: string;
}

export interface AgentPerformanceStats {
  agentName: string;
  totalProposals: number;
  accepted: number;
  rejected: number;
  expired: number;
  executed: number;
  wins: number;
  losses: number;
  breakeven: number;
  winRate: number;
  avgRR: number;
  totalPnl: number;
  bestTrade: number;
  worstTrade: number;
}

// ── Record Proposal Lifecycle ────────────────────────────────────────────────

/**
 * Record a new proposal from the agent pipeline.
 * Called after Trader Agent generates a proposal.
 */
export async function recordProposal(
  proposalId: string,
  userId: string,
  agentName: string,
  instrument: string,
  direction: "long" | "short",
  entryPrice: number,
  stopLoss?: number,
  takeProfit?: number,
): Promise<void> {
  if (!isPoolAvailable()) return;

  await query(
    `UPDATE trading_proposals SET
      status = 'pending',
      updated_at = NOW()
    WHERE id = $1`,
    [proposalId],
  ).catch(() => {
    // Table may not exist or proposal not found — that's OK
  });
}

/**
 * Record when a proposal is approved or rejected by Risk Manager / user.
 */
export async function recordProposalDecision(
  proposalId: string,
  decision: "approved" | "rejected",
  reason?: string,
): Promise<void> {
  if (!isPoolAvailable()) return;

  await query(
    `UPDATE trading_proposals SET
      status = $2,
      acknowledged_at = NOW(),
      updated_at = NOW()
    WHERE id = $1`,
    [proposalId, decision],
  ).catch((err) => {
    console.warn("[OutcomeTracker] Decision update failed:", err);
  });
}

/**
 * Record a proposal's final outcome (trade hit TP, SL, or expired).
 */
export async function recordProposalOutcome(
  proposalId: string,
  outcome: "win" | "loss" | "breakeven",
  exitPrice: number,
  pnl: number,
): Promise<void> {
  // Update trading_proposals
  if (isPoolAvailable()) {
    await query(
      `UPDATE trading_proposals SET
        status = 'executed',
        execution_result = jsonb_build_object(
          'outcome', $2::text,
          'exitPrice', $3::numeric,
          'pnl', $4::numeric,
          'closedAt', NOW()::text
        ),
        updated_at = NOW()
      WHERE id = $1`,
      [proposalId, outcome, exitPrice, pnl],
    ).catch((err) => {
      console.warn("[OutcomeTracker] Outcome update failed:", err);
    });
  }

  // Record to journal — aggregate with today's other outcomes
  await aggregateDailyPerformance(proposalId, outcome, pnl);
}

/**
 * Aggregate daily performance and save to journal.
 */
async function aggregateDailyPerformance(
  proposalId: string,
  outcome: "win" | "loss" | "breakeven",
  pnl: number,
): Promise<void> {
  const today = new Date().toISOString().split("T")[0];

  if (!isPoolAvailable()) return;

  try {
    // Get all proposals closed today
    const result = await query<Record<string, unknown>>(
      `SELECT id, strategy_name, instrument, direction, entry_price,
              stop_loss, take_profit, execution_result, status, created_at
       FROM trading_proposals
       WHERE user_id = $1
         AND DATE(updated_at) = $2::date
         AND status IN ('executed', 'expired')
       ORDER BY updated_at DESC`,
      [DEFAULT_USER_ID, today],
    ).catch(() => ({ rows: [] }));

    const proposals: AgentProposal[] = result.rows.map((row) => {
      const execResult =
        (row.execution_result as Record<string, unknown>) ?? {};
      return {
        id: row.id as string,
        agent: (row.strategy_name as string) ?? "Trader",
        ticker: (row.instrument as string) ?? "MNQ",
        direction: (row.direction as "long" | "short") ?? "long",
        entry: Number(row.entry_price) || undefined,
        target: row.take_profit
          ? Number((row.take_profit as any)?.primary ?? row.take_profit)
          : undefined,
        stopLoss: row.stop_loss
          ? Number((row.stop_loss as any)?.initial ?? row.stop_loss)
          : undefined,
        status: (row.status === "executed" ? "accepted" : "expired") as
          | "accepted"
          | "expired",
        outcome: (execResult.outcome as "win" | "loss" | "breakeven") ?? null,
        pnl: Number(execResult.pnl) || 0,
        createdAt: row.created_at as string,
      };
    });

    const wins = proposals.filter((p) => p.outcome === "win").length;
    const total = proposals.filter((p) => p.outcome).length;
    const totalPnl = proposals.reduce((s, p) => s + (p.pnl ?? 0), 0);

    // Calculate avg R:R from winning trades
    const winningRRs = proposals
      .filter((p) => p.outcome === "win" && p.entry && p.target && p.stopLoss)
      .map((p) => {
        const risk = Math.abs(p.entry! - p.stopLoss!);
        const reward = Math.abs(p.target! - p.entry!);
        return risk > 0 ? reward / risk : 0;
      });
    const avgRR =
      winningRRs.length > 0
        ? winningRRs.reduce((s, r) => s + r, 0) / winningRRs.length
        : 0;

    await saveJournalEntry(DEFAULT_USER_ID, {
      type: "agent",
      date: today,
      agentName: "Trader",
      proposalCount: proposals.length,
      acceptedCount: proposals.filter((p) => p.status === "accepted").length,
      winRate: total > 0 ? (wins / total) * 100 : 0,
      avgRR,
      totalPnl,
      proposals,
    });
  } catch (err) {
    console.error("[OutcomeTracker] Daily aggregation failed:", err);
  }
}

// ── Expiry Checker ───────────────────────────────────────────────────────────

/**
 * Check for expired proposals and mark them.
 */
async function checkExpiredProposals(): Promise<void> {
  if (!isPoolAvailable()) return;

  try {
    const result = await query<{ id: string; strategy_name: string }>(
      `UPDATE trading_proposals SET
        status = 'expired',
        updated_at = NOW()
      WHERE status = 'pending'
        AND expires_at IS NOT NULL
        AND expires_at < NOW()
      RETURNING id, strategy_name`,
    ).catch(() => ({ rows: [] }));

    if (result.rows.length > 0) {
      console.log(`[OutcomeTracker] Expired ${result.rows.length} proposals`);
    }
  } catch (err) {
    console.error("[OutcomeTracker] Expiry check failed:", err);
  }
}

// ── Performance Aggregation ──────────────────────────────────────────────────

/**
 * Get aggregated performance stats per agent over a time range.
 */
export async function getAgentPerformance(
  days: number = 30,
): Promise<AgentPerformanceStats[]> {
  const since = new Date(Date.now() - days * 86400000).toISOString();

  if (!isPoolAvailable()) {
    return [];
  }

  try {
    const result = await query<Record<string, unknown>>(
      `SELECT
        COALESCE(strategy_name, 'Trader') AS agent_name,
        COUNT(*)::int AS total_proposals,
        COUNT(*) FILTER (WHERE status = 'approved' OR status = 'executed')::int AS accepted,
        COUNT(*) FILTER (WHERE status = 'rejected')::int AS rejected,
        COUNT(*) FILTER (WHERE status = 'expired')::int AS expired,
        COUNT(*) FILTER (WHERE status = 'executed')::int AS executed,
        COUNT(*) FILTER (WHERE execution_result->>'outcome' = 'win')::int AS wins,
        COUNT(*) FILTER (WHERE execution_result->>'outcome' = 'loss')::int AS losses,
        COUNT(*) FILTER (WHERE execution_result->>'outcome' = 'breakeven')::int AS breakeven,
        COALESCE(SUM((execution_result->>'pnl')::numeric), 0) AS total_pnl,
        COALESCE(MAX((execution_result->>'pnl')::numeric), 0) AS best_trade,
        COALESCE(MIN((execution_result->>'pnl')::numeric), 0) AS worst_trade
      FROM trading_proposals
      WHERE created_at >= $1
      GROUP BY COALESCE(strategy_name, 'Trader')
      ORDER BY total_proposals DESC`,
      [since],
    ).catch(() => ({ rows: [] }));

    return result.rows.map((row) => {
      const executed = Number(row.executed);
      const wins = Number(row.wins);
      const losses = Number(row.losses);
      const resolved = wins + losses + Number(row.breakeven);

      return {
        agentName: row.agent_name as string,
        totalProposals: Number(row.total_proposals),
        accepted: Number(row.accepted),
        rejected: Number(row.rejected),
        expired: Number(row.expired),
        executed,
        wins,
        losses,
        breakeven: Number(row.breakeven),
        winRate: resolved > 0 ? (wins / resolved) * 100 : 0,
        avgRR: 0, // Computed from individual trades, not aggregatable in SQL easily
        totalPnl: Number(row.total_pnl),
        bestTrade: Number(row.best_trade),
        worstTrade: Number(row.worst_trade),
      };
    });
  } catch (err) {
    console.error("[OutcomeTracker] Performance query failed:", err);
    return [];
  }
}

/**
 * Get combined performance (futures + polymarket predictions).
 */
export async function getCombinedPerformance(days: number = 30): Promise<{
  futures: AgentPerformanceStats[];
  predictions: {
    total: number;
    resolved: number;
    wins: number;
    losses: number;
    winRate: number;
  };
  combined: {
    totalDecisions: number;
    totalWins: number;
    overallWinRate: number;
    totalPnl: number;
  };
}> {
  const [futures, predictionStats] = await Promise.all([
    getAgentPerformance(days),
    getPredictionStatsFromDB(days),
  ]);

  const futuresWins = futures.reduce((s, f) => s + f.wins, 0);
  const futuresResolved = futures.reduce(
    (s, f) => s + f.wins + f.losses + f.breakeven,
    0,
  );
  const futuresPnl = futures.reduce((s, f) => s + f.totalPnl, 0);

  const totalDecisions = futuresResolved + predictionStats.resolved;
  const totalWins = futuresWins + predictionStats.wins;

  return {
    futures,
    predictions: predictionStats,
    combined: {
      totalDecisions,
      totalWins,
      overallWinRate:
        totalDecisions > 0 ? (totalWins / totalDecisions) * 100 : 0,
      totalPnl: futuresPnl + predictionStats.wins - predictionStats.losses, // Predictions are binary
    },
  };
}

async function getPredictionStatsFromDB(days: number): Promise<{
  total: number;
  resolved: number;
  wins: number;
  losses: number;
  winRate: number;
}> {
  if (!isPoolAvailable()) {
    return { total: 0, resolved: 0, wins: 0, losses: 0, winRate: 0 };
  }

  try {
    const since = new Date(Date.now() - days * 86400000).toISOString();
    const result = await query<Record<string, unknown>>(
      `SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE resolved = true)::int AS resolved,
        COUNT(*) FILTER (WHERE result = 'win')::int AS wins,
        COUNT(*) FILTER (WHERE result = 'loss')::int AS losses
      FROM polymarket_predictions
      WHERE created_at >= $1`,
      [since],
    ).catch(() => ({ rows: [{ total: 0, resolved: 0, wins: 0, losses: 0 }] }));

    const row = result.rows[0] ?? {};
    const resolved = Number(row.resolved ?? 0);
    const wins = Number(row.wins ?? 0);
    return {
      total: Number(row.total ?? 0),
      resolved,
      wins,
      losses: Number(row.losses ?? 0),
      winRate: resolved > 0 ? (wins / resolved) * 100 : 0,
    };
  } catch {
    return { total: 0, resolved: 0, wins: 0, losses: 0, winRate: 0 };
  }
}

// ── Polling ──────────────────────────────────────────────────────────────────

export function startOutcomeTracking(): void {
  if (_intervalId) return;

  console.log("[OutcomeTracker] Starting proposal outcome tracking...");

  // Check expired proposals immediately, then every 15 minutes
  checkExpiredProposals();
  _intervalId = setInterval(checkExpiredProposals, EXPIRY_CHECK_INTERVAL_MS);

  console.log(
    `[OutcomeTracker] Checking expirations every ${EXPIRY_CHECK_INTERVAL_MS / 60000}m`,
  );
}

export function stopOutcomeTracking(): void {
  if (_intervalId) {
    clearInterval(_intervalId);
    _intervalId = null;
  }
  console.log("[OutcomeTracker] Stopped");
}
