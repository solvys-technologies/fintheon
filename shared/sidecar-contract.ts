// [claude-code 2026-04-19] S27-T2 §2 — W1a schema layer for the Hermes sidecar HTTP contract.
// See docs/sprint-briefs/S27-T2-context-sandbox.md §2 for the canonical contract.
//
// The sidecar is a Python process running NousResearch Hermes Agent on port 8318 locally
// (6PN internal networking in prod). Both ends — backend-hono (`ai/sidecar-client.ts`) and
// the sidecar — import the same Zod schemas so request/response drift is impossible.
//
// Consumers: sidecar-client (W1b), hermes-handler proxy (W1b/W2b), T3 handoff tools (W2b),
// T5 voice path (W2c), T10 skills registry (W2e), T9 routing (W2e).

import { z } from "zod";

// ─── Connection constants ────────────────────────────────────────────────────

export const SIDECAR_PORT_LOCAL = 8318;
export const SIDECAR_URL_LOCAL =
  `http://localhost:${SIDECAR_PORT_LOCAL}` as const;

export const SIDECAR_HEADERS = {
  AUTH: "Authorization", // Bearer INTERNAL_HERMES_JWT
  CORRELATION_ID: "X-Correlation-Id",
  CONTEXT_ENGINE: "X-Context-Engine", // per-request override of default "lcm"
} as const;

// ─── Route paths ─────────────────────────────────────────────────────────────

export const SIDECAR_ROUTES = {
  healthz: "/healthz",
  chat: "/v1/chat",
  contextIngest: "/v1/context/ingest",
  contextView: "/v1/context/view",
  contextToolPrefix: "/v1/context/tools/", // + :tool_name
  voiceStt: "/v1/voice/stt",
  voiceTts: "/v1/voice/tts",
  skillsList: "/v1/skills",
  skillsInvoke: "/v1/skills/invoke",
  routingSelect: "/v1/routing/select",
} as const;

export type SidecarRouteKey = keyof typeof SIDECAR_ROUTES;

// ─── Shared primitives ───────────────────────────────────────────────────────

export const AgentIdSchema = z.enum([
  "harper",
  "oracle",
  "feucht",
  "consul",
  "herald",
]);
export type AgentId = z.infer<typeof AgentIdSchema>;

export const ContextEngineSchema = z.enum(["lcm", "default", "icarus"]);
export type ContextEngine = z.infer<typeof ContextEngineSchema>;

