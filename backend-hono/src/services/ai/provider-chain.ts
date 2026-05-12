// [claude-code 2026-05-07] Refactored: Hermes Agent API server (localhost:8081) is now
//   the primary AI gateway. DeepSeek direct is retained as a fallback. Stripped all
//   VProxy references (port 8317). The chain is: Hermes Agent API → DeepSeek direct.

import { createLogger } from "../../lib/logger.js";
import {
  generateTextViaOllama,
  getOllamaModel,
  streamTextViaOllama,
} from "./ollama-hermes-client.js";

const log = createLogger("AIChain");

type ChainProvider = "hermes-agent" | "deepseek-direct";

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
  return false;
}

// ── Hermes Agent API server generation (primary) ─────────────────────────

async function generateTextViaHermesAgent(
  request: ChainRequest,
): Promise<string> {
  const apiKey =
    process.env.DEEPSEEK_API_KEY || process.env.HERMES_API_KEY || "";
  const baseUrl = process.env.HERMES_API_URL || "http://localhost:8081/v1";

  const messages = [] as Array<{ role: "system" | "user"; content: string }>;
  if (request.systemPrompt) {
    messages.push({ role: "system", content: request.systemPrompt });
  }
  messages.push({ role: "user", content: request.prompt });

  const res = await fetch(`${baseUrl.replace(/\/+$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: apiKey ? `Bearer ${apiKey}` : "",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: request.model || "deepseek-reasoner",
      messages,
      max_tokens: request.maxOutputTokens ?? 8192,
      temperature: request.temperature ?? 0.4,
    }),
    signal: AbortSignal.timeout(request.timeoutMs ?? 180_000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Hermes Agent API ${res.status}: ${text.slice(0, 200)}`);
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

  // Tier 1: Hermes Agent API server (primary AI gateway)
  const hermesEnabled = process.env.HERMES_AGENT_ENABLED !== "false";
  if (hermesEnabled) {
    const start = Date.now();
    try {
      const response = await generateTextViaHermesAgent(request);
      recordPrimary();
      log.info("[ai-chain] hermes-agent ok", {
        latencyMs: Date.now() - start,
        requestId: request.requestId,
      });
      return {
        response,
        provider: "hermes-agent",
        latencyMs: Date.now() - start,
      };
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      errors.push(`Hermes Agent: ${e.message}`);
      if (!isRetryable(e)) {
        // Non-retryable (e.g. auth), fall through to fallback
        recordFallback();
        log.warn(
          "[ai-chain] hermes-agent non-retryable; trying DeepSeek direct",
          {
            error: e.message,
            requestId: request.requestId,
          },
        );
      } else {
        recordFallback();
        log.warn("[ai-chain] hermes-agent failed; trying DeepSeek direct", {
          error: e.message,
          requestId: request.requestId,
        });
      }
    }
  }

  // Tier 2: DeepSeek direct (fallback)
  const deepseekEnabled = process.env.DEEPSEEK_DIRECT_ENABLED !== "false";
  if (deepseekEnabled) {
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
      log.info("[ai-chain] deepseek-direct ok (fallback)", {
        latencyMs: Date.now() - start,
        requestId: request.requestId,
      });
      return {
        response,
        provider: "deepseek-direct",
        latencyMs: Date.now() - start,
      };
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      errors.push(`DeepSeek: ${e.message}`);
    }
  }

  throw new Error(`AI chain exhausted: ${errors.join("; ")}`);
}

// ── Streaming ─────────────────────────────────────────────────────────────

export async function* streamViaChain(request: ChainRequest): AsyncGenerator<
  {
    type: "text" | "end" | "error";
    text?: string;
    provider?: ChainProvider;
    error?: string;
  },
  void,
  unknown
> {
  const hermesEnabled = process.env.HERMES_AGENT_ENABLED !== "false";
  if (hermesEnabled) {
    try {
      yield { type: "text", text: "", provider: "hermes-agent" };
      const response = await generateTextViaHermesAgent(request);
      yield { type: "text", text: response };
      yield { type: "end", provider: "hermes-agent" };
      return;
    } catch (err) {
      log.warn(
        "[ai-chain] hermes-agent stream failed; trying DeepSeek direct",
        {
          error: String(err),
          requestId: request.requestId,
        },
      );
    }
  }

  // DeepSeek direct streaming fallback
  const deepseekEnabled = process.env.DEEPSEEK_DIRECT_ENABLED !== "false";
  if (deepseekEnabled) {
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
      yield { type: "error", error: `AI chain exhausted: ${String(err)}` };
      return;
    }
  }

  yield { type: "error", error: "AI chain exhausted: no providers enabled" };
}
