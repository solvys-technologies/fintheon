/**
 * Proposal Service
 * Manages trading proposal lifecycle for AutoPilot
 * Phase 7 - v.5.11.1
 */

import { sql, isDatabaseAvailable } from "../../config/database.js";
import { runAgentPipeline } from "../agents/pipeline.js";
import type {
  AgentPipelineResult,
  TradingProposal,
  RiskAssessment,
} from "../../types/agents.js";
import type { BulletinPost } from "../../types/bulletin.js";
import * as rithmicService from "../rithmic-service.js";
import * as hyperliquidService from "../hyperliquid-service.js";

export interface StoredProposal {
  id: string;
  userId: string;
  strategyName: string;
  instrument: string;
  direction: "long" | "short" | "flat";
  entryPrice?: number;
  stopLoss?: number;
  takeProfit?: number[];
  positionSize: number;
  riskRewardRatio: number;
  confidenceScore: number;
  rationale: string;
  analystInputs: Record<string, string>;
  timeframe: string;
  setupType: string;
  status:
    | "pending"
    | "approved"
    | "rejected"
    | "executed"
    | "expired"
    | "cancelled";
  expiresAt: string;
  acknowledgedAt?: string;
  executedAt?: string;
  executionResult?: Record<string, unknown>;
  riskAssessmentId?: string;
  debateId?: string;
  createdAt: string;
  updatedAt: string;
}

// Default proposal expiration (5 minutes)
const PROPOSAL_TTL_MS = 5 * 60 * 1000;

// In-memory cache for proposals (fallback when no DB)
const proposalCache = new Map<string, StoredProposal>();

/**
 * Generate a new proposal by running the full agent pipeline
 */
export async function generateProposal(
  userId: string,
  options: {
    currentPrice?: number;
    accountSize?: number;
    currentPnL?: number;
    vixLevel?: number;
  } = {},
): Promise<{
  proposal: StoredProposal | null;
  pipelineResult: AgentPipelineResult;
}> {
  const pipelineResult = await runAgentPipeline(userId, {
    includeDebate: true,
    includeProposal: true,
    ...options,
  });

  // If no trade recommended, return null proposal
  if (!pipelineResult.proposal?.tradeRecommended) {
    return { proposal: null, pipelineResult };
  }

  // If risk assessment rejected, return null proposal
  if (pipelineResult.riskAssessment?.decision === "rejected") {
    return { proposal: null, pipelineResult };
  }

  // Create and store the proposal
  const proposal = await createProposal(userId, pipelineResult);

  return { proposal, pipelineResult };
}

/**
 * Create and store a proposal from pipeline result
 */