export const ConversationTurnSchema = z.object({
  id: z.string(),
  role: z.enum(["user", "assistant", "tool", "system"]),
  content: z.union([z.string(), z.record(z.string(), z.unknown())]),
  tokens_estimated: z.number().int().nonnegative(),
  created_at: z.number(), // epoch ms
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type ConversationTurn = z.infer<typeof ConversationTurnSchema>;

export const SummaryNodeSchema = z.object({
  id: z.string(),
  kind: z.enum(["summary", "fact", "citation"]),
  body: z.string(),
  covers_turn_ids: z.array(z.string()).default([]),
  tokens_estimated: z.number().int().nonnegative(),
  depth: z.number().int().nonnegative().default(0),
});
export type SummaryNode = z.infer<typeof SummaryNodeSchema>;

// ─── /v1/chat ────────────────────────────────────────────────────────────────

export const ChatRequestSchema = z.object({
  agent_id: AgentIdSchema,
  conversation_id: z.string(),
  user_message: z.string(),
  system_overrides: z
    .object({
      persistent_memory: z.unknown().optional(),
      soul_extras: z.array(z.string()).optional(),
      routing_hint: z.string().optional(),
    })
    .catchall(z.unknown())
    .optional(),
  stream: z.boolean().default(true),
  context_engine: ContextEngineSchema.optional(),
});
export type ChatRequest = z.infer<typeof ChatRequestSchema>;

export const ChatEventTypeSchema = z.enum([
  "delta",
  "tool_call",
  "tool_result",
  "context_view",
  "memory_writes",
  "done",
  "error",
]);
export type ChatEventType = z.infer<typeof ChatEventTypeSchema>;

// Payload shape is event-dependent; kept as `unknown` at the wire and narrowed
// by the consuming handler. We still export the discriminated union for handlers
// that want exhaustive typing.

export const ChatDeltaEventSchema = z.object({
  type: z.literal("delta"),
  payload: z.object({ text: z.string() }),
});

export const ChatToolCallEventSchema = z.object({
  type: z.literal("tool_call"),
  payload: z.object({
    id: z.string(),
    name: z.string(),
    args: z.record(z.string(), z.unknown()),
  }),
});

export const ChatToolResultEventSchema = z.object({
  type: z.literal("tool_result"),
  payload: z.object({
    id: z.string(),
    result: z.unknown(),
    error: z.string().optional(),
  }),
});

export const ChatContextViewEventSchema = z.object({
  type: z.literal("context_view"),
  payload: z.object({
    engine: ContextEngineSchema,
    turns_included: z.number().int().nonnegative(),
    tokens_total: z.number().int().nonnegative(),
  }),
});

export const ChatMemoryWritesEventSchema = z.object({
  type: z.literal("memory_writes"),
  payload: z.object({
    agent_id: AgentIdSchema,
    writes: z.array(
      z.object({
        kind: z.string(),
        body: z.string(),
        tags: z.array(z.string()).default([]),
      }),
    ),
  }),
});

export const ChatDoneEventSchema = z.object({
  type: z.literal("done"),
  payload: z.object({
    finish_reason: z.string().optional(),
    tokens_in: z.number().int().nonnegative().optional(),
    tokens_out: z.number().int().nonnegative().optional(),
  }),
});

export const ChatErrorEventSchema = z.object({
  type: z.literal("error"),
  payload: z.object({
    message: z.string(),
    code: z.string().optional(),
    retryable: z.boolean().default(false),
  }),
});

export const ChatEventSchema = z.discriminatedUnion("type", [
  ChatDeltaEventSchema,
  ChatToolCallEventSchema,
  ChatToolResultEventSchema,
  ChatContextViewEventSchema,
  ChatMemoryWritesEventSchema,
  ChatDoneEventSchema,
  ChatErrorEventSchema,
]);
export type ChatEvent = z.infer<typeof ChatEventSchema>;

// ─── /v1/context/ingest ──────────────────────────────────────────────────────

export const ContextIngestRequestSchema = z.object({
  conversation_id: z.string(),
  turn: ConversationTurnSchema,
});
export type ContextIngestRequest = z.infer<typeof ContextIngestRequestSchema>;

export const ContextIngestResponseSchema = z.object({
  ok: z.boolean(),
  turn_id: z.string(),
});
export type ContextIngestResponse = z.infer<typeof ContextIngestResponseSchema>;

// ─── GET /v1/context/view ────────────────────────────────────────────────────

export const ContextViewQuerySchema = z.object({
  conversation_id: z.string(),
  budget_tokens: z.number().int().positive(),
  engine: ContextEngineSchema.optional(),
});
export type ContextViewQuery = z.infer<typeof ContextViewQuerySchema>;

export const ContextViewResponseSchema = z.object({
  engine: ContextEngineSchema,
  turns: z.array(ConversationTurnSchema),
  summaries: z.array(SummaryNodeSchema),
  tokens_total: z.number().int().nonnegative(),
});
export type ContextViewResponse = z.infer<typeof ContextViewResponseSchema>;

// ─── POST /v1/context/tools/:tool_name ───────────────────────────────────────
// lcm_grep / lcm_describe / lcm_expand are the built-ins from hermes-lcm.
// Other plugins may register more; the envelope is generic.

export const ContextToolRequestSchema = z.object({
  conversation_id: z.string(),
  args: z.record(z.string(), z.unknown()),
});
export type ContextToolRequest = z.infer<typeof ContextToolRequestSchema>;

export const ContextToolResponseSchema = z.object({
  tool: z.string(),
  result: z.unknown(),
  tokens_consumed: z.number().int().nonnegative().optional(),
});
export type ContextToolResponse = z.infer<typeof ContextToolResponseSchema>;

export const LCM_CONTEXT_TOOLS = [
  "lcm_grep",
  "lcm_describe",
  "lcm_expand",
] as const;
export type LcmContextTool = (typeof LCM_CONTEXT_TOOLS)[number];

// ─── /v1/voice/stt ───────────────────────────────────────────────────────────

export const VoiceSttRequestSchema = z.object({
  audio_bytes: z.string(), // base64
  lang: z.string().optional(),
  sample_rate: z.number().int().positive().optional(),
  mime: z.string().optional(), // e.g. "audio/webm;codecs=opus"
});
export type VoiceSttRequest = z.infer<typeof VoiceSttRequestSchema>;

export const VoiceSttWordSchema = z.object({
  word: z.string(),
  start_ms: z.number().int().nonnegative(),
  end_ms: z.number().int().nonnegative(),
  confidence: z.number().min(0).max(1).optional(),
});

export const VoiceSttResponseSchema = z.object({
  transcript: z.string(),
  words: z.array(VoiceSttWordSchema),
  lang: z.string().optional(),
});
export type VoiceSttResponse = z.infer<typeof VoiceSttResponseSchema>;

// ─── /v1/voice/tts ───────────────────────────────────────────────────────────

export const VoiceTtsRequestSchema = z.object({
  text: z.string().min(1),
  voice_id: z.string(),
  stream: z.boolean().default(true),
  format: z.enum(["mp3", "opus", "wav"]).default("opus"),
  sample_rate: z.number().int().positive().optional(),
});
export type VoiceTtsRequest = z.infer<typeof VoiceTtsRequestSchema>;

// Response body is raw audio bytes (streamed). No JSON schema — the HTTP client
// returns an AsyncIterable<Uint8Array> or ArrayBuffer. These headers annotate it:
export const VOICE_TTS_RESPONSE_HEADERS = {
  CONTENT_TYPE: "Content-Type",
  SAMPLE_RATE: "X-Sample-Rate",
  VOICE_ID: "X-Voice-Id",
} as const;

// ─── /v1/skills ──────────────────────────────────────────────────────────────
// List + invoke. The full SkillManifest shape lives in `skill-manifest.ts` — the
// sidecar returns a projection.

export const SkillListEntrySchema = z.object({
  id: z.string(),
  name: z.string(),
  version: z.string(),
  description: z.string(),
  tools: z.array(z.string()), // tool names only; full schemas via skill-manifest.ts
});
export type SkillListEntry = z.infer<typeof SkillListEntrySchema>;

export const SkillListResponseSchema = z.object({
  skills: z.array(SkillListEntrySchema),
});
export type SkillListResponse = z.infer<typeof SkillListResponseSchema>;

export const SkillInvokeRequestSchema = z.object({
  skill_id: z.string(),
  tool: z.string().optional(), // omit → skill default entry
  args: z.record(z.string(), z.unknown()),
  context: z
    .object({
      agent_id: AgentIdSchema.optional(),
      conversation_id: z.string().optional(),
    })
    .catchall(z.unknown())
    .optional(),
});
export type SkillInvokeRequest = z.infer<typeof SkillInvokeRequestSchema>;

export const SkillInvokeResponseSchema = z.object({
  skill_id: z.string(),
  result: z.unknown(),
  error: z.string().optional(),
});
export type SkillInvokeResponse = z.infer<typeof SkillInvokeResponseSchema>;

// ─── /v1/routing/select ──────────────────────────────────────────────────────

export const ModelProviderSchema = z.enum([
  "anthropic",
  "openai",
  "qwen",
  "deepseek",
  "openrouter",
  "vproxy",
  "local",
]);
export type ModelProvider = z.infer<typeof ModelProviderSchema>;

export const RoutingSelectRequestSchema = z.object({
  agent_id: AgentIdSchema,
  task_type: z.string().optional(),
  input_tokens: z.number().int().nonnegative().optional(),
  latency_budget_ms: z.number().int().positive().optional(),
});
export type RoutingSelectRequest = z.infer<typeof RoutingSelectRequestSchema>;

export const RoutingSelectResponseSchema = z.object({
  model: z.string(),
  provider: ModelProviderSchema,
  reasoning: z.string().optional(),
  fallback: z
    .object({
      model: z.string(),
      provider: ModelProviderSchema,
    })
    .optional(),
});
export type RoutingSelectResponse = z.infer<typeof RoutingSelectResponseSchema>;

// ─── Healthz ─────────────────────────────────────────────────────────────────

export const HealthzResponseSchema = z.object({
  ok: z.boolean(),
  version: z.string().optional(),
  plugins_loaded: z.array(z.string()).default([]),
  context_engine: ContextEngineSchema.optional(),
});
export type HealthzResponse = z.infer<typeof HealthzResponseSchema>;

// ─── Error envelope (every non-2xx JSON body) ────────────────────────────────

export const SidecarErrorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    retryable: z.boolean().default(false),
    correlation_id: z.string().optional(),
  }),
});
export type SidecarErrorResponse = z.infer<typeof SidecarErrorResponseSchema>;
