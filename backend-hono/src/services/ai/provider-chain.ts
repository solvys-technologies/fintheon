// [claude-code 2026-04-23] S32-T3 Ollama fallback chain
// Primary: VProxy (Claude Opus via local CLI proxy on :8317).
// Fallback: Ollama-via-Hermes on :11434 (OpenAI-compat, Qwen cloud model).
// Retry policy: one shot at VProxy, on timeout/5xx retry once against Ollama.
// Both failing → throw with both errors surfaced.

import { createLogger } from "../../lib/logger.js";
import {
  generateTextViaVProxy,
  getVProxyHealth,
  isVProxyAnthropicEnabled,
  type VProxyTextOptions,
} from "../vproxy/anthropic-client.js";
import {
  generateTextViaOllama,
  getOllamaHealth,
  getOllamaModel,
  isOllamaFallbackEnabled,
  streamTextViaOllama,
  type OllamaStreamOptions,
  type OllamaTextOptions,
} from "./ollama-hermes-client.js";

const log = createLogger("AIChain");

export type ChainProvider = "vproxy" | "ollama-qwen";

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
 * Send a prompt through the VProxy → Ollama fallback chain.
 * Returns the response text plus which provider actually answered.
 */
export async function generateViaChain(
  request: ChainRequest,
): Promise<ChainResult> {
  const vproxyEnabled = isVProxyAnthropicEnabled();
  const ollamaEnabled = isOllamaFallbackEnabled();

  let vproxyErr: Error | null = null;

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
      recordPrimary();
      log.info("[ai-chain] vproxy ok", {
        latencyMs,
        requestId: request.requestId,
      });
      return { response, provider: "vproxy", latencyMs };
    } catch (err) {
      vproxyErr = err instanceof Error ? err : new Error(String(err));
      const retry = ollamaEnabled && isRetryable(vproxyErr);
      log.warn(
        `[ai-chain] vproxy failed (${vproxyErr.message}), ${
          retry ? "falling back to ollama-qwen" : "no fallback"
        } for request ${request.requestId ?? "-"}`,
      );
      if (!retry) {
        throw vproxyErr;
      }
    }
  }

  if (!ollamaEnabled) {
    throw new Error(
      "AI chain exhausted: VProxy disabled and Ollama fallback disabled",
    );
  }

  const start = Date.now();
  try {
    const ollamaOptions: OllamaTextOptions = {
      prompt: request.prompt,
      systemPrompt: request.systemPrompt,
      model: undefined, // force configured fallback model
      maxOutputTokens: request.maxOutputTokens,
      temperature: request.temperature,
      timeoutMs: request.timeoutMs,
    };
    const response = await generateTextViaOllama(ollamaOptions);
    const latencyMs = Date.now() - start;
    if (vproxyErr) recordFallback();
    else recordPrimary();
    log.info("[ai-chain] ollama-qwen ok", {
      latencyMs,
      model: getOllamaModel(),
      isFallback: !!vproxyErr,
      requestId: request.requestId,
    });
    return { response, provider: "ollama-qwen", latencyMs };
  } catch (err) {
    const ollamaErr = err instanceof Error ? err : new Error(String(err));
    const combined = vproxyErr
      ? `VProxy: ${vproxyErr.message} | Ollama: ${ollamaErr.message}`
      : `Ollama: ${ollamaErr.message}`;
    log.error("[ai-chain] both providers failed", { combined });
    throw new Error(`AI chain exhausted — ${combined}`);
  }
}

// ── Streaming: streamViaChain ────────────────────────────────────────────
//
// Streaming fallback is best-effort: if VProxy fails BEFORE the first token
// ships to the client we retry against Ollama. If it fails mid-stream the
// caller sees the partial response + error (same contract as VProxy today).

export interface ChainStreamEvent {
  type: "text-delta" | "provider" | "end";
  delta?: string;
  provider?: ChainProvider;
}

/**
 * Stream text through the chain. Yields a leading `provider` event once the
 * active provider is known, then `text-delta` events, then `end`.
 */
export async function* streamViaChain(
  request: ChainRequest & { abortSignal?: AbortSignal },
): AsyncGenerator<ChainStreamEvent> {
  // For streaming, we do not pre-flight VProxy: the ai-sdk stream surfaces
  // errors on the first chunk read, which is when we decide to fall back.
  // If VProxy is disabled entirely, jump straight to Ollama.
  const vproxyEnabled = isVProxyAnthropicEnabled();
  const ollamaEnabled = isOllamaFallbackEnabled();

  if (vproxyEnabled) {
    const vproxyHealth = await getVProxyHealth();
    if (vproxyHealth.available) {
      try {
        // Import lazily to avoid circular deps at module-load time.
        const { streamTextViaVProxy } = await import(
          "../vproxy/anthropic-client.js"
        );
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
        if (!ollamaEnabled || !isRetryable(e)) throw e;
        log.warn(
          `[ai-chain] vproxy stream failed (${e.message}), falling back to ollama-qwen for request ${request.requestId ?? "-"}`,
        );
        recordFallback();
      }
    } else {
      log.warn(
        `[ai-chain] vproxy unhealthy (${vproxyHealth.error ?? "unknown"}), falling back to ollama-qwen for request ${request.requestId ?? "-"}`,
      );
      recordFallback();
    }
  }

  if (!ollamaEnabled) {
    throw new Error(
      "AI chain exhausted: VProxy unavailable and Ollama fallback disabled",
    );
  }

  yield { type: "provider", provider: "ollama-qwen" };
  const ollamaStream: OllamaStreamOptions = {
    prompt: request.prompt,
    systemPrompt: request.systemPrompt,
    maxOutputTokens: request.maxOutputTokens,
    temperature: request.temperature,
    abortSignal: request.abortSignal,
  };
  for await (const chunk of streamTextViaOllama(ollamaStream)) {
    yield { type: "text-delta", delta: chunk };
  }
  yield { type: "end", provider: "ollama-qwen" };
}

// ── Combined health snapshot ──────────────────────────────────────────────

export interface ChainHealth {
  primary: {
    provider: "vproxy";
    available: boolean;
    latencyMs: number | null;
    model: string;
    error: string | null;
  };
  fallback: {
    provider: "ollama-hermes";
    model: string;
    available: boolean;
    latencyMs: number | null;
    error: string | null;
  };
}

export async function getChainHealth(): Promise<ChainHealth> {
  const [vproxy, ollama] = await Promise.all([
    getVProxyHealth().catch((err: unknown) => ({
      available: false,
      baseUrl: "",
      model: "",
      checkedAt: Date.now(),
      error: err instanceof Error ? err.message : String(err),
      enabled: true,
    })),
    getOllamaHealth().catch((err: unknown) => ({
      available: false,
      baseUrl: "",
      model: getOllamaModel(),
      checkedAt: Date.now(),
      error: err instanceof Error ? err.message : String(err),
      enabled: true,
    })),
  ]);
  return {
    primary: {
      provider: "vproxy",
      available: vproxy.available,
      latencyMs: null,
      model: vproxy.model,
      error: vproxy.error,
    },
    fallback: {
      provider: "ollama-hermes",
      model: ollama.model,
      available: ollama.available,
      latencyMs: null,
      error: ollama.error,
    },
  };
}