export async function createProposal(
  userId: string,
  pipelineResult: AgentPipelineResult,
): Promise<StoredProposal> {
  const { proposal: traderProposal, riskAssessment, debate } = pipelineResult;

  if (!traderProposal) {
    throw new Error("No trader proposal in pipeline result");
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + PROPOSAL_TTL_MS);

  const storedProposal: StoredProposal = {
    id: crypto.randomUUID(),
    userId,
    strategyName: traderProposal.strategyName,
    instrument: traderProposal.instrument,
    direction: traderProposal.direction,
    entryPrice: traderProposal.entryPrice,
    stopLoss: traderProposal.stopLoss,
    takeProfit: traderProposal.takeProfit,
    positionSize: traderProposal.positionSize,
    riskRewardRatio: traderProposal.riskRewardRatio,
    confidenceScore: traderProposal.confidence / 100, // Normalize to 0-1
    rationale: traderProposal.rationale,
    analystInputs: traderProposal.analystInputs,
    timeframe: traderProposal.timeframe,
    setupType: traderProposal.setupType,
    status: "pending",
    expiresAt: expiresAt.toISOString(),
    riskAssessmentId: riskAssessment?.id,
    debateId: debate?.id,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };

  // Store to database
  if (isDatabaseAvailable() && sql) {
    await sql`
      INSERT INTO trading_proposals (
        id, user_id, strategy_name, instrument, direction,
        entry_price, stop_loss, take_profit, position_size, risk_reward_ratio,
        confidence_score, rationale, analyst_inputs, timeframe, setup_type,
        status, expires_at, risk_assessment_id, debate_id
      ) VALUES (
        ${storedProposal.id},
        ${userId},
        ${storedProposal.strategyName},
        ${storedProposal.instrument},
        ${storedProposal.direction},
        ${storedProposal.entryPrice ?? null},
        ${storedProposal.stopLoss ?? null},
        ${JSON.stringify(storedProposal.takeProfit)}::jsonb,
        ${storedProposal.positionSize},
        ${storedProposal.riskRewardRatio},
        ${storedProposal.confidenceScore},
        ${storedProposal.rationale},
        ${JSON.stringify(storedProposal.analystInputs)}::jsonb,
        ${storedProposal.timeframe},
        ${storedProposal.setupType},
        ${storedProposal.status},
        ${storedProposal.expiresAt},
        ${storedProposal.riskAssessmentId ?? null},
        ${storedProposal.debateId ?? null}
      )
    `;
  } else {
    // In-memory fallback
    proposalCache.set(storedProposal.id, storedProposal);
  }

  // [claude-code 2026-03-23] Browser Use Phase 2 — auto-chart on proposal creation
  if (storedProposal.entryPrice && storedProposal.stopLoss) {
    const port = process.env.PORT || "8080";
    fetch(`http://localhost:${port}/api/proposals/chart`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ticker: storedProposal.instrument,
        direction: storedProposal.direction,
        entry: storedProposal.entryPrice,
        stopLoss: storedProposal.stopLoss,
        takeProfit: storedProposal.takeProfit?.[0] ?? storedProposal.entryPrice,
        proposalId: storedProposal.id,
      }),
    }).catch((err) =>
      console.error("[Proposal] Auto-chart failed:", (err as Error).message),
    );
  }

  return storedProposal;
}

/**
 * Create a proposal from a bulletin post that reached the vote threshold.
 * Called by vote-counter.ts when voteCheck >= BULLETIN_VOTE_THRESHOLD.
 */
export async function createProposalFromBulletin(
  bulletin: BulletinPost,
  promotedBy: string,
): Promise<StoredProposal> {
  // Extract instrument from content
  const stockMatch = bulletin.content.match(/\$([A-Z]{1,5})/);
  const futuresMatch = bulletin.content.match(/(?:^|\s)\/([A-Z]{2,4})(?:\s|$)/);
  const instrument = stockMatch?.[1] ?? futuresMatch?.[1] ?? "UNKNOWN";

  // Direction: more up votes = long, more down = short, else neutral mapped to flat
  const direction: "long" | "short" | "flat" =
    bulletin.voteUp > bulletin.voteDown
      ? "long"
      : bulletin.voteDown > bulletin.voteUp
        ? "short"
        : "flat";

  // Confidence from check vs x votes
  const totalCheckX = bulletin.voteCheck + bulletin.voteX;
  const confidenceScore =
    totalCheckX > 0 ? bulletin.voteCheck / totalCheckX : 0.5;

  const now = new Date();
  const expiresAt = new Date(now.getTime() + PROPOSAL_TTL_MS);

  const storedProposal: StoredProposal = {
    id: crypto.randomUUID(),
    userId: promotedBy,
    strategyName: "BULLETIN_VOTE",
    instrument,
    direction,
    positionSize: 1,
    riskRewardRatio: 1, // placeholder — enriched by trade plan generation if Computer Use available
    confidenceScore,
    rationale: bulletin.content,
    analystInputs: {
      source: "bulletin",
      bulletinId: bulletin.id,
      authorId: bulletin.authorId,
    },
    timeframe: "intraday",
    setupType: "bulletin_promotion",
    status: "pending",
    expiresAt: expiresAt.toISOString(),
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };

  if (isDatabaseAvailable() && sql) {
    await sql`
      INSERT INTO trading_proposals (
        id, user_id, strategy_name, instrument, direction,
        position_size, risk_reward_ratio,
        confidence_score, rationale, analyst_inputs, timeframe, setup_type,
        status, expires_at
      ) VALUES (
        ${storedProposal.id},
        ${promotedBy},
        ${storedProposal.strategyName},
        ${storedProposal.instrument},
        ${storedProposal.direction},
        ${storedProposal.positionSize},
        ${storedProposal.riskRewardRatio},
        ${storedProposal.confidenceScore},
        ${storedProposal.rationale},
        ${JSON.stringify(storedProposal.analystInputs)}::jsonb,
        ${storedProposal.timeframe},
        ${storedProposal.setupType},
        ${storedProposal.status},
        ${storedProposal.expiresAt}
      )
    `;
  } else {
    proposalCache.set(storedProposal.id, storedProposal);
  }

  console.log(
    `[Proposal] Created from bulletin ${bulletin.id} → ${instrument} ${direction}`,
  );
  return storedProposal;
}

