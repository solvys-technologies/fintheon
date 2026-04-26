// [claude-code 2026-04-26] S35-T13: Provider adapters for Arbitrum seats.
// Three free providers:
//   - ollama  → Ollama Cloud (cross-family models via local `:cloud` proxy)
//   - vproxy  → Claude Code subscription (claude-opus-4-7 via local CLI)
//   - groq    → explicit alternate when a model id is mapped to it
// OpenRouter is permanently removed from this layer.

import { resolveProvider, type ArbitrumProvider } from "../hermes-service.js";

// [claude-code 2026-04-26] S35-T13: bumped 18s → 90s. Cloud reasoning models
// (qwen3.5:397b, deepseek-v3.2, mistral-large-3) routinely take 20-60s for
// the reasoning phase before content emits. 18s aborted them mid-thought.
const DEFAULT_TIMEOUT_MS = 90_000;

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

async function vproxyChat(req: SeatChatRequest): Promise<string> {
  // VProxy → claude-opus-4-7 via the local Claude Code subscription. The
  // generateTextViaClaude helper accepts a single prompt, so we synthesize
  // system+user into one input and forward.
  const { generateTextViaClaude } = await import(
    "../claude-sdk/process-manager.js"
  );
  const prompt = `${req.system}\n\n${req.user}`;
  const text = await generateTextViaClaude(prompt, {
    model: req.modelId,
    timeoutMs: req.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  });
  return text ?? "";
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
 * an explicit alternate when a model id is mapped to it via
 * ARBITRUM_MODEL_PROVIDER_MAP. OpenRouter has been removed entirely.
 */
export async function seatChat(req: SeatChatRequest): Promise<SeatChatResult> {
  const provider = resolveProvider(req.modelId);
  const started = Date.now();

  const runPrimary = async (): Promise<string> => {
    switch (provider) {
      case "ollama":
        return ollamaChat(req);
      case "vproxy":
        return vproxyChat(req);
      case "groq":
        return groqChat(req);
      default: {
        const exhaustive: never = provider;
        throw new ProviderUnavailable(
          `Unknown Arbitrum provider: ${exhaustive as string}`,
        );
      }
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
