// [claude-code 2026-05-06] S59-T4: stripped OpenRouter and VProxy. Chain is now
//   DeepSeek direct → OpenCode Go fallback only.

import { createLogger } from "../../lib/logger.js";
import {
  generateTextViaOllama,
  getOllamaModel,
  isOllamaFallbackEnabled,
  streamTextViaOllama,
} from "./ollama-hermes-client.js";

const log = createLogger("AIChain");

type ChainProvider = "deepseek-direct" | "opencode-go";

export interface ChainRequest {
  prompt: string;
  systemPrompt?: string;
  model?: string;
  maxOutputTokens?: number;
  temperature?: number;
  timeoutMs?: number;
  requestId?: string;
}

export interface ChainResult {
  response: string;
  provider: ChainProvider;
  latencyMs: number;
}

// ── Observability state ───────────────────────────────────────────────────

interface ChainStats {
  fallbacksLastHour: number[];
  primaryCallsLastHour: number[];
}

const stats: ChainStats = {
  fallbacksLastHour: [],
  primaryCallsLastHour: [],
};

function pruneOld(buf: number[]): number[] {
  const cutoff = Date.now() - 60 * 60 * 1000;
  while (buf.length > 0 && buf[0] < cutoff) buf.shift();
  return buf;
}

function recordPrimary(): void {
  stats.primaryCallsLastHour.push(Date.now());
  pruneOld(stats.primaryCallsLastHour);
}

function recordFallback(): void {
  stats.fallbacksLastHour.push(Date.now());
  pruneOld(stats.fallbacksLastHour);
}

export function getChainStats(): {
  fallbacksLastHour: number;
  primaryCallsLastHour: number;
} {
  pruneOld(stats.fallbacksLastHour);
  pruneOld(stats.primaryCallsLastHour);
  return {
    fallbacksLastHour: stats.fallbacksLastHour.length,
    primaryCallsLastHour: stats.primaryCallsLastHour.length,
  };
}

// ── Error classification ──────────────────────────────────────────────────

function isRetryable(err: unknown): boolean {
  if (!(err instanceof Error)) return true;
  const msg = err.message.toLowerCase();
  if (msg.includes("timed out") || msg.includes("timeout")) return true;
  if (msg.includes("fetch failed")) return true;
  if (msg.includes("econnrefused") || msg.includes("enotfound")) return true;
  if (msg.includes("unavailable")) return true;
  if (/\b5\d{2}\b/.test(msg)) return true;
  if (msg.includes("401") || msg.includes("403") || msg.includes("authentication") || msg.includes("invalid")) return true;
  return false;
}

// ── OpenCode Go fallback generation ───────────────────────────────────────

async function generateTextViaOpenCodeGo(request: ChainRequest): Promise<string> {
  const apiKey = process.env.OPENCODE_GO_API_KEY || process.env.HERMES_API_KEY || "opencode-go";
  const baseUrl = process.env.HERMES_API_URL || "http://localhost:8317/v1";

  const messages = [] as Array<{ role: "system" | "user"; content: string }>;
  if (request.systemPrompt) {
    messages.push({ role: "system", content: request.systemPrompt });
  }
  messages.push({ role: "user", content: request.prompt });

  const res = await fetch(`${baseUrl.replace(/\/+$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: request.model || "deepseek-reasoner",
      messages,
      max_tokens: request.maxOutputTokens ?? 8192,
      temperature: request.temperature ?? 0.4,
    }),
    signal: AbortSignal.timeout(request.timeoutMs ?? 120_000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`OpenCode Go ${res.status}: ${text.slice(0, 200)}`);
  }

  const payload = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return payload.choices?.[0]?.message?.content ?? "";
}

// ── Core: generateViaChain ────────────────────────────────────────────────

export async function generateViaChain(
  request: ChainRequest,
): Promise<ChainResult> {
  const errors: string[] = [];

  // Tier 1: DeepSeek direct (via Ollama/Hermes)
  if (isOllamaFallbackEnabled()) {
    const start = Date.now();
    try {
      const response = await generateTextViaOllama({
        prompt: request.prompt,
        systemPrompt: request.systemPrompt,
        model: request.model || getOllamaModel(),
        maxOutputTokens: request.maxOutputTokens,
        temperature: request.temperature,
        timeoutMs: request.timeoutMs,
      });
      recordPrimary();
      log.info("[ai-chain] deepseek-direct ok", {
        latencyMs: Date.now() - start,
        requestId: request.requestId,
      });
      return { response, provider: "deepseek-direct", latencyMs: Date.now() - start };
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      errors.push(`DeepSeek: ${e.message}`);
      if (!isRetryable(e)) throw e;
      recordFallback();
      log.warn("[ai-chain] deepseek-direct failed; trying OpenCode Go", {
        error: e.message,
        requestId: request.requestId,
      });
    }
  }

  // Tier 2: OpenCode Go fallback
  const start = Date.now();
  try {
    const response = await generateTextViaOpenCodeGo(request);
    log.info("[ai-chain] opencode-go ok", {
      latencyMs: Date.now() - start,
      requestId: request.requestId,
    });
    return { response, provider: "opencode-go", latencyMs: Date.now() - start };
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    errors.push(`OpenCode Go: ${e.message}`);
  }

  throw new Error(`AI chain exhausted: ${errors.join("; ")}`);
}

// ── Streaming ─────────────────────────────────────────────────────────────

export async function* streamViaChain(
  request: ChainRequest,
): AsyncGenerator<
  { type: "text" | "end" | "error"; text?: string; provider?: ChainProvider; error?: string },
  void,
  unknown
> {
  if (isOllamaFallbackEnabled()) {
    try {
      yield { type: "text", text: "", provider: "deepseek-direct" };
      for await (const chunk of streamTextViaOllama({
        prompt: request.prompt,
        systemPrompt: request.systemPrompt,
        model: request.model || getOllamaModel(),
        maxOutputTokens: request.maxOutputTokens,
        temperature: request.temperature,
      })) {
        yield { type: "text", text: chunk };
      }
      yield { type: "end", provider: "deepseek-direct" };
      return;
    } catch (err) {
      log.warn("[ai-chain] deepseek-direct stream failed; trying OpenCode Go", {
        error: String(err),
        requestId: request.requestId,
      });
    }
  }

  // OpenCode Go streaming fallback
  yield { type: "text", text: "", provider: "opencode-go" };
  try {
    const response = await generateTextViaOpenCodeGo(request);
    yield { type: "text", text: response };
    yield { type: "end", provider: "opencode-go" };
  } catch (err) {
    yield { type: "error", error: `AI chain exhausted: ${String(err)}` };
  }
}
