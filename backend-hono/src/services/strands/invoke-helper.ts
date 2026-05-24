// [claude-code 2026-05-05] S59-T1: Removed HERMES_SIDECAR_URL reference — sidecar deleted.
// [codex 2026-05-18] v6.7.3: DeepSeek-only fallback for silent/background desk tasks.
// Creates a lightweight Strands agent, invokes once, and returns { text }.
import { createAgent, type HarperProvider } from "./agent-factory.js";
import type { StrandsModelOptions } from "./provider.js";
import { createLogger } from "../../lib/logger.js";
import { recordAiProviderFailure } from "../ai/provider-credit-status.js";

const log = createLogger("InvokeAgent");

export interface InvokeAgentOptions {
  systemPrompt: string;
  userPrompt: string;
  model?: StrandsModelOptions;
  /** Skip fallback and use a specific provider */
  provider?: HarperProvider;
}

/** Provider fallback chain for silent/background tasks */
const FALLBACK_CHAIN: HarperProvider[] = ["deepseek-direct", "deepseek-oc-api"];

/**
 * One-shot text generation via a Strands agent.
 * Automatically falls back through DeepSeek direct → DeepSeek OpenCode API.
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
      const result = await invokeWithProvider(options, provider);
      return result;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      recordAiProviderFailure(provider, lastError);
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
