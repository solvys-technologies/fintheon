// [claude-code 2026-04-26] S35-T11: Provider adapters for Arbitrum seats.
// All seats route through Ollama Cloud (qwen3.5:397b-cloud). Groq remains
// available as an explicit alternate provider; DashScope was removed (paid,
// no key). Harper-cao's OpenRouter path lives in hermes-handler.ts and is
// NOT touched by this module.

import { resolveProvider, type ArbitrumProvider } from "../hermes-service.js";

const DEFAULT_TIMEOUT_MS = 18_000;

export interface SeatChatRequest {
  modelId: string;
  system: string;
  user: string;
  temperature?: number;
  timeoutMs?: number;
}

export interface SeatChatResult {
  content: string;
  modelId: string;
  provider: ArbitrumProvider;
  latency_ms: number;
}

class ProviderUnavailable extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProviderUnavailable";
  }
}

async function postJson<T>(
  url: string,
  body: unknown,
  headers: Record<string, string>,
  timeoutMs: number,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`${res.status} ${res.statusText}: ${text.slice(0, 240)}`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

async function ollamaChat(req: SeatChatRequest): Promise<string> {
  const base = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
  const url = `${base.replace(/\/$/, "")}/api/chat`;
  const data = await postJson<{
    message?: { content?: string };
    messages?: { content?: string }[];
  }>(
    url,
    {
      model: req.modelId,
      stream: false,
      options:
        req.temperature !== undefined
          ? { temperature: req.temperature }
          : undefined,
      messages: [
        { role: "system", content: req.system },
        { role: "user", content: req.user },
      ],
    },
    {},
    req.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );
  return data.message?.content ?? "";
}

async function groqChat(req: SeatChatRequest): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new ProviderUnavailable("GROQ_API_KEY not set");
  const url = "https://api.groq.com/openai/v1/chat/completions";
  const data = await postJson<{
    choices?: { message?: { content?: string } }[];
  }>(
    url,
    {
      model: req.modelId,
      temperature: req.temperature,
      messages: [
        { role: "system", content: req.system },
        { role: "user", content: req.user },
      ],
    },
    { Authorization: `Bearer ${apiKey}` },
    req.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );
  return data.choices?.[0]?.message?.content ?? "";
}

/**
 * Route a chat request to the seat's resolved provider. Ollama Cloud is the
 * primary path for every Arbitrum seat (qwen3.5:397b-cloud). Groq is kept as
 * an explicit alternate when a model id is mapped to it. Never touches
 * OpenRouter — that path is reserved for harper-cao.
 */
export async function seatChat(req: SeatChatRequest): Promise<SeatChatResult> {
  const provider = resolveProvider(req.modelId);
  const started = Date.now();

  const runPrimary = async (): Promise<string> => {
    switch (provider) {
      case "ollama":
        return ollamaChat(req);
      case "groq":
        return groqChat(req);
      case "openrouter":
      default:
        throw new ProviderUnavailable(
          `Arbitrum seats cannot use provider=${provider}; harper-cao path is protected`,
        );
    }
  };

  const content = await runPrimary();
  return {
    content,
    modelId: req.modelId,
    provider,
    latency_ms: Date.now() - started,
  };
}
