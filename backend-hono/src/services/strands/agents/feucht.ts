// [claude-code 2026-04-15] Wire full system prompt (persona + philosophy + shared beliefs) to fix groupthink
// [claude-code 2026-04-08] Set provider to nous (arcee trinity → qwen3.6-plus fallback)
// [claude-code 2026-04-04] Feucht — Strands agent for futures, execution & risk
// [claude-code 2026-05-14] S61-T2: wire capability registry tools
import { createAgent } from "../agent-factory.js";
import { getAgentSystemPrompt } from "../../ai/agent-instructions/index.js";
import { getRequiredTools } from "../../capability-registry/registry.js";

export async function createFeuchtAgent() {
  return createAgent({
    name: "feucht",
    description:
      "Futures & risk — /NQ, /MNQ, /ES via TopStepX, drawdown limits, proposal validation",
    systemPrompt: await getAgentSystemPrompt("futures-desk"),
    tools: getRequiredTools("feucht"),
    model: { temperature: 0.25, maxTokens: 4096 },
    provider: "nous",
  });
}
