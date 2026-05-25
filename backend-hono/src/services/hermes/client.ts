// [claude-code 2026-05-05] S59-T1: Native Hermes Agent client.
// Replaces ai/sidecar-client.ts — calls the native TypeScript runtime instead of
// the (now deleted) Python FastAPI sidecar over HTTP.
//
// Drop-in compatibility: same export surface as sidecar-client.ts so existing
// callers work without changes. isSidecarEnabled() now returns false (no HTTP
// sidecar exists); caller fallback paths are preserved. New native API:
// streamChat() / chat() / chatSync() for direct agent invocation.

import { hermesChat, hermesChatStream } from "./runtime.js";
import type { AgentId, ChatEvent, ChatRequest } from "./types.js";
import { createLogger } from "../../lib/logger.js";

const log = createLogger("HermesClient");

// ── Re-export types ────────────────────────────────────────────────────────

export type {
  ChatEvent,
  ChatEventType,
  ChatDeltaEvent,
  ChatDoneEvent,
  ChatErrorEvent,
  ChatMemoryWritesEvent,
  ChatRequest,
  ConversationTurn,
  ContextView,
  RoutingSelectRequest,
  RoutingSelectResponse,
  SkillManifest,
  HealthzResponse,
} from "./types.js";

export type { AgentId } from "./types.js";

// ── Config (no sidecar — native runtime is in-process) ─────────────────────

export function isSidecarEnabled(): boolean {
  return false;
}

export function getSidecarBaseUrl(): string {
  return "";
}

export function isSidecarDisabledError(err: unknown): boolean {
  return err instanceof Error && err.message.includes("sidecar disabled");
}

class SidecarDisabledError extends Error {
  constructor(reason = "Hermes sidecar removed — use native runtime") {
    super(reason);
    this.name = "SidecarDisabledError";
  }
}

// ── Native API (replaces what sidecar-client pretended to do) ──────────────

export interface StreamChatOptions {
  model?: string;
  temperature?: number;
  maxOutputTokens?: number;
  timeoutMs?: number;
}

export async function* streamChat(
  agentId: AgentId,
  message: string,
  history: Array<{
    role: "user" | "assistant" | "system";
    content: string;
  }> = [],
  options: StreamChatOptions = {},
): AsyncGenerator<ChatEvent> {
  yield* hermesChatStream(agentId, message, history, options);
}

export async function chat(
  agentId: AgentId,
  message: string,
  history: Array<{
    role: "user" | "assistant" | "system";
    content: string;
  }> = [],
  options: StreamChatOptions = {},
): Promise<{ content: string; tokens?: { in: number; out: number } }> {
  return hermesChat(agentId, message, history, options);
}

export async function chatSync(
  agentId: AgentId,
  message: string,
  history: Array<{
    role: "user" | "assistant" | "system";
    content: string;
  }> = [],
  options: StreamChatOptions = {},
): Promise<string> {
  const result = await hermesChat(agentId, message, history, options);
  return result.content;
}

// ── Legacy sidecarClient shim (backward compat for existing callers) ────────

export const SIDECAR_CLIENT_READY = true;

export const sidecarClient = {
  async healthz() {
    log.warn(
      "sidecarClient.healthz called — sidecar removed, returning degraded",
    );
    return {
      ok: false,
      version: "native-ts-runtime",
      context_engine: "native",
      plugins_loaded: [],
    };
  },

  chat: {
    async *stream(req: {
      agent_id: string;
      conversation_id: string;
      user_message: string;
      system_overrides?: Record<string, unknown>;
      stream?: boolean;
    }): AsyncGenerator<ChatEvent> {
      log.info("sidecarClient.chat.stream — routing to native runtime", {
        agent: req.agent_id,
        conversation: req.conversation_id,
      });
      yield* hermesChatStream(req.agent_id as AgentId, req.user_message);
    },
  },

  context: {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async ingest(_conversation_id: string, _turn?: unknown) {
      log.warn("sidecarClient.context.ingest — no-op (sidecar removed)");
    },
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async view(
      _conversation_id?: string,
      _budget_tokens?: number,
    ): Promise<{ turns: unknown[]; summaries: unknown[] }> {
      log.warn("sidecarClient.context.view — no-op (sidecar removed)");
      return { turns: [], summaries: [] };
    },
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async tool<T = unknown>(
      _tool_name?: string,
      _conversation_id?: string,
      _args?: Record<string, unknown>,
    ): Promise<T> {
      log.warn("sidecarClient.context.tool — no-op (sidecar removed)");
      return null as T;
    },
  },

  voice: {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async stt(_args?: { audio_bytes?: string; lang?: string }): Promise<{
      transcript: string;
      words: { word: string; start: number; end: number }[];
    }> {
      throw new SidecarDisabledError(
        "sidecarClient.voice.stt unavailable — sidecar removed",
      );
    },
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async tts(_args?: {
      text?: string;
      voice_id?: string;
      stream?: boolean;
    }): Promise<ArrayBuffer> {
      throw new SidecarDisabledError(
        "sidecarClient.voice.tts unavailable — sidecar removed",
      );
    },
  },

  skills: {
    async list(): Promise<unknown[]> {
      log.warn("sidecarClient.skills.list — no-op (sidecar removed)");
      return [];
    },
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async invoke<T = unknown>(
      _skill_id?: string,
      _args?: Record<string, unknown>,
      _context?: Record<string, unknown>,
    ): Promise<T> {
      log.warn("sidecarClient.skills.invoke — no-op (sidecar removed)");
      return null as T;
    },
  },

  routing: {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async select(_req?: {
      agent_id?: string;
      task_type?: string;
      input_tokens?: number;
    }): Promise<{ model: string; provider: string }> {
      log.warn("sidecarClient.routing.select — no-op (sidecar removed)");
      return { model: "deepseek-reasoner", provider: "deepseek" };
    },
  },
};
