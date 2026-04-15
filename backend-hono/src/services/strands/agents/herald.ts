// [claude-code 2026-04-15] Wire full system prompt (persona + philosophy + shared beliefs) to fix groupthink
// [claude-code 2026-04-08] Set provider to nous (arcee trinity → qwen3.6-plus fallback)
// [claude-code 2026-04-04] Herald — Strands agent for news & sentiment
import { createAgent } from "../agent-factory.js";
import { getAgentSystemPrompt } from "../../ai/agent-instructions/index.js";

export async function createHeraldAgent() {
  return createAgent({
    name: "herald",
    description:
      "News & sentiment — headlines, social signals, AAII survey, breaking news",
    systemPrompt: await getAgentSystemPrompt("herald"),
    model: { temperature: 0.3, maxTokens: 4096 },
    provider: "nous",
  });
}
