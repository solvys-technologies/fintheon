// [claude-code 2026-04-19] S27-T9 W1d: Smart Model Routing foundation — per-agent default routing table + env-var overrides.
//   W2e (Claude-10) flips live across call sites and adds the budget/diagnostics layer.

export type AgentId =
  | "harper"
  | "oracle"
  | "feucht"
  | "consul"
  | "herald"
  | "harper-voice";

export type TaskType =
  | "chat"
  | "probability"
  | "tape"
  | "macro"
  | "news"
  | "voice"
  | "structured-extraction";

export type RoutingProvider = "anthropic" | "openrouter" | "hermes-sidecar";

export interface RoutingRule {
  agent: AgentId;
  task?: TaskType;
  model: string;
  provider: RoutingProvider;
  max_input_tokens: number;
  cost_per_mtoken_in_usd: number;
  cost_per_mtoken_out_usd: number;
}

// Placeholder string for the Hermes voice model — Claude-08 (T5 W2c) commits the concrete Qwen build.
// Kept as a sentinel so W2c can grep for it.
export const QWEN_REASONING_LATEST = "<QWEN_REASONING_LATEST>";

export const ROUTING_TABLE: RoutingRule[] = [
  {
    agent: "harper",
    model: "claude-opus-4-7",
    provider: "anthropic",
    max_input_tokens: 200_000,
    cost_per_mtoken_in_usd: 15,
    cost_per_mtoken_out_usd: 75,
  },
  {
    agent: "oracle",
    model: "claude-opus-4-7",
    provider: "anthropic",
    max_input_tokens: 200_000,
    cost_per_mtoken_in_usd: 15,
    cost_per_mtoken_out_usd: 75,
  },
  {
    agent: "feucht",
    model: "claude-haiku-4-5-20251001",
    provider: "anthropic",
    max_input_tokens: 200_000,
    cost_per_mtoken_in_usd: 1,
    cost_per_mtoken_out_usd: 5,
  },
  {
    agent: "consul",
    model: "claude-sonnet-4-6",
    provider: "anthropic",
    max_input_tokens: 200_000,
    cost_per_mtoken_in_usd: 3,
    cost_per_mtoken_out_usd: 15,
  },
  {
    agent: "herald",
    model: "claude-haiku-4-5-20251001",
    provider: "anthropic",
    max_input_tokens: 200_000,
    cost_per_mtoken_in_usd: 1,
    cost_per_mtoken_out_usd: 5,
  },
  {
    agent: "harper-voice",
    model: QWEN_REASONING_LATEST,
    provider: "hermes-sidecar",
    max_input_tokens: 32_000,
    cost_per_mtoken_in_usd: 0,
    cost_per_mtoken_out_usd: 0,
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
 *   2. Task-specific row in ROUTING_TABLE (agent + task match)
 *   3. Default row for the agent
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

  const override = process.env[overrideEnvKey(agent)];
  if (override && override.trim().length > 0) {
    return { ...match, model: override.trim() };
  }
  return match;
}

export const ROUTING_READY = true;
