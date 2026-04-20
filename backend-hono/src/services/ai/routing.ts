// [claude-code 2026-04-19] S27-T9 W1d: Smart Model Routing foundation — per-agent default routing table + env-var overrides.
//   W2e (Claude-10) flips live across call sites and adds the budget/diagnostics layer.
// [claude-code 2026-04-19] S27-T5 W2c: harper-voice model locked to qwen/qwen3.6-plus-preview:free (see QWEN_REASONING_LATEST rationale).

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

// [claude-code 2026-04-19] S27-T5 W2c: locked the harper-voice model.
//
// Chose `qwen/qwen3.6-plus-preview:free` (April 2026). Rationale:
//   - Free tier on OpenRouter / can be piped through Hermes sidecar at $0/token.
//   - 1M context window, up to 65k output tokens, native function calling.
//   - Outperforms Claude 4.5 Opus on Terminal-Bench 2.0 (61.6 vs 59.3) and
//     RealWorldQA (85.4 vs 77.0) — comfortably above the "Sonnet-equivalent or
//     better" bar set by the S27-T5 brief.
//   - ~3x faster than Claude Opus 4.6 on first-token latency, which is what
//     matters for the <2s end-of-speech → first-audio voice target.
//   - Hybrid architecture keeps chain-of-thought reasoning on for smart
//     answers while still streaming quickly through the sidecar TTS pipe.
//
// If load-tests show p95 > 2s, set env `ROUTING_OVERRIDE_HARPER_VOICE` to
// `qwen/qwen3.5-plus-02-15` or a Hermes-4 variant — see brief §5 fallback.
export const QWEN_REASONING_LATEST = "qwen/qwen3.6-plus-preview:free";

// [claude-code 2026-04-20] S28 directive — every agent routes to QWEN_REASONING_LATEST.
// The previous split (Opus for harper+oracle, Sonnet for consul, Haiku for feucht+herald)
// is gone. TP's call: unify on Qwen for cost + latency, rely on ROUTING_OVERRIDE_<AGENT>
// env vars as the per-agent fallback if any particular desk regresses in capability.
export const ROUTING_TABLE: RoutingRule[] = [
  {
    agent: "harper",
    model: QWEN_REASONING_LATEST,
    provider: "hermes-sidecar",
    max_input_tokens: 1_000_000,
    cost_per_mtoken_in_usd: 0,
    cost_per_mtoken_out_usd: 0,
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
  {
    agent: "harper-voice",
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
