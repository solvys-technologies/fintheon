// [claude-code 2026-05-05] S59-T1: Unified SOUL loading + rendering pipeline.
// Wraps loadSoul() + renderSystemPrompt() from soul/loader.ts and injects
// Fintheon-native identity context ("you are at Fintheon, part of PIC").

import { loadSoul, renderSystemPrompt } from "../ai/soul/loader.js";
import type { LoadedSoul, AgentId, Soul } from "../ai/soul/loader.js";
import { createLogger } from "../../lib/logger.js";

const log = createLogger("SoulPipeline");

const FINTHEON_IDENTITY_BLOCK = `## Fintheon Platform Context

You are operating within Fintheon by Priced In Capital (PIC) / Solvys Technologies.
Fintheon is an institutional-grade agentic trading platform.
Your output is consumed by human executives who make final decisions.
Arbitrum is the 5-seat deliberation engine — your reasoning feeds into it.
Be precise, probabilistic, and actionable. Never give generic financial advice.`;

export interface SoulPipelineResult {
  soul: LoadedSoul;
  systemPrompt: string;
}

export async function getAgentSoul(agentId: AgentId): Promise<LoadedSoul> {
  try {
    return await loadSoul(agentId);
  } catch (err) {
    log.warn("Failed to load SOUL, using degraded identity", {
      agentId,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

export async function renderAgentSystemPrompt(agentId: AgentId): Promise<string> {
  const soul = await getAgentSoul(agentId);
  const basePrompt = renderSystemPrompt(soul);
  return `${basePrompt}\n\n${FINTHEON_IDENTITY_BLOCK}`;
}

export async function buildSoulPipeline(agentId: AgentId): Promise<SoulPipelineResult> {
  const soul = await getAgentSoul(agentId);
  const basePrompt = renderSystemPrompt(soul);
  const systemPrompt = `${basePrompt}\n\n${FINTHEON_IDENTITY_BLOCK}`;
  return { soul, systemPrompt };
}

export type { AgentId, LoadedSoul, Soul };
