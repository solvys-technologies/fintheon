// [claude-code 2026-05-03] S58-T1: DeepSeek v4 Pro primary provider migration
// [claude-code 2026-04-19] S27-T9 W1d: Smart Model Routing foundation — per-agent default routing table + env-var overrides.
// [claude-code 2026-04-19] S27-T5 W2c: harper-voice model locked to qwen/qwen3.6-plus-preview:free (see QWEN_REASONING_LATEST rationale).
// [codex 2026-05-18] v6.7.3: core desk routing is DeepSeek-only.

export type AgentId =
  | "harper"
  | "harper-voice"
  | "harper-debug"
  | "oracle"
  | "feucht"
  | "consul"
  | "herald";

export type TaskType =
  | "chat"
  | "probability"
  | "tape"
  | "macro"
  | "news"
  | "voice"
  | "structured-extraction";

export type RoutingProvider =
  | "deepseek-direct"
  | "deepseek-oc-api"
  | "anthropic"
  | "openrouter"
  | "hermes-sidecar"
  | "opencode-go";

export interface RoutingRule {
  agent: AgentId;
  task?: TaskType;
  model: string;
  provider: RoutingProvider;
  max_input_tokens: number;
  cost_per_mtoken_in_usd: number;
  cost_per_mtoken_out_usd: number;
}

// Legacy voice model ID retained for the voice surface only.
export const QWEN_REASONING_LATEST = "qwen/qwen3.6-plus-preview:free";

// Desk agents route to `deepseek-reasoner` via DeepSeek's OpenAI-compatible API.
export const QWEN_CLOUD_LATEST = "deepseek-reasoner";

// DeepSeek remains the primary agent route; opencode-go is retained as a user-configurable utility path.
export const ROUTING_TABLE: RoutingRule[] = [
  {
    agent: "harper",
    model: QWEN_CLOUD_LATEST,
    provider: "deepseek-direct",
    max_input_tokens: 128_000,
    cost_per_mtoken_in_usd: 0.5,
    cost_per_mtoken_out_usd: 2.19,
  },
  {
    agent: "harper-voice",
    model: QWEN_REASONING_LATEST,
    provider: "deepseek-direct",
    max_input_tokens: 128_000,
    cost_per_mtoken_in_usd: 0.5,
    cost_per_mtoken_out_usd: 2.19,
  },
  {
    agent: "harper-debug",
    model: QWEN_CLOUD_LATEST,
    provider: "deepseek-direct",
    max_input_tokens: 128_000,
    cost_per_mtoken_in_usd: 0.5,
    cost_per_mtoken_out_usd: 2.19,
  },
  {
    agent: "oracle",
    model: QWEN_CLOUD_LATEST,
    provider: "deepseek-direct",
    max_input_tokens: 128_000,
    cost_per_mtoken_in_usd: 0.5,
    cost_per_mtoken_out_usd: 2.19,
  },
  {
    agent: "feucht",
    model: QWEN_CLOUD_LATEST,
    provider: "deepseek-direct",
    max_input_tokens: 128_000,
    cost_per_mtoken_in_usd: 0.5,
    cost_per_mtoken_out_usd: 2.19,
  },
  {
    agent: "consul",
    model: QWEN_CLOUD_LATEST,
    provider: "deepseek-direct",
    max_input_tokens: 128_000,
    cost_per_mtoken_in_usd: 0.5,
    cost_per_mtoken_out_usd: 2.19,
  },
  {
    agent: "herald",
    model: QWEN_CLOUD_LATEST,
    provider: "deepseek-direct",
    max_input_tokens: 128_000,
    cost_per_mtoken_in_usd: 0.5,
    cost_per_mtoken_out_usd: 2.19,
  },
];

function overrideEnvKey(agent: AgentId): string {
  return `ROUTING_OVERRIDE_${agent.replace(/-/g, "_").toUpperCase()}`;
}

/**
 * Look up the routing rule for an agent + optional task type.
 *
 * Resolution order:
 *   1. ROUTING_OVERRIDE_<AGENT> env var — swaps model, keeps provider/metadata
 *   2. HARPER_DEFAULT_PROVIDER=deepseek|opencode-go (Harper only, default: deepseek)
 *   3. Task-specific row in ROUTING_TABLE (agent + task match)
 *   4. Default row for the agent
 */
export function selectModel(agent: AgentId, task?: TaskType): RoutingRule {
  let match: RoutingRule | undefined;
  if (task) {
    match = ROUTING_TABLE.find((r) => r.agent === agent && r.task === task);
  }
  if (!match) {
    match = ROUTING_TABLE.find((r) => r.agent === agent && !r.task);
  }
  if (!match) {
    throw new Error(
      `[routing] No rule for agent=${agent} task=${task ?? "(none)"}`,
    );
  }

  // Harper provider routing supports DeepSeek direct and the explicit OpenCode utility path.
  if (agent === "harper" && task !== "voice") {
    const harperProvider = process.env.HARPER_DEFAULT_PROVIDER ?? "deepseek";
    if (harperProvider === "deepseek-oc-api") {
      return {
        ...match,
        model: QWEN_CLOUD_LATEST,
        provider: "deepseek-oc-api",
      };
    }
    if (harperProvider === "opencode-go") {
      return {
        ...match,
        model: QWEN_CLOUD_LATEST,
        provider: "opencode-go",
      };
    }
  }

  const override = process.env[overrideEnvKey(agent)];
  if (override && override.trim().length > 0) {
    return { ...match, model: override.trim() };
  }
  return match;
}

export const ROUTING_READY = true;
