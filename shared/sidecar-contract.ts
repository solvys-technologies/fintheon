// [claude-code 2026-04-19] S27-T2 W1b — Hermes sidecar HTTP contract.
// Canonical wire format. Python mirrors live in hermes-sidecar/hermes_sidecar/models.py.
// See docs/sprint-briefs/S27-T2-context-sandbox.md §2 for spec.

import { z } from "zod";

export const SIDECAR_PORT_LOCAL = 8318;
export const SIDECAR_URL_LOCAL = `http://localhost:${SIDECAR_PORT_LOCAL}`;
export const SIDECAR_INTERNAL_HOST_PROD = "fintheon-hermes.internal";
export const SIDECAR_URL_PROD = `http://${SIDECAR_INTERNAL_HOST_PROD}:${SIDECAR_PORT_LOCAL}`;

export const HERMES_SIDECAR_ENABLED_ENV = "HERMES_SIDECAR_ENABLED";
export const HERMES_SIDECAR_JWT_ENV = "INTERNAL_HERMES_JWT";
export const HERMES_SIDECAR_URL_ENV = "HERMES_SIDECAR_URL";

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

export const ChatEventTypeSchema = z.enum([
  "delta",
  "tool_call",
  "tool_result",
  "done",
  "error",
  "memory_writes",
  "context_view",
]);

export const ChatEventSchema = z.object({
  type: ChatEventTypeSchema,
  payload: z.unknown(),
});

export const ContextIngestRequestSchema = z.object({
  conversation_id: z.string(),
  turn: ConversationTurnSchema,
});

export const ContextViewRequestSchema = z.object({
  conversation_id: z.string(),
  budget_tokens: z.number().int().min(1024).default(120000),
});

export const SummaryNodeSchema = z.object({
  id: z.string(),
  kind: z.enum(["summary", "raw_turn", "tool_result"]),
  text: z.string(),
  tokens_estimated: z.number(),
  children: z.array(z.string()).default([]),
});

export const ContextViewSchema = z.object({
  turns: z.array(ConversationTurnSchema),
  summaries: z.array(SummaryNodeSchema),
});

export const ContextToolRequestSchema = z.object({
  conversation_id: z.string(),
  args: z.record(z.any()),
});

export const VoiceSTTRequestSchema = z.object({
  audio_bytes: z.string(), // base64
  lang: z.string().optional(),
});

export const STTWordSchema = z.object({
  word: z.string(),
  start: z.number(),
  end: z.number(),
});

export const VoiceSTTResponseSchema = z.object({
  transcript: z.string(),
  words: z.array(STTWordSchema).default([]),
});

export const VoiceTTSRequestSchema = z.object({
  text: z.string(),
  voice_id: z.string(),
  stream: z.boolean().default(false),
});

export const SkillInvokeRequestSchema = z.object({
  skill_id: z.string(),
  args: z.record(z.any()),
  context: z.record(z.any()).optional(),
});

export const SkillManifestSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  version: z.string(),
  inputs_schema: z.record(z.any()).optional(),
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

export const HealthzResponseSchema = z.object({
  ok: z.boolean(),
  version: z.string(),
  context_engine: z.string(),
  plugins_loaded: z.array(z.string()),
});

export const SidecarEndpoints = {
  healthz: "/healthz",
  chat: "/v1/chat",
  contextIngest: "/v1/context/ingest",
  contextView: "/v1/context/view",
  contextTool: (name: string) => `/v1/context/tools/${encodeURIComponent(name)}`,
  voiceStt: "/v1/voice/stt",
  voiceTts: "/v1/voice/tts",
  skills: "/v1/skills",
  skillsInvoke: "/v1/skills/invoke",
  routingSelect: "/v1/routing/select",
} as const;

export type ConversationTurn = z.infer<typeof ConversationTurnSchema>;
export type ChatRequest = z.infer<typeof ChatRequestSchema>;
export type ChatEvent = z.infer<typeof ChatEventSchema>;
export type ChatEventType = z.infer<typeof ChatEventTypeSchema>;
export type ContextIngestRequest = z.infer<typeof ContextIngestRequestSchema>;
export type ContextViewRequest = z.infer<typeof ContextViewRequestSchema>;
export type SummaryNode = z.infer<typeof SummaryNodeSchema>;
export type ContextView = z.infer<typeof ContextViewSchema>;
export type ContextToolRequest = z.infer<typeof ContextToolRequestSchema>;
export type VoiceSTTRequest = z.infer<typeof VoiceSTTRequestSchema>;
export type VoiceSTTResponse = z.infer<typeof VoiceSTTResponseSchema>;
export type VoiceTTSRequest = z.infer<typeof VoiceTTSRequestSchema>;
export type SkillInvokeRequest = z.infer<typeof SkillInvokeRequestSchema>;
export type SkillManifest = z.infer<typeof SkillManifestSchema>;
export type RoutingSelectRequest = z.infer<typeof RoutingSelectRequestSchema>;
export type RoutingSelectResponse = z.infer<typeof RoutingSelectResponseSchema>;
export type HealthzResponse = z.infer<typeof HealthzResponseSchema>;
