// [claude-code 2026-05-07] S61-T2: Consul tools wired from capability registry
// [claude-code 2026-04-15] Wire full system prompt (persona + philosophy + shared beliefs) to fix groupthink
// [claude-code 2026-04-08] Set provider to nous (arcee trinity → qwen3.6-plus fallback)
// [claude-code 2026-04-04] Consul — Strands agent for fundamentals + mega-cap analysis
import { createAgent } from "../agent-factory.js";
import { getAgentSystemPrompt } from "../../ai/agent-instructions/index.js";
import { getRequiredTools } from "../../capability-registry/registry.js";

export async function createConsulAgent() {
  return createAgent({
    name: "consul",
    description:
      "Fundamentals desk — top 10 S&P/NDX mega-caps, earnings, guidance, fair value",
    systemPrompt: await getAgentSystemPrompt("fundamentals-desk"),
    model: { temperature: 0.3, maxTokens: 4096 },
    provider: "nous",
    tools: getRequiredTools("consul"),
  });
}
