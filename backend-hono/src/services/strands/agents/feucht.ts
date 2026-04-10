// [claude-code 2026-04-08] Set provider to nous (arcee trinity → qwen3.6-plus fallback)
// [claude-code 2026-04-04] Feucht — Strands agent for futures, execution & risk
import { createAgent } from "../agent-factory.js";
import { BASE_PROMPTS } from "../../ai/agent-instructions/base-prompts.js";

export function createFeuchtAgent() {
  return createAgent({
    name: "feucht",
    description:
      "Futures & risk — /NQ, /MNQ, /ES via TopStepX, drawdown limits, proposal validation",
    systemPrompt: BASE_PROMPTS["futures-desk"],
    model: { temperature: 0.25, maxTokens: 4096 },
    provider: "nous",
  });
}
