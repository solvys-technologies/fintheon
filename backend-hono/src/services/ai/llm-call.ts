// [claude-code 2026-04-19] S27-T9 W1d: Single-helper wrapper for LLM calls — resolves routing rule, records a routing_decisions row, and hands off the actual invocation to the caller's adapter.
//
// W1d provides the instrumentation skeleton. W2e (Claude-10) swaps in concrete provider adapters
// (Anthropic SDK / OpenRouter / hermes-sidecar) at every call site.
//
// Usage:
//   const result = await llmCall({
//     agent: "harper",
//     task: "chat",
//     conversationId,
//     messages,
//     invoke: async (rule) => { ... call provider ... return { text, input_tokens, output_tokens } },
//   });

import {
  selectModel,
  type AgentId,
  type TaskType,
  type RoutingRule,
} from "./routing.js";
import { getSupabaseClient } from "../../config/supabase.js";

export interface LlmCallArgs<T> {
  agent: AgentId;
  task?: TaskType;
  conversationId: string;
  messages?: unknown;
  tools?: unknown;
  /** Provider-specific invocation — receives the resolved routing rule, returns normalized usage. */
  invoke: (rule: RoutingRule) => Promise<LlmCallResult<T>>;
}

export interface LlmCallResult<T> {
  result: T;
  input_tokens?: number;
  output_tokens?: number;
  user_id?: string;
}

export interface LlmCallOutcome<T> extends LlmCallResult<T> {
  rule: RoutingRule;
  latency_ms: number;
  cost_usd: number;
}

function computeCost(
  rule: RoutingRule,
  input_tokens?: number,
  output_tokens?: number,
): number {
  const inCost =
    ((input_tokens ?? 0) / 1_000_000) * rule.cost_per_mtoken_in_usd;
  const outCost =
    ((output_tokens ?? 0) / 1_000_000) * rule.cost_per_mtoken_out_usd;
  return Number((inCost + outCost).toFixed(6));
}

async function recordDecision(args: {
  conversationId: string;
  agent: AgentId;
  task?: TaskType;
  rule: RoutingRule;
  input_tokens?: number;
  output_tokens?: number;
  latency_ms: number;
  cost_usd: number;
}): Promise<void> {
  const sb = getSupabaseClient();
  if (!sb) return; // in-memory fallback — do not block the call on telemetry
  try {
    await sb.from("routing_decisions").insert({
      conversation_id: args.conversationId,
      agent_id: args.agent,
      task_type: args.task ?? null,
      model: args.rule.model,
      provider: args.rule.provider,
      input_tokens: args.input_tokens ?? null,
      output_tokens: args.output_tokens ?? null,
      cost_usd: args.cost_usd,
      latency_ms: args.latency_ms,
    });
  } catch (err) {
    console.warn("[llm-call] Failed to record routing_decisions row", err);
  }
}

export async function llmCall<T>(
  args: LlmCallArgs<T>,
): Promise<LlmCallOutcome<T>> {
  const rule = selectModel(args.agent, args.task);
  const start = Date.now();
  const invocation = await args.invoke(rule);
  const latency_ms = Date.now() - start;
  const cost_usd = computeCost(
    rule,
    invocation.input_tokens,
    invocation.output_tokens,
  );

  // Fire-and-forget telemetry.
  void recordDecision({
    conversationId: args.conversationId,
    agent: args.agent,
    task: args.task,
    rule,
    input_tokens: invocation.input_tokens,
    output_tokens: invocation.output_tokens,
    latency_ms,
    cost_usd,
  });

  return {
    ...invocation,
    rule,
    latency_ms,
    cost_usd,
  };
}
