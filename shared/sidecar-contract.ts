// [claude-code 2026-04-19] S27 skeleton stub. W1a (Claude-02) scaffolds types; W1b (Claude-03) populates real endpoints after Hermes sidecar boots.
// See docs/sprint-briefs/S27-T2-context-sandbox.md §2 for the full HTTP contract.
// Sidecar runs at http://localhost:8318 locally, internal Fly networking in prod.

import { z } from "zod";

export const SIDECAR_PORT_LOCAL = 8318;
export const SIDECAR_URL_LOCAL = `http://localhost:${SIDECAR_PORT_LOCAL}`;

export const ConversationTurnSchema = z.object({
  id: z.string(),
  role: z.enum(["user", "assistant", "tool", "system"]),
  content: z.union([z.string(), z.record(z.any())]),
  tokens_estimated: z.number(),
  created_at: z.number(),
  metadata: z.record(z.any()).optional(),
});

export const ChatRequestSchema = z.object({
  agent_id: z.string(),
  conversation_id: z.string(),
  user_message: z.string(),
  system_overrides: z.record(z.any()).optional(),
  stream: z.boolean().default(true),
});

export const ChatEventSchema = z.object({
  type: z.enum(["delta", "tool_call", "tool_result", "done", "error"]),
  payload: z.unknown(),
});

export const RoutingSelectRequestSchema = z.object({
  agent_id: z.string(),
  task_type: z.string().optional(),
  input_tokens: z.number().optional(),
});

export const RoutingSelectResponseSchema = z.object({
  model: z.string(),
  provider: z.string(),
  reasoning: z.string().optional(),
});

export type ConversationTurn = z.infer<typeof ConversationTurnSchema>;
export type ChatRequest = z.infer<typeof ChatRequestSchema>;
export type ChatEvent = z.infer<typeof ChatEventSchema>;
export type RoutingSelectRequest = z.infer<typeof RoutingSelectRequestSchema>;
export type RoutingSelectResponse = z.infer<typeof RoutingSelectResponseSchema>;