/**
 * Get pending proposals for a user
 */
export async function getPendingProposals(
  userId: string,
): Promise<StoredProposal[]> {
  if (isDatabaseAvailable() && sql) {
    const result = await sql`
      SELECT * FROM trading_proposals
      WHERE user_id = ${userId}
        AND status = 'pending'
        AND expires_at > NOW()
      ORDER BY created_at DESC
      LIMIT 10
    `;
    return result.map(mapRowToProposal);
  }

  // In-memory fallback
  const now = Date.now();
  return Array.from(proposalCache.values())
    .filter(
      (p) =>
        p.userId === userId &&
        p.status === "pending" &&
        new Date(p.expiresAt).getTime() > now,
    )
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
    .slice(0, 10);
}

/**
 * Get a proposal by ID
 */
export async function getProposal(
  proposalId: string,
): Promise<StoredProposal | null> {
  if (isDatabaseAvailable() && sql) {
    const result = await sql`
      SELECT * FROM trading_proposals WHERE id = ${proposalId}
    `;
    if (result.length === 0) return null;
    return mapRowToProposal(result[0]);
  }

  return proposalCache.get(proposalId) ?? null;
}

/**
 * Acknowledge (approve/reject) a proposal
 */
export async function acknowledgeProposal(
  proposalId: string,
  decision: "approved" | "rejected",
  userId: string,
): Promise<StoredProposal | null> {
  const proposal = await getProposal(proposalId);

  if (!proposal) {
    throw new Error("Proposal not found");
  }

  if (proposal.userId !== userId) {
    throw new Error("Unauthorized");
  }

  if (proposal.status !== "pending") {
    throw new Error(`Proposal already ${proposal.status}`);
  }

  const now = new Date();

  if (isDatabaseAvailable() && sql) {
    await sql`
      UPDATE trading_proposals
      SET status = ${decision},
          acknowledged_at = ${now.toISOString()}
      WHERE id = ${proposalId}
    `;
  } else {
    proposal.status = decision;
    proposal.acknowledgedAt = now.toISOString();
    proposal.updatedAt = now.toISOString();
    proposalCache.set(proposalId, proposal);
  }

  return { ...proposal, status: decision, acknowledgedAt: now.toISOString() };
}

/**
 * Execute an approved proposal
 */
