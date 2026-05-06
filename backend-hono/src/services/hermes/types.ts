// [claude-code 2026-05-05] S59-T1: Native Hermes Agent core types.
// Ported from shared/sidecar-contract.ts — the sidecar is deleted, these types now
// live in the native TS runtime.

export type AgentId = "harper" | "oracle" | "feucht" | "consul" | "herald";

export type ChatEventType =
  | "delta"
  | "tool_call"
  | "tool_result"
  | "done"
  | "error"
  | "memory_writes"
  | "context_view";

export interface ChatDeltaEvent {
  type: "delta";
  payload: { text: string };
}

export interface ChatDoneEvent {
  type: "done";
  payload: {
    finish_reason?: string;
    tokens_in?: number;
    tokens_out?: number;
  };
}

export interface ChatErrorEvent {
  type: "error";
  payload: {
    message: string;
    code?: string;
    retryable?: boolean;
  };
}

export interface ChatMemoryWritesEvent {
  type: "memory_writes";
  payload: {
    agent_id: AgentId;
    writes: Array<{
      kind: string;
      body: string;
      tags?: string[];
    }>;
  };
}

export type ChatEvent =
  | ChatDeltaEvent
  | { type: "tool_call"; payload: { id: string; name: string; args: Record<string, unknown> } }
  | { type: "tool_result"; payload: { id: string; result: unknown; error?: string } }
  | { type: "context_view"; payload: { engine: string; turns_included: number; tokens_total: number } }
  | ChatMemoryWritesEvent
  | ChatDoneEvent
  | ChatErrorEvent;

export interface ChatRequest {
  agent_id: string;
  conversation_id: string;
  user_message: string;
  system_overrides?: Record<string, unknown>;
  stream?: boolean;
}

export interface ConversationTurn {
  id: string;
  role: "user" | "assistant" | "tool" | "system";
  content: string | Record<string, unknown>;
  tokens_estimated: number;
  created_at: number;
  metadata?: Record<string, unknown>;
}

export interface ContextView {
  turns: ConversationTurn[];
  summaries: Array<{
    id: string;
    kind: string;
    body: string;
    covers_turn_ids: string[];
    tokens_estimated: number;
    depth: number;
  }>;
}

export interface RoutingSelectRequest {
  agent_id: string;
  task_type?: string;
  input_tokens?: number;
}

export interface RoutingSelectResponse {
  model: string;
  provider: string;
  reasoning?: string;
}

export interface SkillManifest {
  id: string;
  name: string;
  description: string;
  version: string;
  inputs_schema?: Record<string, unknown>;
}

export interface HealthzResponse {
  ok: boolean;
  version: string;
  context_engine: string;
  plugins_loaded: string[];
}
