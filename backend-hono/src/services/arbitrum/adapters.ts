// [claude-code 2026-04-24] S35-T1: Provider adapters for Arbitrum seats.
// Ollama + DashScope + Groq are OpenAI-compatible chat endpoints. Harper-cao's
// OpenRouter path lives in hermes-handler.ts and is NOT touched by this module.

import { createLogger } from "../../lib/logger.js";
import { resolveProvider, type ArbitrumProvider } from "../hermes-service.js";

const log = createLogger("ArbitrumAdapter");

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

async function dashscopeChat(req: SeatChatRequest): Promise<string> {
  const apiKey = process.env.DASHSCOPE_API_KEY;
  if (!apiKey) throw new ProviderUnavailable("DASHSCOPE_API_KEY not set");
  const url =
    "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions";
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
 * Route a chat request to the seat's resolved provider. Falls back to Groq
 * only when the primary is DashScope (DashScope free-tier rate-limit fallback).
 * Never touches OpenRouter — that path is reserved for harper-cao.
 */
export async function seatChat(req: SeatChatRequest): Promise<SeatChatResult> {
  const provider = resolveProvider(req.modelId);
  const started = Date.now();

  const runPrimary = async (): Promise<string> => {
    switch (provider) {
      case "ollama":
        return ollamaChat(req);
      case "dashscope":
        return dashscopeChat(req);
      case "groq":
        return groqChat(req);
      case "openrouter":
      default:
        throw new ProviderUnavailable(
          `Arbitrum seats cannot use provider=${provider}; harper-cao path is protected`,
        );
    }
  };

  try {
    const content = await runPrimary();
    return {
      content,
      modelId: req.modelId,
      provider,
      latency_ms: Date.now() - started,
    };
  } catch (err) {
    if (provider === "dashscope") {
      log.warn("DashScope failed, falling back to Groq", {
        error: err instanceof Error ? err.message : String(err),
      });
      try {
        const content = await groqChat(req);
        return {
          content,
          modelId: req.modelId,
          provider: "groq",
          latency_ms: Date.now() - started,
        };
      } catch (groqErr) {
        throw new Error(
          `dashscope+groq both failed for ${req.modelId}: ${String(groqErr)}`,
        );
      }
    }
    throw err;
  }
}
