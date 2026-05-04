// [claude-code 2026-05-03] S58-T1: DeepSeek v4 Pro primary provider migration
// Primary: DeepSeek direct. Fallback: OpenRouter. Last resort: VProxy.

import { createLogger } from "../../lib/logger.js";
import {
  generateTextViaVProxy,
  getVProxyHealth,
  isVProxyAnthropicEnabled,
  type VProxyTextOptions,
} from "../vproxy/anthropic-client.js";
import {
  generateTextViaOllama,
  getOllamaModel,
  isOllamaFallbackEnabled,
  streamTextViaOllama,
} from "./ollama-hermes-client.js";
import { generateTextViaOpenRouter } from "./openrouter-fallback.js";

export { getChainHealth, type ChainHealth } from "./provider-chain-health.js";

const log = createLogger("AIChain");

type OrderedChainProvider = "deepseek-direct" | "openrouter" | "vproxy";

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
  provider: OrderedChainProvider;
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
  // Network unreachable, timeouts, or 5xx errors trigger the retry.
  if (msg.includes("timed out") || msg.includes("timeout")) return true;
  if (msg.includes("fetch failed")) return true;
  if (msg.includes("econnrefused") || msg.includes("enotfound")) return true;
  if (msg.includes("unavailable")) return true;
  if (/\b5\d{2}\b/.test(msg)) return true;
  return false;
}

// ── Core: generateViaChain ────────────────────────────────────────────────

/**
 * Send a prompt through the DeepSeek → OpenRouter → VProxy fallback chain.
 * Returns the response text plus which provider actually answered.
 */
export async function generateViaChain(
  request: ChainRequest,
): Promise<ChainResult> {
  const errors: string[] = [];
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
      const latencyMs = Date.now() - start;
      recordPrimary();
      log.info("[ai-chain] deepseek-direct ok", {
        latencyMs,
        model: request.model || getOllamaModel(),
        requestId: request.requestId,
      });
      return { response, provider: "deepseek-direct", latencyMs };
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      errors.push(`DeepSeek: ${e.message}`);
      if (!isRetryable(e)) throw e;
      recordFallback();
      log.warn("[ai-chain] deepseek-direct failed; trying OpenRouter", {
        error: e.message,
        requestId: request.requestId,
      });
    }
  }

  if (process.env.OPENROUTER_API_KEY) {
    const start = Date.now();
    try {
      const response = await generateTextViaOpenRouter(request);
      const latencyMs = Date.now() - start;
      log.info("[ai-chain] openrouter ok", {
        latencyMs,
        requestId: request.requestId,
      });
      return { response, provider: "openrouter", latencyMs };
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      errors.push(`OpenRouter: ${e.message}`);
      if (!isRetryable(e)) throw e;
      recordFallback();
      log.warn("[ai-chain] openrouter failed; trying VProxy last", {
        error: e.message,
        requestId: request.requestId,
      });
    }
  } else {
    errors.push("OpenRouter: OPENROUTER_API_KEY not set");
  }

  const vproxyEnabled = isVProxyAnthropicEnabled();
  if (vproxyEnabled) {
    const start = Date.now();
    try {
      const vproxyOptions: VProxyTextOptions = {
        prompt: request.prompt,
        systemPrompt: request.systemPrompt,
        model: request.model,
        maxOutputTokens: request.maxOutputTokens,
        timeoutMs: request.timeoutMs,
      };
      const response = await generateTextViaVProxy(vproxyOptions);
      const latencyMs = Date.now() - start;
      recordFallback();
      log.info("[ai-chain] vproxy ok", {
        latencyMs,
        requestId: request.requestId,
      });
      return { response, provider: "vproxy", latencyMs };
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      errors.push(`VProxy: ${e.message}`);
    }
  } else {
    errors.push("VProxy: disabled");
  }
  const combined = errors.join(" | ");
  log.error("[ai-chain] all providers failed", { combined });
  throw new Error(`AI chain exhausted — ${combined}`);
}

// ── Streaming: streamViaChain ────────────────────────────────────────────
//
// Streaming fallback is best-effort: if VProxy fails BEFORE the first token
// ships to the client we retry against Ollama. If it fails mid-stream the
// caller sees the partial response + error (same contract as VProxy today).

export interface ChainStreamEvent {
  type: "text-delta" | "provider" | "end";
  delta?: string;
  provider?: OrderedChainProvider;
}

/**
 * Stream text through the chain. Yields a leading `provider` event once the
 * active provider is known, then `text-delta` events, then `end`.
 */
export async function* streamViaChain(
  request: ChainRequest & { abortSignal?: AbortSignal },
): AsyncGenerator<ChainStreamEvent> {
  // Streaming uses DeepSeek direct. Fallback after partial tokens is unsafe, so
  // callers receive the upstream stream error if DeepSeek fails mid-response.
  if (isOllamaFallbackEnabled()) {
    yield { type: "provider", provider: "deepseek-direct" };
    for await (const chunk of streamTextViaOllama({
      prompt: request.prompt,
      systemPrompt: request.systemPrompt,
      model: request.model || getOllamaModel(),
      maxOutputTokens: request.maxOutputTokens,
      temperature: request.temperature,
      abortSignal: request.abortSignal,
    })) {
      yield { type: "text-delta", delta: chunk };
    }
    yield { type: "end", provider: "deepseek-direct" };
    return;
  }

  const vproxyEnabled = isVProxyAnthropicEnabled();

  if (vproxyEnabled) {
    const vproxyHealth = await getVProxyHealth();
    if (vproxyHealth.available) {
      try {
        // Import lazily to avoid circular deps at module-load time.
        const { streamTextViaVProxy } =
          await import("../vproxy/anthropic-client.js");
        const stream = streamTextViaVProxy({
          prompt: request.prompt,
          systemPrompt: request.systemPrompt,
          model: request.model,
          maxOutputTokens: request.maxOutputTokens,
          abortSignal: request.abortSignal,
        });
        yield { type: "provider", provider: "vproxy" };
        let delivered = false;
        for await (const part of stream.fullStream) {
          if (part.type === "text-delta" && part.text) {
            delivered = true;
            yield { type: "text-delta", delta: part.text };
          }
        }
        recordPrimary();
        yield { type: "end", provider: "vproxy" };
        return;
        // eslint-disable-next-line no-unused-vars
        void delivered;
      } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err));
        throw e;
      }
    } else {
      log.warn(
        `[ai-chain] vproxy unhealthy (${vproxyHealth.error ?? "unknown"}) for request ${request.requestId ?? "-"}`,
      );
    }
  }

  throw new Error("AI chain exhausted: DeepSeek streaming disabled and VProxy unavailable");
}
