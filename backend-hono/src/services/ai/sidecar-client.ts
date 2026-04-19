// [claude-code 2026-04-19] S27-T2 W1b — typed HTTP client for the Hermes Python sidecar.
// Wire contract is authoritative in shared/sidecar-contract.ts. Types mirrored locally
// because backend-hono tsconfig has rootDir=./src and does not cross into shared/.
// If you update the contract, update both files.
//
// Gate: HERMES_SIDECAR_ENABLED=false makes every call short-circuit so the legacy
// hermes-handler.ts path keeps serving. W1b defaults this flag OFF; W2b flips it ON.

import { createLogger } from "../../lib/logger.js";

const log = createLogger("SidecarClient");

// ── Wire types (mirror of shared/sidecar-contract.ts) ────────────────────

export type ChatEventType =
  | "delta"
  | "tool_call"
  | "tool_result"
  | "done"
  | "error"
  | "memory_writes"
  | "context_view";

export interface ChatEvent {
  type: ChatEventType;
  payload: unknown;
}

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

export interface SummaryNode {
  id: string;
  kind: "summary" | "raw_turn" | "tool_result";
  text: string;
  tokens_estimated: number;
  children: string[];
}

export interface ContextView {
  turns: ConversationTurn[];
  summaries: SummaryNode[];
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

// ── Config ────────────────────────────────────────────────────────────────

const SIDECAR_PORT_LOCAL = 8318;

export function isSidecarEnabled(): boolean {
  return process.env.HERMES_SIDECAR_ENABLED === "true";
}

export function getSidecarBaseUrl(): string {
  if (process.env.HERMES_SIDECAR_URL) return process.env.HERMES_SIDECAR_URL;
  if (process.env.FLY_APP_NAME) {
    return `http://fintheon-hermes.internal:${SIDECAR_PORT_LOCAL}`;
  }
  return `http://localhost:${SIDECAR_PORT_LOCAL}`;
}

function getJwt(): string {
  return process.env.INTERNAL_HERMES_JWT ?? "";
}

class SidecarDisabledError extends Error {
  constructor() {
    super(
      "sidecar disabled via HERMES_SIDECAR_ENABLED=false — caller should fall back",
    );
    this.name = "SidecarDisabledError";
  }
}

export function isSidecarDisabledError(
  err: unknown,
): err is SidecarDisabledError {
  return err instanceof Error && err.name === "SidecarDisabledError";
}

function assertEnabled(): void {
  if (!isSidecarEnabled()) throw new SidecarDisabledError();
}

function authHeaders(): Record<string, string> {
  const jwt = getJwt();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (jwt) headers["Authorization"] = `Bearer ${jwt}`;
  return headers;
}

async function jsonRequest<T>(
  path: string,
  init: RequestInit & { query?: Record<string, string | number> } = {},
): Promise<T> {
  assertEnabled();
  const base = getSidecarBaseUrl();
  const url = new URL(path, base);
  if (init.query) {
    for (const [k, v] of Object.entries(init.query)) {
      url.searchParams.set(k, String(v));
    }
  }
  const res = await fetch(url, {
    ...init,
    headers: { ...authHeaders(), ...(init.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `sidecar ${init.method ?? "GET"} ${path} failed: ${res.status} ${body}`,
    );
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// ── SSE parsing for /v1/chat ──────────────────────────────────────────────

async function* parseSse(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<ChatEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let boundary = buffer.indexOf("\n\n");
    while (boundary !== -1) {
      const rawEvent = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      const dataLines = rawEvent
        .split("\n")
        .filter((l) => l.startsWith("data:"))
        .map((l) => l.slice(5).trimStart());
      if (dataLines.length > 0) {
        const dataStr = dataLines.join("\n");
        try {
          const parsed = JSON.parse(dataStr) as ChatEvent;
          yield parsed;
        } catch (err) {
          log.warn("sse parse failed", {
            preview: dataStr.slice(0, 120),
            error: String(err),
          });
        }
      }
      boundary = buffer.indexOf("\n\n");
    }
  }
}

// ── Public client ─────────────────────────────────────────────────────────

export const SIDECAR_CLIENT_READY = true;

export const sidecarClient = {
  async healthz(): Promise<HealthzResponse> {
    const base = getSidecarBaseUrl();
    const res = await fetch(new URL("/healthz", base));
    if (!res.ok) throw new Error(`sidecar healthz failed: ${res.status}`);
    return (await res.json()) as HealthzResponse;
  },

  chat: {
    async *stream(req: ChatRequest): AsyncGenerator<ChatEvent> {
      assertEnabled();
      const base = getSidecarBaseUrl();
      const res = await fetch(new URL("/v1/chat", base), {
        method: "POST",
        headers: { ...authHeaders(), Accept: "text/event-stream" },
        body: JSON.stringify({ stream: true, ...req }),
      });
      if (!res.ok || !res.body) {
        const body = res.body ? await res.text() : "";
        throw new Error(`sidecar /v1/chat failed: ${res.status} ${body}`);
      }
      yield* parseSse(res.body);
    },
  },

  context: {
    async ingest(
      conversation_id: string,
      turn: ConversationTurn,
    ): Promise<void> {
      await jsonRequest<void>("/v1/context/ingest", {
        method: "POST",
        body: JSON.stringify({ conversation_id, turn }),
      });
    },
    async view(
      conversation_id: string,
      budget_tokens = 120000,
    ): Promise<ContextView> {
      return jsonRequest<ContextView>("/v1/context/view", {
        method: "GET",
        query: { conversation_id, budget_tokens },
      });
    },
    async tool<T = unknown>(
      tool_name: string,
      conversation_id: string,
      args: Record<string, unknown>,
    ): Promise<T> {
      const safeName = encodeURIComponent(tool_name);
      return jsonRequest<T>(`/v1/context/tools/${safeName}`, {
        method: "POST",
        body: JSON.stringify({ conversation_id, args }),
      });
    },
  },

  voice: {
    async stt(args: { audio_bytes: string; lang?: string }) {
      return jsonRequest<{
        transcript: string;
        words: { word: string; start: number; end: number }[];
      }>("/v1/voice/stt", { method: "POST", body: JSON.stringify(args) });
    },
    async tts(args: {
      text: string;
      voice_id: string;
      stream?: boolean;
    }): Promise<ArrayBuffer> {
      assertEnabled();
      const base = getSidecarBaseUrl();
      const res = await fetch(new URL("/v1/voice/tts", base), {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(args),
      });
      if (!res.ok)
        throw new Error(`sidecar /v1/voice/tts failed: ${res.status}`);
      return res.arrayBuffer();
    },
  },

  skills: {
    async list(): Promise<SkillManifest[]> {
      return jsonRequest<SkillManifest[]>("/v1/skills", { method: "GET" });
    },
    async invoke<T = unknown>(
      skill_id: string,
      args: Record<string, unknown>,
      context?: Record<string, unknown>,
    ): Promise<T> {
      return jsonRequest<T>("/v1/skills/invoke", {
        method: "POST",
        body: JSON.stringify({ skill_id, args, context }),
      });
    },
  },

  routing: {
    async select(req: RoutingSelectRequest): Promise<RoutingSelectResponse> {
      return jsonRequest<RoutingSelectResponse>("/v1/routing/select", {
        method: "POST",
        body: JSON.stringify(req),
      });
    },
  },
};
