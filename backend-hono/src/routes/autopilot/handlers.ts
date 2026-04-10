/**
 * AutoPilot Handlers
 * Request handlers for autopilot proposal workflow
 * Phase 7 - v.5.11.1
 */

import type { Context } from "hono";
import * as proposalService from "../../services/autopilot/proposal-service.js";

/**
 * POST /api/autopilot/generate
 * Generate a new proposal by running the agent pipeline
 */
export async function handleGenerateProposal(c: Context) {
  const userId = c.get("userId") as string | undefined;

  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const body = await c.req.json().catch(() => ({}));

    const { proposal, pipelineResult } = await proposalService.generateProposal(
      userId,
      {
        currentPrice: body.currentPrice,
        accountSize: body.accountSize,
        currentPnL: body.currentPnL,
        vixLevel: body.vixLevel,
      },
    );

    return c.json({
      success: true,
      proposal,
      hasProposal: proposal !== null,
      recommendation: pipelineResult.overallRecommendation,
      pipelineLatencyMs: pipelineResult.pipelineLatencyMs,
    });
  } catch (error) {
    console.error("[AutoPilot] Generate proposal error:", error);
    return c.json({ error: "Failed to generate proposal" }, 500);
  }
}

/**
 * GET /api/autopilot/proposals
 * Get pending proposals for the user
 */
export async function handleGetPendingProposals(c: Context) {
  const userId = c.get("userId") as string | undefined;

  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const proposals = await proposalService.getPendingProposals(userId);

    return c.json({
      proposals,
      total: proposals.length,
    });
  } catch (error) {
    console.error("[AutoPilot] Get pending proposals error:", error);
    return c.json({ error: "Failed to get proposals" }, 500);
  }
}

/**
 * GET /api/autopilot/proposals/:id
 * Get a specific proposal
 */
export async function handleGetProposal(c: Context) {
  const userId = c.get("userId") as string | undefined;
  const proposalId = c.req.param("id");

  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const proposal = await proposalService.getProposal(proposalId);

    if (!proposal) {
      return c.json({ error: "Proposal not found" }, 404);
    }

    if (proposal.userId !== userId) {
      return c.json({ error: "Unauthorized" }, 403);
    }

    return c.json({ proposal });
  } catch (error) {
    console.error("[AutoPilot] Get proposal error:", error);
    return c.json({ error: "Failed to get proposal" }, 500);
  }
}

/**
 * POST /api/autopilot/acknowledge
 * Approve or reject a proposal
 */
export async function handleAcknowledgeProposal(c: Context) {
  const userId = c.get("userId") as string | undefined;

  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const body = await c.req.json();

    if (!body.proposalId || !body.decision) {
      return c.json({ error: "proposalId and decision are required" }, 400);
    }

    if (!["approved", "rejected"].includes(body.decision)) {
      return c.json(
        { error: 'decision must be "approved" or "rejected"' },
        400,
      );
    }

    const proposal = await proposalService.acknowledgeProposal(
      body.proposalId,
      body.decision,
      userId,
    );

    return c.json({
      success: true,
      proposal,
      message: `Proposal ${body.decision}`,
    });
  } catch (error: any) {
    console.error("[AutoPilot] Acknowledge proposal error:", error);
    return c.json(
      { error: error.message || "Failed to acknowledge proposal" },
      400,
    );
  }
}

/**
 * POST /api/autopilot/execute
 * Execute an approved proposal
 */
export async function handleExecuteProposal(c: Context) {
  const userId = c.get("userId") as string | undefined;

  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const body = await c.req.json();

    if (!body.proposalId) {
      return c.json({ error: "proposalId is required" }, 400);
    }

    const result = await proposalService.executeProposal(
      body.proposalId,
      userId,
    );

    if (!result.success) {
      return c.json({ error: result.error }, 400);
    }

    return c.json({
      success: true,
      orderId: result.orderId,
      message: "Order executed successfully",
    });
  } catch (error: any) {
    console.error("[AutoPilot] Execute proposal error:", error);
    return c.json(
      { error: error.message || "Failed to execute proposal" },
      500,
    );
  }
}

/**
 * GET /api/autopilot/history
 * Get proposal history
 */
export async function handleGetProposalHistory(c: Context) {
  const userId = c.get("userId") as string | undefined;

  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const limit = parseInt(c.req.query("limit") ?? "20", 10);
    const status = c.req.query("status");

    const proposals = await proposalService.getProposalHistory(userId, {
      limit,
      status: status || undefined,
    });

    return c.json({
      proposals,
      total: proposals.length,
    });
  } catch (error) {
    console.error("[AutoPilot] Get history error:", error);
    return c.json({ error: "Failed to get proposal history" }, 500);
  }
}

/**
 * POST /api/autopilot/expire
 * Manually expire old proposals (can be called by cron)
 */
export async function handleExpireProposals(c: Context) {
  try {
    const expiredCount = await proposalService.expireOldProposals();

    return c.json({
      success: true,
      expiredCount,
      message: `Expired ${expiredCount} proposals`,
    });
  } catch (error) {
    console.error("[AutoPilot] Expire proposals error:", error);
    return c.json({ error: "Failed to expire proposals" }, 500);
  }
}
