// [claude-code 2026-05-07] S61-T2: Herald tools wired from capability registry
// [claude-code 2026-04-15] Wire full system prompt (persona + philosophy + shared beliefs) to fix groupthink
// [codex 2026-05-18] v6.7.3: Herald routes through DeepSeek direct.
// [claude-code 2026-04-04] Herald — Strands agent for news & sentiment
import { createAgent } from "../agent-factory.js";
import { getAgentSystemPrompt } from "../../ai/agent-instructions/index.js";
import { getRequiredTools } from "../../capability-registry/registry.js";

export async function createHeraldAgent() {
  return createAgent({
    name: "herald",
    description:
      "News & sentiment — headlines, social signals, AAII survey, breaking news",
    systemPrompt: await getAgentSystemPrompt("herald"),
    model: { temperature: 0.3, maxTokens: 4096 },
    provider: "deepseek-direct",
    tools: getRequiredTools("herald"),
  });
}
