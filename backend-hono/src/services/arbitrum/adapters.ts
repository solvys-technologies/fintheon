// [claude-code 2026-05-07] Refactored: Hermes Agent API server (localhost:8081) is now
//   the primary AI gateway for all Arbitrum seats. DeepSeek direct, Ollama, and Groq
//   retained as explicit alternates. Stripped VProxy references.

import { resolveProvider, type ArbitrumProvider } from "../hermes-service.js";

const DEFAULT_TIMEOUT_MS = 240_000;

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
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText}: ${text.slice(0, 240)}`);
  }
  return (await res.json()) as T;
}

async function deepseekChat(req: SeatChatRequest): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new ProviderUnavailable("DEEPSEEK_API_KEY not set");
  const base = process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com";
  const url = `${base.replace(/\/$/, "")}/v1/chat/completions`;
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

async function ollamaChat(req: SeatChatRequest): Promise<string> {
  const base = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
  const url = `${base.replace(/\/$/, "")}/api/chat`;
  const apiKey = process.env.OLLAMA_API_KEY ?? process.env.DEEPSEEK_API_KEY;
  const headers: Record<string, string> = apiKey
    ? { Authorization: `Bearer ${apiKey}` }
    : {};
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
    headers,
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
 * Route a chat request. Primary: DeepSeek direct (fastest path for seat calls).
 * Hermes Agent API server is used for brief generation and other non-realtime work.
 */
export async function seatChat(req: SeatChatRequest): Promise<SeatChatResult> {
  const started = Date.now();

  // Direct provider routing — skip Hermes Agent for seat calls due to latency
  const provider = resolveProvider(req.modelId);

  const runProvider = async (): Promise<string> => {
    switch (provider) {
      case "deepseek-direct":
      case "deepseek-oc-api":
        return deepseekChat(req);
      case "ollama":
        return ollamaChat(req);
      case "groq":
        return groqChat(req);
      default:
        throw new ProviderUnavailable(
          `Arbitrum seats cannot use provider=${provider}`,
        );
    }
  };

  const content = await runProvider();
  return {
    content,
    modelId: req.modelId,
    provider,
    latency_ms: Date.now() - started,
  };
}