export async function executeProposal(
  proposalId: string,
  userId: string,
): Promise<{ success: boolean; orderId?: string; error?: string }> {
  const proposal = await getProposal(proposalId);

  if (!proposal) {
    return { success: false, error: "Proposal not found" };
  }

  if (proposal.userId !== userId) {
    return { success: false, error: "Unauthorized" };
  }

  if (proposal.status !== "approved") {
    return {
      success: false,
      error: `Proposal must be approved first (current: ${proposal.status})`,
    };
  }

  const primaryBroker = (process.env.PRIMARY_BROKER ?? "rithmic") as
    | "rithmic"
    | "projectx"
    | "hyperliquid";

  // [claude-code 2026-03-28] S5-T3: ProjectX path — reconciler gate before bridge call
  if (primaryBroker === "projectx") {
    const { executeWithReconciliation } =
      await import("../reconciler-service.js");
    const bridgeUrl = process.env.BRIDGE_URL ?? "http://localhost:8001";

    const bridgeCall = async (
      req: import("../../types/execution-bridge.js").BridgeExecuteRequest,
    ) => {
      const res = await fetch(`${bridgeUrl}/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req),
      });
      return res.json() as Promise<
        import("../../types/execution-bridge.js").BridgeExecuteResponse
      >;
    };
    const positionQuery = async () => {
      const res = await fetch(`${bridgeUrl}/position`);
      return res.json() as Promise<
        import("../../types/execution-bridge.js").BridgePositionResponse
      >;
    };
    const accountQuery = async () => {
      const res = await fetch(`${bridgeUrl}/account`);
      return res.json() as Promise<
        import("../../types/execution-bridge.js").BridgeAccountResponse
      >;
    };

    const result = await executeWithReconciliation(
      {
        model: proposal.setupType || "40_40_club",
        direction: proposal.direction as "long" | "short",
        symbol: proposal.instrument,
        confluence_score: Math.round(proposal.confidenceScore * 15),
        position_size: proposal.positionSize,
        entry_price: proposal.entryPrice ?? null,
        stop_loss_ticks: 12, // TODO: derive from proposal.stopLoss
        take_profit_ticks: 24, // TODO: derive from proposal.takeProfit
      },
      bridgeCall,
      positionQuery,
      accountQuery,
    );

    if (!result.success) {
      return {
        success: false,
        error: result.order.lastError ?? "Reconciler rejected",
      };
    }

    const now = new Date();
    const executionResult = {
      orderId: result.order.bridgeOrderId ?? `PX-${Date.now()}`,
      filledAt: now.toISOString(),
      fillPrice: proposal.entryPrice,
      contracts: proposal.positionSize,
      reconcilerStatus: result.order.state,
      message: "Order executed via ProjectX bridge",
    };
    const orderId = result.order.bridgeOrderId ?? executionResult.orderId;

    if (isDatabaseAvailable() && sql) {
      await sql`
        UPDATE trading_proposals
        SET status = 'executed',
            executed_at = ${now.toISOString()},
            execution_result = ${JSON.stringify(executionResult)}::jsonb,
            projectx_order_id = ${orderId}
        WHERE id = ${proposalId}
      `;
    } else {
      proposal.status = "executed";
      proposal.executedAt = now.toISOString();
      proposal.executionResult = executionResult;
      proposal.updatedAt = now.toISOString();
      proposalCache.set(proposalId, proposal);
    }

    return { success: true, orderId };
  }

  if (primaryBroker === "hyperliquid") {
    const result = await hyperliquidService.executeOrder(userId, {
      symbol: proposal.instrument,
      direction: proposal.direction as "long" | "short",
      quantity: proposal.positionSize,
      entryPrice: proposal.entryPrice,
      stopLoss: proposal.stopLoss,
      takeProfit: proposal.takeProfit,
    });
    if (!result.success) {
      return {
        success: false,
        error: result.error ?? "Hyperliquid execution failed",
      };
    }
    const now = new Date();
    const executionResult = {
      orderId: result.orderId ?? `HL-${Date.now()}`,
      filledAt: now.toISOString(),
      fillPrice: proposal.entryPrice,
      contracts: proposal.positionSize,
      message: "Order sent to Hyperliquid",
    };
    const orderId = result.orderId ?? executionResult.orderId;
    if (isDatabaseAvailable() && sql) {
      await sql`
        UPDATE trading_proposals
        SET status = 'executed',
            executed_at = ${now.toISOString()},
            execution_result = ${JSON.stringify(executionResult)}::jsonb,
            projectx_order_id = ${orderId}
        WHERE id = ${proposalId}
      `;
    } else {
      proposal.status = "executed";
      proposal.executedAt = now.toISOString();
      proposal.executionResult = executionResult;
      proposal.updatedAt = now.toISOString();
      proposalCache.set(proposalId, proposal);
    }
    return { success: true, orderId };
  }

  if (primaryBroker === "rithmic") {
    const result = await rithmicService.executeOrder(userId, {
      symbol: proposal.instrument,
      direction: proposal.direction as "long" | "short",
      quantity: proposal.positionSize,
      entryPrice: proposal.entryPrice,
      stopLoss: proposal.stopLoss,
      takeProfit: proposal.takeProfit,
    });
    if (!result.success) {
      return {
        success: false,
        error: result.error ?? "Rithmic execution failed",
      };
    }
    const now = new Date();
    const executionResult = {
      orderId: result.orderId ?? `RITHMIC-${Date.now()}`,
      filledAt: now.toISOString(),
      fillPrice: proposal.entryPrice,
      contracts: proposal.positionSize,
      message: "Order sent to Rithmic (stub)",
    };
    const orderId = result.orderId ?? executionResult.orderId;
    if (isDatabaseAvailable() && sql) {
      await sql`
        UPDATE trading_proposals
        SET status = 'executed',
            executed_at = ${now.toISOString()},
            execution_result = ${JSON.stringify(executionResult)}::jsonb,
            projectx_order_id = ${orderId}
        WHERE id = ${proposalId}
      `;
    } else {
      proposal.status = "executed";
      proposal.executedAt = now.toISOString();
      proposal.executionResult = executionResult;
      proposal.updatedAt = now.toISOString();
      proposalCache.set(proposalId, proposal);
    }
    return { success: true, orderId };
  }

  return { success: false, error: `Unknown broker: ${primaryBroker}` };
}

/**
 * Get proposal history for a user
 */
export async function getProposalHistory(
  userId: string,
  options: { limit?: number; status?: string } = {},
): Promise<StoredProposal[]> {
  const limit = options.limit ?? 20;

  if (isDatabaseAvailable() && sql) {
    const statusFilter = options.status
      ? sql`AND status = ${options.status}`
      : sql``;

    const result = await sql`
      SELECT * FROM trading_proposals
      WHERE user_id = ${userId}
      ${statusFilter}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;
    return result.map(mapRowToProposal);
  }

  // In-memory fallback
  return Array.from(proposalCache.values())
    .filter(
      (p) =>
        p.userId === userId && (!options.status || p.status === options.status),
    )
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
    .slice(0, limit);
}

/**
 * Expire old pending proposals
 */
export async function expireOldProposals(): Promise<number> {
  if (isDatabaseAvailable() && sql) {
    const result = await sql`
      UPDATE trading_proposals
      SET status = 'expired'
      WHERE status = 'pending'
        AND expires_at < NOW()
      RETURNING id
    `;
    return result.length;
  }

  // In-memory cleanup
  const now = Date.now();
  let expiredCount = 0;

  for (const [id, proposal] of proposalCache.entries()) {
    if (
      proposal.status === "pending" &&
      new Date(proposal.expiresAt).getTime() < now
    ) {
      proposal.status = "expired";
      proposal.updatedAt = new Date().toISOString();
      proposalCache.set(id, proposal);
      expiredCount++;
    }
  }

  return expiredCount;
}

/**
 * Map database row to StoredProposal
 */
function mapRowToProposal(row: Record<string, unknown>): StoredProposal {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    strategyName: String(row.strategy_name),
    instrument: String(row.instrument),
    direction: String(row.direction) as "long" | "short" | "flat",
    entryPrice: row.entry_price as number | undefined,
    stopLoss: row.stop_loss as number | undefined,
    takeProfit: (row.take_profit as number[]) ?? [],
    positionSize: Number(row.position_size),
    riskRewardRatio: Number(row.risk_reward_ratio),
    confidenceScore: Number(row.confidence_score),
    rationale: String(row.rationale),
    analystInputs: (row.analyst_inputs as Record<string, string>) ?? {},
    timeframe: String(row.timeframe),
    setupType: String(row.setup_type),
    status: String(row.status) as StoredProposal["status"],
    expiresAt: String(row.expires_at),
    acknowledgedAt: row.acknowledged_at as string | undefined,
    executedAt: row.executed_at as string | undefined,
    executionResult: row.execution_result as
      | Record<string, unknown>
      | undefined,
    riskAssessmentId: row.risk_assessment_id as string | undefined,
    debateId: row.debate_id as string | undefined,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}
