// [claude-code 2026-05-05] S59-T1: Removed HERMES_SIDECAR_URL fallback — sidecar deleted.

import { createLogger } from "../../lib/logger.js";

const log = createLogger("DeepSeekCompat");

const DEFAULT_BASE_URL = "https://api.deepseek.com";
const DEFAULT_MODEL = "deepseek-reasoner";
const HEALTH_CACHE_TTL_MS = 15_000;

function getAuthHeaders(): Record<string, string> {
  const key =
    process.env.DEEPSEEK_API_KEY ??
    process.env.HERMES_API_KEY ??
    process.env.OLLAMA_API_KEY;
  return key ? { Authorization: `Bearer ${key}` } : {};
}

export interface OllamaHealth {
  enabled: boolean;
  available: boolean;
  baseUrl: string;
  model: string;
  checkedAt: number;
  error: string | null;
}

export interface OllamaTextOptions {
  prompt: string;
  systemPrompt?: string;
  model?: string;
  maxOutputTokens?: number;
  temperature?: number;
  timeoutMs?: number;
}

export interface OllamaStreamOptions extends OllamaTextOptions {
  abortSignal?: AbortSignal;
}

let healthCache: OllamaHealth | null = null;

export function isOllamaFallbackEnabled(): boolean {
  return process.env.DEEPSEEK_DIRECT_ENABLED !== "false";
}

export function getOllamaBaseUrl(): string {
  const raw =
    process.env.OLLAMA_BASE_URL ||
    DEFAULT_BASE_URL;
  return raw.replace(/\/+$/, "");
}

export function getOllamaModel(): string {
  return process.env.OLLAMA_FALLBACK_MODEL || DEFAULT_MODEL;
}

export async function getOllamaHealth(force = false): Promise<OllamaHealth> {
  const enabled = isOllamaFallbackEnabled();
  const baseUrl = getOllamaBaseUrl();
  const model = getOllamaModel();

  if (!enabled) {
    const disabledState: OllamaHealth = {
      enabled: false,
      available: false,
      baseUrl,
      model,
      checkedAt: Date.now(),
      error: "OLLAMA_FALLBACK_ENABLED=false",
    };
    healthCache = disabledState;
    return disabledState;
  }

  if (
    !force &&
    healthCache &&
    Date.now() - healthCache.checkedAt < HEALTH_CACHE_TTL_MS
  ) {
    return healthCache;
  }

  try {
    const res = await fetch(`${baseUrl}/v1/models`, {
      headers: getAuthHeaders(),
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) {
      throw new Error(`${baseUrl}/v1/models returned ${res.status}`);
    }
    const payload = (await res.json()) as { data?: Array<{ id?: string }> };
    const models = (payload.data ?? []).map((m) => m.id ?? "").filter(Boolean);
    healthCache = {
      enabled: true,
      available: true,
      baseUrl,
      model,
      checkedAt: Date.now(),
      error: models.includes(model)
        ? null
        : `model ${model} not installed (have: ${models.slice(0, 3).join(",")})`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    healthCache = {
      enabled: true,
      available: false,
      baseUrl,
      model,
      checkedAt: Date.now(),
      error: message,
    };
    log.warn("DeepSeek-compatible health check failed", { error: message, baseUrl });
  }

  return healthCache;
}

interface OllamaChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface OllamaChatResponse {
  choices?: Array<{ message?: { content?: string } }>;
}

/** Non-streaming generation via DeepSeek/OpenAI-compatible endpoint. */
export async function generateTextViaOllama(
  options: OllamaTextOptions,
): Promise<string> {
  const baseUrl = getOllamaBaseUrl();
  const model = options.model || getOllamaModel();

  const messages: OllamaChatMessage[] = [];
  if (options.systemPrompt) {
    messages.push({ role: "system", content: options.systemPrompt });
  }
  messages.push({ role: "user", content: options.prompt });

  const body = {
    model,
    messages,
    max_tokens: options.maxOutputTokens ?? 8192,
    temperature: options.temperature ?? 0.4,
    stream: false,
  };

  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? 120_000;
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(
        `DeepSeek-compatible /v1/chat/completions ${res.status}: ${text.slice(0, 200)}`,
      );
    }
    const payload = (await res.json()) as OllamaChatResponse;
    return payload.choices?.[0]?.message?.content ?? "";
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Stream deltas from DeepSeek/OpenAI-compatible endpoint. Yields text chunks.
 * The caller adapts these into whatever downstream stream shape is required.
 */
export async function* streamTextViaOllama(
  options: OllamaStreamOptions,
): AsyncGenerator<string> {
  const baseUrl = getOllamaBaseUrl();
  const model = options.model || getOllamaModel();

  const messages: OllamaChatMessage[] = [];
  if (options.systemPrompt) {
    messages.push({ role: "system", content: options.systemPrompt });
  }
  messages.push({ role: "user", content: options.prompt });

  const body = {
    model,
    messages,
    max_tokens: options.maxOutputTokens ?? 8192,
    temperature: options.temperature ?? 0.4,
    stream: true,
  };

  const res = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      ...getAuthHeaders(),
    },
    body: JSON.stringify(body),
    signal: options.abortSignal,
  });

  if (!res.ok || !res.body) {
    const text = res.body ? await res.text() : "";
    throw new Error(
      `DeepSeek-compatible /v1/chat/completions stream ${res.status}: ${text.slice(0, 200)}`,
    );
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let boundary = buffer.indexOf("\n");
    while (boundary !== -1) {
      const line = buffer.slice(0, boundary).trim();
      buffer = buffer.slice(boundary + 1);
      boundary = buffer.indexOf("\n");
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (!data || data === "[DONE]") continue;
      try {
        const parsed = JSON.parse(data) as {
          choices?: Array<{ delta?: { content?: string } }>;
        };
        const delta = parsed.choices?.[0]?.delta?.content;
        if (delta) yield delta;
      } catch {
        // ignore malformed lines
      }
    }
  }
}
