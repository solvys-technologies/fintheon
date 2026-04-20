// [claude-code 2026-04-19] S27-T9 W1d: Smart Model Routing foundation — per-agent default routing table + env-var overrides.
//   W2e (Claude-10) flips live across call sites and adds the budget/diagnostics layer.
// [claude-code 2026-04-19] S27-T5 W2c: harper-voice model locked to qwen/qwen3.6-plus-preview:free (see QWEN_REASONING_LATEST rationale).

export type AgentId =
  | "harper"
  | "harper-voice"
  | "harper-debug" // [S28] Sonnet sub-agent spawned by Harper for bug triage / debug sessions.
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

// [claude-code 2026-04-19] S27-T5 W2c: locked the harper-voice model.
// [claude-code 2026-04-20] S28: swapped `:free` variant → `qwen/qwen3.6-plus`
//   against TP's Nous subscription (flat-rate, effectively $0/token). The
//   `:free` tier on OpenRouter rotates; Nous-hosted Qwen Plus 3.6 is stable.
//
// Rationale for qwen3.6-plus:
//   - 1M context window, up to 65k output tokens, native function calling.
//   - Outperforms Claude 4.5 Opus on Terminal-Bench 2.0 (61.6 vs 59.3) and
//     RealWorldQA (85.4 vs 77.0) — "Sonnet-equivalent or better" bar from
//     the original S27-T5 brief.
//   - ~3x faster than Claude Opus 4.6 on first-token latency, which matters
//     for the <2s end-of-speech → first-audio voice target.
//   - Hybrid architecture keeps chain-of-thought reasoning on for smart
//     answers while still streaming quickly through the sidecar TTS pipe.
//
// If a desk regresses, `ROUTING_OVERRIDE_<AGENT>` env vars override per-agent.
export const QWEN_REASONING_LATEST = "qwen/qwen3.6-plus";

// [claude-code 2026-04-20] S28 directive — model split:
//   - CAO (Harper) keeps Opus (heaviest reasoning, only position that needs it)
//   - Harper-voice keeps Qwen (free/fast, voice-native)
//   - Harper-debug is a Sonnet sub-agent Harper can spawn for bug triage only
//     (not for team coding — team work flows through Agent Swarm + DAG)
//   - All Hermes desk agents (Oracle, Feucht, Consul, Herald) route to Qwen.
//     Qwen is the smartest non-Opus model per S28 call and keeps their cost
//     profile at $0 via the hermes-sidecar pipe.
// ROUTING_OVERRIDE_<AGENT> env vars remain as per-agent escape hatches.
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
    agent: "harper-voice",
    model: QWEN_REASONING_LATEST,
    provider: "hermes-sidecar",
    max_input_tokens: 1_000_000,
    cost_per_mtoken_in_usd: 0,
    cost_per_mtoken_out_usd: 0,
  },
  {
    agent: "harper-debug",
    model: "claude-sonnet-4-6",
    provider: "anthropic",
    max_input_tokens: 200_000,
    cost_per_mtoken_in_usd: 3,
    cost_per_mtoken_out_usd: 15,
  },
  {
    agent: "oracle",
    model: QWEN_REASONING_LATEST,
    provider: "hermes-sidecar",
    max_input_tokens: 1_000_000,
    cost_per_mtoken_in_usd: 0,
    cost_per_mtoken_out_usd: 0,
  },
  {
    agent: "feucht",
    model: QWEN_REASONING_LATEST,
    provider: "hermes-sidecar",
    max_input_tokens: 1_000_000,
    cost_per_mtoken_in_usd: 0,
    cost_per_mtoken_out_usd: 0,
  },
  {
    agent: "consul",
    model: QWEN_REASONING_LATEST,
    provider: "hermes-sidecar",
    max_input_tokens: 1_000_000,
    cost_per_mtoken_in_usd: 0,
    cost_per_mtoken_out_usd: 0,
  },
  {
    agent: "herald",
    model: QWEN_REASONING_LATEST,
    provider: "hermes-sidecar",
    max_input_tokens: 1_000_000,
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
