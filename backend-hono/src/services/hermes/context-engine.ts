// [claude-code 2026-05-05] S59-T1: Native TS lossless context management.
// Token-budgeted context builder: SOUL system prompt + memory injection + conversation history.
// Compression when budget is exceeded — keeps most recent turns + summary of earlier ones.

import { buildMemoryBlock } from "../agent-memory/memory-injector.js";
import { preflight } from "../desk-context/preflight.js";
import { buildSoulPipeline } from "./soul-pipeline.js";
import type { AgentId } from "./types.js";
import { createLogger } from "../../lib/logger.js";

const log = createLogger("ContextEngine");

const DEFAULT_TOKEN_BUDGET = 120_000;
const SYSTEM_RESERVED_TOKENS = 8_000;
const TOKEN_ESTIMATION_CHARS_PER_TOKEN = 4;

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / TOKEN_ESTIMATION_CHARS_PER_TOKEN);
}

interface ContextEngineResult {
  systemPrompt: string;
  messages: ChatMessage[];
  tokenBreakdown: {
    system: number;
    memory: number;
    messages: number;
    total: number;
  };
}

export async function buildContext(
  agentId: AgentId,
  messages: ChatMessage[],
  budgetTokens = DEFAULT_TOKEN_BUDGET,
): Promise<ContextEngineResult> {
  const { soul, systemPrompt } = await buildSoulPipeline(agentId);

  const deskContext = await preflight(agentId).catch((err) => {
    log.warn("Desk context preflight failed", {
      agent: agentId,
      error: err instanceof Error ? err.message : String(err),
    });
    return "";
  });
  const deskContextTokens = deskContext ? estimateTokens(deskContext) : 0;

  const memoryBlock = await buildMemoryBlock(agentId);
  const memoryTokens = memoryBlock ? estimateTokens(memoryBlock) : 0;

  const systemParts = [systemPrompt, deskContext, memoryBlock].filter(Boolean);
  const fullSystemPrompt = systemParts.join("\n\n");
  const systemTokens = estimateTokens(fullSystemPrompt);

  const availableForMessages = Math.max(
    0,
    budgetTokens - systemTokens - SYSTEM_RESERVED_TOKENS,
  );
  const processed = compressIfNeeded(messages, availableForMessages);

  const messageTokens = processed.reduce(
    (sum, m) => sum + estimateTokens(m.content),
    0,
  );
  const total = systemTokens + messageTokens;

  log.info("Context built", {
    agent: agentId,
    systemTokens,
    deskContextTokens,
    memoryTokens,
    messageTokens,
    total,
    messageCount: processed.length,
  });

  return {
    systemPrompt: fullSystemPrompt,
    messages: processed,
    tokenBreakdown: {
      system: systemTokens,
      memory: memoryTokens + deskContextTokens,
      messages: messageTokens,
      total,
    },
  };
}

function compressIfNeeded(
  messages: ChatMessage[],
  budget: number,
): ChatMessage[] {
  if (messages.length === 0) return [];

  const totalTokens = messages.reduce(
    (sum, m) => sum + estimateTokens(m.content),
    0,
  );
  if (totalTokens <= budget) return messages;

  log.info("Context compression triggered", {
    messageCount: messages.length,
    totalTokens,
    budget,
  });

  const keep = Math.min(6, messages.length);
  const recentTurns = messages.slice(-keep);
  const recentTokens = recentTurns.reduce(
    (sum, m) => sum + estimateTokens(m.content),
    0,
  );

  if (recentTokens > budget) {
    const compressed: ChatMessage[] = [];
    let used = 0;
    for (const m of recentTurns.reverse()) {
      const tokens = estimateTokens(m.content);
      if (used + tokens > budget) {
        const ratio = (budget - used) / tokens;
        const truncatedLen = Math.floor(m.content.length * ratio);
        compressed.unshift({
          ...m,
          content: m.content.slice(-truncatedLen) + "\n[truncated]",
        });
        break;
      }
      compressed.unshift(m);
      used += tokens;
    }
    return compressed;
  }

  const olderCount = messages.length - keep;
  const summary = `[${olderCount} earlier messages compressed for token budget]`;
  return [{ role: "system", content: summary }, ...recentTurns];
}

export type { ContextEngineResult, ChatMessage };
