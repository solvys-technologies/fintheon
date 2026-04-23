// [claude-code 2026-04-08] Nous provider tries NOUS_MODELS chain (arcee trinity → qwen3.6-plus)
// [claude-code 2026-04-07] Strands invoke helper with provider fallback chain: local → nous → orouter
// Creates a lightweight Strands agent, invokes once, and returns { text }.
import {
  createAgent,
  NOUS_MODELS,
  type HarperProvider,
} from "./agent-factory.js";
import { checkVProxyHealth } from "./provider.js";
import type { VProxyModelOptions } from "./provider.js";
import {
  getOllamaHealth,
  isOllamaFallbackEnabled,
} from "../ai/ollama-hermes-client.js";
import { createLogger } from "../../lib/logger.js";

const log = createLogger("InvokeAgent");

export interface InvokeAgentOptions {
  systemPrompt: string;
  userPrompt: string;
  model?: VProxyModelOptions;
  /** Skip fallback and use a specific provider */
  provider?: HarperProvider;
}

// [claude-code 2026-04-23] S32-T3: inject ollama-qwen as second-in-chain after VProxy
/** Provider fallback chain for silent/background tasks */
const FALLBACK_CHAIN: HarperProvider[] = [
  "local",
  "ollama-qwen",
  "nous",
  "orouter",
];

/**
 * One-shot text generation via a Strands agent.
 * Automatically falls back through local → nous → orouter if a provider fails.
 */
export async function invokeAgent(
  options: InvokeAgentOptions,
): Promise<{ text: string }> {
  // If explicit provider set, use it directly (no fallback)
  if (options.provider) {
    return invokeWithProvider(options, options.provider);
  }

  // Fallback chain: try each provider in order
  let lastError: Error | null = null;
  for (const provider of FALLBACK_CHAIN) {
    try {
      // Quick health check for local — skip if VProxy is down
      if (provider === "local") {
        const health = await checkVProxyHealth();
        if (!health.available) {
          log.info("VProxy unavailable, skipping local provider");
          continue;
        }
      }

      const result = await invokeWithProvider(options, provider);
      return result;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      log.warn(`Provider ${provider} failed, trying next`, {
        error: lastError.message,
      });
    }
  }

  throw lastError ?? new Error("All providers failed");
}

async function invokeWithProvider(
  options: InvokeAgentOptions,
  provider: HarperProvider,
): Promise<{ text: string }> {
  // Nous provider: try each model in the chain before failing
  if (provider === "nous") {
    return invokeWithNousFallback(options);
  }

  const agent = createAgent({
    name: "one-shot",
    systemPrompt: options.systemPrompt,
    model: options.model,
    printer: false,
    provider,
  });

  const result = await agent.invoke(options.userPrompt);
  return { text: result.toString() };
}

async function invokeWithNousFallback(
  options: InvokeAgentOptions,
): Promise<{ text: string }> {
  let lastError: Error | null = null;
  for (const modelId of NOUS_MODELS) {
    try {
      log.info(`Trying Nous model: ${modelId}`);
      const agent = createAgent({
        name: "one-shot",
        systemPrompt: options.systemPrompt,
        model: options.model,
        printer: false,
        provider: "nous",
        nousModelId: modelId,
      });
      const result = await agent.invoke(options.userPrompt);
      return { text: result.toString() };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      log.warn(`Nous model ${modelId} failed, trying next`, {
        error: lastError.message,
      });
    }
  }
  throw lastError ?? new Error("All Nous models failed");
}
