// [claude-code 2026-04-28] S47-T2: Proposal/trade resolution routes.
// POST /api/proposals/resolve — records win/loss and feeds agent performance.
// GET  /api/proposals/performance — aggregated agent performance stats.

import { Hono } from "hono";
import { createLogger } from "../../lib/logger.js";
import {
  resolveProposal,
  getAgentPerformance,
  type ResolveProposalInput,
} from "../../services/proposal-resolution.js";

const log = createLogger("ProposalResolutionRoutes");

export function createProposalResolutionRoutes(): Hono {
  const app = new Hono();

  app.post("/resolve", async (c) => {
    let body: Record<string, unknown>;
    try {
      body = (await c.req.json()) as Record<string, unknown>;
    } catch {
      return c.json({ error: "invalid JSON body" }, 400);
    }

    const proposalId =
      typeof body.proposalId === "string" ? body.proposalId : "";
    const agentName =
      typeof body.agentName === "string" ? body.agentName : "";
    const outcome =
      typeof body.outcome === "string" ? body.outcome : "";

    if (!proposalId || !agentName || !outcome) {
      return c.json(
        { error: "proposalId, agentName, and outcome are required" },
        400,
      );
    }

    const validOutcomes = ["win", "loss", "push", "expired"];
    if (!validOutcomes.includes(outcome)) {
      return c.json(
        { error: `outcome must be one of ${validOutcomes.join(", ")}` },
        400,
      );
    }

    const rawProposalType =
      typeof body.proposalType === "string" ? body.proposalType : "";
    const validTypes = ["prediction", "trade", "arbitrum"];
    const proposalType = validTypes.includes(rawProposalType)
      ? (rawProposalType as ResolveProposalInput["proposalType"])
      : "prediction";

    const rawDirection =
      typeof body.direction === "string" ? body.direction : "";
    const validDirections = ["long", "short", "flat"];
    const direction = validDirections.includes(rawDirection)
      ? (rawDirection as ResolveProposalInput["direction"])
      : "flat";

    const input: ResolveProposalInput = {
      proposalId,
      proposalType,
      agentName,
      agentRole:
        typeof body.agentRole === "string" ? body.agentRole : undefined,
      direction,
      instrument:
        typeof body.instrument === "string" ? body.instrument : "UNKNOWN",
      entryPrice:
        typeof body.entryPrice === "number" ? body.entryPrice : undefined,
      exitPrice:
        typeof body.exitPrice === "number" ? body.exitPrice : undefined,
      outcome: outcome as ResolveProposalInput["outcome"],
      pnl: typeof body.pnl === "number" ? body.pnl : undefined,
      marketCloseCountdownMinutes:
        typeof body.marketCloseCountdownMinutes === "number"
          ? body.marketCloseCountdownMinutes
          : undefined,
      rationale:
        typeof body.rationale === "string" ? body.rationale : undefined,
      metadata:
        typeof body.metadata === "object" && body.metadata !== null
          ? (body.metadata as Record<string, unknown>)
          : undefined,
    };


    try {
      const record = await resolveProposal(input);
      if (!record) {
        return c.json({ error: "resolution_persist_failed" }, 500);
      }
      return c.json({ success: true, record });
    } catch (err) {
      log.error("resolveProposal failed", {
        error: err instanceof Error ? err.message : String(err),
      });
      return c.json({ error: "resolution_failed" }, 500);
    }
  });

  app.get("/performance", async (c) => {
    const agentName = c.req.query("agent") || undefined;
    try {
      const stats = await getAgentPerformance(agentName);
      return c.json(stats);
    } catch (err) {
      log.error("getAgentPerformance failed", {
        error: err instanceof Error ? err.message : String(err),
      });
      return c.json({ error: "performance_query_failed" }, 500);
    }
  });

  return app;
}
