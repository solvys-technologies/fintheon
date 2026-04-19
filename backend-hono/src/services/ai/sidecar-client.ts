// [claude-code 2026-04-19] S27 skeleton stub. W1b (Claude-03) populates after Hermes sidecar boots.
// See docs/sprint-briefs/S27-T2-context-sandbox.md §4 for the client spec.
// Consumers: hermes-handler, harper-handler, voice-service, T3 agent-router, T5 voice, T6 operator, T10 skills, T11 GEPA.

// Types are duplicated here for the stub to avoid cross-tsconfig root-dir issues.
// W1b (Claude-03) replaces with a real import once the backend tsconfig is configured to pick up shared/.
type ChatRequest = {
  agent_id: string;
  conversation_id: string;
  user_message: string;
  system_overrides?: Record<string, unknown>;
  stream?: boolean;
};
type ChatEvent = { type: string; payload: unknown };
type RoutingSelectRequest = {
  agent_id: string;
  task_type?: string;
  input_tokens?: number;
};
type RoutingSelectResponse = {
  model: string;
  provider: string;
  reasoning?: string;
};

export const SIDECAR_CLIENT_READY = false;

export const sidecarClient = {
  chat: {
    async *stream(_req: ChatRequest): AsyncGenerator<ChatEvent> {
      throw new Error(
        "sidecarClient.chat.stream not implemented — W1b (Claude-03) must land first. See S27-T2-context-sandbox.md §4.",
      );
      yield { type: "error", payload: { reason: "stub" } };
    },
  },
  context: {
    async ingest(_convId: string, _turn: unknown): Promise<void> {
      throw new Error(
        "sidecarClient.context.ingest not implemented — W1b stub.",
      );
    },
    async view(_convId: string, _budget: number): Promise<unknown> {
      throw new Error("sidecarClient.context.view not implemented — W1b stub.");
    },
  },
  voice: {
    async stt(_args: { audio_bytes: string; lang?: string }): Promise<unknown> {
      throw new Error("sidecarClient.voice.stt not implemented — W1b stub.");
    },
    async tts(_args: {
      text: string;
      voice_id: string;
      stream?: boolean;
    }): Promise<ArrayBuffer> {
      throw new Error("sidecarClient.voice.tts not implemented — W1b stub.");
    },
  },
  skills: {
    async invoke(
      _id: string,
      _args: unknown,
      _context: unknown,
    ): Promise<unknown> {
      throw new Error(
        "sidecarClient.skills.invoke not implemented — W1b stub.",
      );
    },
  },
  routing: {
    async select(_req: RoutingSelectRequest): Promise<RoutingSelectResponse> {
      throw new Error(
        "sidecarClient.routing.select not implemented — W1b stub.",
      );
    },
  },
};
