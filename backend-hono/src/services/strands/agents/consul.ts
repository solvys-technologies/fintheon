// [claude-code 2026-04-08] Set provider to nous (arcee trinity → qwen3.6-plus fallback)
// [claude-code 2026-04-04] Consul — Strands agent for fundamentals + mega-cap analysis
import { createAgent } from "../agent-factory.js";
import { BASE_PROMPTS } from "../../ai/agent-instructions/base-prompts.js";

export function createConsulAgent() {
  return createAgent({
    name: "consul",
    description:
      "Fundamentals desk — top 10 S&P/NDX mega-caps, earnings, guidance, fair value",
    systemPrompt: BASE_PROMPTS["fundamentals-desk"],
    model: { temperature: 0.3, maxTokens: 4096 },
    provider: "nous",
  });
}
