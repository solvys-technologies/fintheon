// [claude-code 2026-04-19] S27 skeleton stub. W1d (Claude-05) populates defaults; W2e (Claude-10) flips live routing across call sites.
// See docs/sprint-briefs/S27-T9-smart-model-routing.md for the spec.

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

export interface RoutingRule {
  agent: AgentId;
  task?: TaskType;
  model: string;
  provider: "anthropic" | "openrouter" | "hermes-sidecar";
  max_input_tokens: number;
  cost_per_mtoken_in_usd: number;
  cost_per_mtoken_out_usd: number;
}

// Default routing table — Claude-05 (W1d) replaces with the full spec. Do NOT consume from application code until W1d lands.
export const ROUTING_TABLE: RoutingRule[] = [];

export function selectModel(_agent: AgentId, _task?: TaskType): RoutingRule {
  throw new Error(
    "selectModel not implemented — W1d (Claude-05) must populate ROUTING_TABLE first. See S27-T9-smart-model-routing.md §1.",
  );
}

export const ROUTING_READY = false;
