// [claude-code 2026-05-07] S61-T2: Oracle tools wired from capability registry
// [claude-code 2026-04-15] Wire full system prompt (persona + philosophy + shared beliefs) to fix groupthink
// [claude-code 2026-04-08] Set provider to nous (arcee trinity → qwen3.6-plus fallback)
// [claude-code 2026-04-04] Oracle (All-Seer) — Strands agent for prediction markets + macro
import { createAgent } from "../agent-factory.js";
import { getAgentSystemPrompt } from "../../ai/agent-instructions/index.js";
import { getRequiredTools } from "../../capability-registry/registry.js";

export async function createOracleAgent() {
  return createAgent({
    name: "oracle",
    description:
      "Prediction markets, S&P, Crypto, macro analysis — sees across all domains",
    systemPrompt: await getAgentSystemPrompt("pma-merged"),
    model: { temperature: 0.3, maxTokens: 4096 },
    provider: "nous",
    tools: getRequiredTools("oracle"),
  });
}
