// [claude-code 2026-05-14] S61-T3: Agent context preflight — builds context for all 5 agents (not just Harper)
import type { HermesAgentRole } from "../hermes-service.js";
import { getAgentSystemPrompt } from "../ai/agent-instructions/index.js";
import { preflight } from "../desk-context/preflight.js";
import { createLogger } from "../../lib/logger.js";

const log = createLogger("context-engine");

export const DEFAULT_TOKEN_BUDGET = 120_000;
export const SYSTEM_RESERVED_TOKENS = 8_000;

const AGENT_ROLE_MAP: Record<string, HermesAgentRole> = {
  oracle: "pma-merged",
  feucht: "futures-desk",
  consul: "fundamentals-desk",
  herald: "herald",
  harper: "harper-cao",
  "harper-dag": "harper-cao",
};

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export interface ContextMessage {
  role: "user" | "assistant";
  content: string;
}

export interface TokenBreakdown {
  systemTokens: number;
  historyTokens: number;
  totalTokens: number;
  compressed: boolean;
}

export interface ContextResult {
  systemPrompt: string;
  messages: ContextMessage[];
  tokenBreakdown: TokenBreakdown;
}

/**
 * Build a context bundle for the given agent.
 *
 * Composition:
 *   1. SOUL-grounded system prompt (via getAgentSystemPrompt)
 *   2. Preflight desk context (recent outputs + memory blocks, Harper adds RiskFlow)
 *   3. Conversation history (compressed when over budget: 6 recent + summary)
 *
 * Called by Harper chat, Strands pipeline, Boardroom huddles, and Arbitrum.
 * All callers must still work after this function is wired in.
 */
export async function buildContext(
  agentId: string,
  messages: ContextMessage[],
  budgetTokens = DEFAULT_TOKEN_BUDGET,
): Promise<ContextResult> {
  const role = AGENT_ROLE_MAP[agentId] ?? "harper-cao";

  // Step 1: SOUL-grounded system prompt
  let systemPrompt = await getAgentSystemPrompt(role).catch((err) => {
    log.warn("buildContext: getAgentSystemPrompt failed", {
      agentId,
      error: String(err),
    });
    return "";
  });

  // Step 2: Preflight desk context inserted after SOUL prompt, before history
  const deskContext = await preflight(agentId).catch(() => "");
  if (deskContext) {
    systemPrompt += deskContext;
  }

  const systemTokens = estimateTokens(systemPrompt);
  const reserved = Math.max(systemTokens, SYSTEM_RESERVED_TOKENS);
  const availableForHistory = budgetTokens - reserved;

  // Step 3: Compression — keep 6 most recent turns, summarize older ones when over budget
  let workingMessages: ContextMessage[] = [...messages];
  let compressed = false;

  const rawHistoryTokens = workingMessages.reduce(
    (sum, m) => sum + estimateTokens(m.content),
    0,
  );

  if (rawHistoryTokens > availableForHistory && workingMessages.length > 6) {
    const recent = workingMessages.slice(-6);
    const older = workingMessages.slice(0, -6);
    const summaryLines = older
      .map((m) => `${m.role}: ${m.content.slice(0, 120)}`)
      .join("\n");
    const summaryMessage: ContextMessage = {
      role: "user",
      content: `[Earlier conversation summary — ${older.length} turns compressed]\n${summaryLines}`,
    };
    workingMessages = [summaryMessage, ...recent];
    compressed = true;
    log.info("buildContext: history compressed", {
      agentId,
      originalTurns: messages.length,
      keptTurns: recent.length,
    });
  }

  const historyTokens = workingMessages.reduce(
    (sum, m) => sum + estimateTokens(m.content),
    0,
  );

  return {
    systemPrompt,
    messages: workingMessages,
    tokenBreakdown: {
      systemTokens,
      historyTokens,
      totalTokens: systemTokens + historyTokens,
      compressed,
    },
  };
}
